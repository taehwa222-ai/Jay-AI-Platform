"""Run one queued local video render task.

Generated assets must be registered as file:// URIs inside the project's YouTube folder.
Install FFmpeg on the development machine or VPS before running this worker:

    python scripts/video-worker.py --once
"""

from __future__ import annotations

import argparse
import asyncio
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.schemas.video_pipeline import AssetRegister, VideoJobDetail  # noqa: E402
from app.services.google_providers import (  # noqa: E402
    ProviderError,
    ProviderNotConfigured,
    YouTubeUploadProvider,
)
from app.services.video_pipeline import VideoPipelineService  # noqa: E402


class WorkerError(RuntimeError):
    pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Render one queued Jay YouTube video task.")
    parser.add_argument(
        "--type",
        choices=("render", "youtube_upload"),
        default="render",
        help="Task type to process.",
    )
    parser.add_argument("--once", action="store_true", help="Process one task and exit.")
    args = parser.parse_args()
    if not args.once:
        parser.error("--once is required until a long-running worker supervisor is added.")

    settings = get_settings()
    service = VideoPipelineService(settings)
    service.init_db()
    task = service.claim_next_task(args.type)
    if task is None:
        print("No queued render task.")
        return 0

    try:
        job = service.get_job(task.job_slug)
        if args.type == "render":
            output = render_job(settings.ffmpeg_binary, settings.content_dir, job)
            service.register_asset(
                task.job_slug,
                AssetRegister(
                    asset_type="rendered_video",
                    storage_uri=f"file://{output}",
                    mime_type="video/mp4",
                    width=1080,
                    height=1920,
                ),
            )
            service.mark_render_ready(task.job_slug)
        else:
            video_asset = next(
                (asset for asset in reversed(job.assets) if asset.asset_type == "rendered_video"),
                None,
            )
            if video_asset is None or job.upload_intent is None:
                raise WorkerError("A rendered video and upload intent are required.")
            video_path = local_asset_path(
                video_asset.storage_uri,
                (settings.content_dir / "youtube" / task.job_slug).resolve(),
            )
            video_id = asyncio.run(
                YouTubeUploadProvider(settings).upload_video(video_path, job.upload_intent)
            )
            service.mark_upload_succeeded(task.id, video_id)
    except (
        OSError,
        ProviderError,
        ProviderNotConfigured,
        WorkerError,
        subprocess.SubprocessError,
        ValueError,
    ) as error:
        service.fail_task(task.id, str(error))
        print(f"{args.type} task {task.id} failed: {error}", file=sys.stderr)
        return 1

    print(f"{args.type} task {task.id} completed.")
    return 0


def render_job(ffmpeg_binary: str, content_dir: Path, job: VideoJobDetail) -> Path:
    project_dir = (content_dir / "youtube" / job.slug).resolve()
    if not project_dir.is_dir():
        raise WorkerError("The video project folder does not exist.")

    image_assets = [asset for asset in job.assets if asset.asset_type == "image"]
    if not image_assets:
        raise WorkerError("At least one image asset is required before rendering.")
    image_paths = [local_asset_path(asset.storage_uri, project_dir) for asset in image_assets]
    audio_assets = [asset for asset in job.assets if asset.asset_type == "audio"]
    audio_path = (
        local_asset_path(audio_assets[0].storage_uri, project_dir) if audio_assets else None
    )
    output_dir = project_dir / "rendered"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{job.slug}.mp4"

    with tempfile.TemporaryDirectory(prefix="jay-video-") as temporary_dir:
        concat_path = Path(temporary_dir) / "images.txt"
        concat_path.write_text(build_concat_manifest(image_paths), encoding="utf-8")
        command = [
            ffmpeg_binary,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
        ]
        if audio_path is not None:
            command.extend(["-i", str(audio_path)])
        command.extend(
            [
                "-vf",
                "scale=1080:1920:force_original_aspect_ratio=decrease,"
                "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
                "-r",
                "30",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
            ]
        )
        if audio_path is not None:
            command.extend(["-c:a", "aac", "-shortest"])
        else:
            command.append("-an")
        command.append(str(output_path))
        try:
            result = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                timeout=900,
            )
        except FileNotFoundError as error:
            raise WorkerError(
                f"FFmpeg was not found. Install it or set FFMPEG_BINARY. ({ffmpeg_binary})"
            ) from error
        if result.returncode != 0:
            detail = result.stderr.strip().splitlines()
            raise WorkerError(detail[-1] if detail else "FFmpeg returned a non-zero exit code.")

    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise WorkerError("FFmpeg completed without producing a video file.")
    return output_path


def local_asset_path(storage_uri: str, project_dir: Path) -> Path:
    if not storage_uri.lower().startswith("file://"):
        raise WorkerError("The local renderer accepts file:// assets only.")
    raw_path = storage_uri[7:]
    if raw_path.startswith("/") and len(raw_path) > 2 and raw_path[2] == ":":
        raw_path = raw_path[1:]
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = project_dir / candidate
    resolved = candidate.resolve()
    if not resolved.is_relative_to(project_dir):
        raise WorkerError("An asset path must stay inside the project folder.")
    if not resolved.is_file():
        raise WorkerError(f"Asset file not found: {resolved}")
    return resolved


def build_concat_manifest(image_paths: list[Path]) -> str:
    lines: list[str] = []
    for image_path in image_paths:
        escaped = str(image_path).replace("'", "'\\''")
        lines.extend([f"file '{escaped}'", "duration 3"])
    escaped_last = str(image_paths[-1]).replace("'", "'\\''")
    lines.append(f"file '{escaped_last}'")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    raise SystemExit(main())
