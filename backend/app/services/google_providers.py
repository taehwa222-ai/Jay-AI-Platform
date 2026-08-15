from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

import httpx

from app.config import Settings
from app.schemas.video_pipeline import UploadIntent


class ProviderNotConfigured(RuntimeError):
    """Raised when an external provider cannot be called safely yet."""


class ProviderError(RuntimeError):
    """Raised when an external provider returns an unusable response."""


class GeminiImageProvider:
    endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions"

    def __init__(self, settings: Settings):
        self.settings = settings

    async def generate_image(
        self,
        prompt: str,
        output_path: Path,
        aspect_ratio: str = "9:16",
    ) -> Path:
        if not self.settings.gemini_api_key.strip():
            raise ProviderNotConfigured("GEMINI_API_KEY is not configured.")
        if not prompt.strip():
            raise ValueError("An image prompt is required.")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "model": self.settings.gemini_image_model,
            "input": prompt.strip(),
            "response_format": {
                "type": "image",
                "mime_type": "image/png",
                "aspect_ratio": aspect_ratio,
                "image_size": "1K",
            },
        }
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.endpoint,
                headers={
                    "x-goog-api-key": self.settings.gemini_api_key.strip(),
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.is_error:
            raise ProviderError(f"Gemini image generation failed ({response.status_code}).")
        try:
            data = response.json()
            image_data = data["output_image"]["data"]
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ProviderError("Gemini returned no output image.") from error
        try:
            output_path.write_bytes(base64.b64decode(image_data, validate=True))
        except (ValueError, TypeError) as error:
            raise ProviderError("Gemini returned invalid image data.") from error
        if output_path.stat().st_size == 0:
            raise ProviderError("Gemini returned an empty image.")
        return output_path


class GoogleTextToSpeechProvider:
    endpoint = "https://texttospeech.googleapis.com/v1/text:synthesize"
    metadata_token_url = (
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
    )

    def __init__(self, settings: Settings):
        self.settings = settings

    async def synthesize(
        self,
        text: str,
        output_path: Path,
        language_code: str = "ko-KR",
        voice_name: str = "ko-KR-Neural2-A",
    ) -> Path:
        if not text.strip():
            raise ValueError("Text to synthesize is required.")
        access_token = await self._access_token()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "input": {"text": text.strip()},
            "voice": {"languageCode": language_code, "name": voice_name},
            "audioConfig": {"audioEncoding": "MP3"},
        }
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
                json=payload,
            )
        if response.is_error:
            raise ProviderError(f"Cloud Text-to-Speech failed ({response.status_code}).")
        try:
            audio_data = response.json()["audioContent"]
            output_path.write_bytes(base64.b64decode(audio_data, validate=True))
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ProviderError("Cloud Text-to-Speech returned no valid audio.") from error
        if output_path.stat().st_size == 0:
            raise ProviderError("Cloud Text-to-Speech returned empty audio.")
        return output_path

    async def _access_token(self) -> str:
        if self.settings.google_cloud_access_token.strip():
            return self.settings.google_cloud_access_token.strip()
        async with httpx.AsyncClient(timeout=3) as client:
            try:
                response = await client.get(
                    self.metadata_token_url,
                    headers={"Metadata-Flavor": "Google"},
                )
            except httpx.HTTPError as error:
                raise ProviderNotConfigured(
                    "Set GOOGLE_CLOUD_ACCESS_TOKEN or run the worker on a GCP VM service account."
                ) from error
        if response.is_error:
            raise ProviderNotConfigured(
                "Set GOOGLE_CLOUD_ACCESS_TOKEN or grant the GCP VM a Text-to-Speech scope."
            )
        try:
            token = response.json()["access_token"]
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ProviderNotConfigured(
                "The GCP metadata server returned no access token."
            ) from error
        return str(token)


class YouTubeUploadProvider:
    token_endpoint = "https://oauth2.googleapis.com/token"
    upload_endpoint = "https://www.googleapis.com/upload/youtube/v3/videos"

    def __init__(self, settings: Settings):
        self.settings = settings

    async def upload_video(self, video_path: Path, intent: UploadIntent) -> str:
        self._validate_configuration()
        if not video_path.is_file():
            raise ValueError(f"Video file does not exist: {video_path}")
        if intent.scheduled_at and intent.visibility != "private":
            raise ValueError("A scheduled YouTube upload must use private visibility.")

        access_token = await self._access_token()
        metadata: dict[str, Any] = {
            "snippet": {
                "title": intent.title,
                "description": intent.description,
                "tags": intent.tags,
                "categoryId": self.settings.youtube_category_id,
            },
            "status": {"privacyStatus": intent.visibility},
        }
        if intent.scheduled_at:
            metadata["status"]["publishAt"] = intent.scheduled_at

        file_size = video_path.stat().st_size
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": str(file_size),
        }
        async with httpx.AsyncClient(timeout=120) as client:
            session = await client.post(
                self.upload_endpoint,
                params={"part": "snippet,status", "uploadType": "resumable"},
                headers=headers,
                json=metadata,
            )
            if session.is_error:
                raise ProviderError(f"YouTube upload session failed ({session.status_code}).")
            location = session.headers.get("location")
            if not location:
                raise ProviderError("YouTube did not return an upload location.")
            with video_path.open("rb") as video_file:
                uploaded = await client.put(
                    location,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "video/mp4",
                        "Content-Length": str(file_size),
                    },
                    content=video_file,
                )
        if uploaded.is_error:
            raise ProviderError(f"YouTube upload failed ({uploaded.status_code}).")
        try:
            video_id = uploaded.json()["id"]
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ProviderError("YouTube returned no video id.") from error
        return str(video_id)

    def _validate_configuration(self) -> None:
        missing = [
            name
            for name, value in (
                ("YOUTUBE_CLIENT_ID", self.settings.youtube_client_id),
                ("YOUTUBE_CLIENT_SECRET", self.settings.youtube_client_secret),
                ("YOUTUBE_REFRESH_TOKEN", self.settings.youtube_refresh_token),
            )
            if not value.strip()
        ]
        if missing:
            raise ProviderNotConfigured(f"YouTube OAuth is not configured: {', '.join(missing)}.")

    async def _access_token(self) -> str:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                YouTubeUploadProvider.token_endpoint,
                data={
                    "client_id": self.settings.youtube_client_id,
                    "client_secret": self.settings.youtube_client_secret,
                    "refresh_token": self.settings.youtube_refresh_token,
                    "grant_type": "refresh_token",
                },
            )
        if response.is_error:
            raise ProviderError(f"YouTube OAuth refresh failed ({response.status_code}).")
        try:
            token = response.json()["access_token"]
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ProviderError("YouTube OAuth returned no access token.") from error
        return str(token)
