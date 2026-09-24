"""Run the repeatable YouTube Shorts production flow for one content folder.

The pipeline is intentionally approval-gated:

1. Read a small ``pipeline.json`` project contract.
2. Generate only missing visual assets (Gemini, when a scene has a prompt).
3. Generate a Korean neural narration (Edge TTS, when the configured file is missing).
4. Create and normalize a thumbnail/cover image (the first frame for Shorts).
5. Build SRT/ASS captions and a 1080x1920 MP4.
6. Write upload metadata and a status file for human review.
7. Upload only when ``--upload`` is supplied *and* approval.md contains
   ``decision: approve``. YouTube OAuth credentials are never read from the
   project folder; they come from the normal application environment.

Example (from the repository root)::

    .\\.venv\\Scripts\\python.exe scripts\\youtube-auto-pipeline.py \
        --project-dir content\\youtube\\2026-08-15-bigbang-20th

The script does not replace the representative approval step. It automates the
repeatable work around that step, while keeping publication an explicit action.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.schemas.video_pipeline import UploadIntent  # noqa: E402
from app.services.google_providers import (  # noqa: E402
    GeminiImageProvider,
    ProviderError,
    ProviderNotConfigured,
    YouTubeUploadProvider,
)


class PipelineError(RuntimeError):
    """Raised when a project cannot be safely automated."""


def main() -> int:
    args = parse_args()
    try:
        return asyncio.run(run_pipeline(args))
    except (OSError, ProviderError, ProviderNotConfigured, PipelineError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a Jay YouTube Short from a content project folder."
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        required=True,
        help="Folder under content/youtube containing script.md and production.md.",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Pipeline JSON file (default: <project-dir>/pipeline.json).",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Upload after rendering; requires approval.md decision: approve and YouTube OAuth.",
    )
    parser.add_argument(
        "--regenerate-voice",
        action="store_true",
        help="Regenerate narration even when the configured audio file already exists.",
    )
    parser.add_argument(
        "--regenerate-images",
        action="store_true",
        help="Regenerate configured Gemini images even when their files already exist.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs and print planned work without calling providers or FFmpeg.",
    )
    return parser.parse_args()


async def run_pipeline(args: argparse.Namespace) -> int:
    project_dir = args.project_dir.expanduser().resolve()
    config_path = (args.config or project_dir / "pipeline.json").expanduser().resolve()
    config = load_config(project_dir, config_path)
    validate_project(project_dir, config)
    if args.upload:
        # Fail before expensive provider/FFmpeg work when publication has not
        # been explicitly approved by the representative.
        ensure_approval(project_dir / "approval.md")
    print(f"Project: {project_dir}")
    print(f"Scenes: {len(config['scenes'])} | voice: {config['voice']['path']}")

    if args.dry_run:
        print_plan(project_dir, config, args)
        return 0

    settings = get_settings()
    ffmpeg_binary = resolve_ffmpeg(settings.ffmpeg_binary)
    await generate_missing_images(project_dir, config, settings, args.regenerate_images)
    thumbnail_path = await ensure_thumbnail(
        ffmpeg_binary,
        project_dir,
        config,
        settings,
        args.regenerate_images,
    )
    # YouTube Shorts cannot use a post-upload custom thumbnail in the same way
    # as long-form videos. Make the approved cover the first rendered frame.
    if config["format"] == "shorts":
        config["scenes"][0]["file"] = thumbnail_path.relative_to(project_dir).as_posix()
    voice_path = await ensure_voice(project_dir, config, args.regenerate_voice)
    captions_path, ass_path = write_captions(project_dir, config)
    output_path = render_video(
        ffmpeg_binary,
        project_dir,
        config,
        voice_path,
        ass_path,
    )
    metadata_path = write_metadata(project_dir, config)
    status = {
        "updated_at": now_iso(),
        "stage": "ready_for_upload",
        "project_dir": str(project_dir),
        "video": str(output_path),
        "thumbnail": str(thumbnail_path),
        "thumbnail_mode": "first_frame_cover" if config["format"] == "shorts" else "custom_api",
        "captions": str(captions_path),
        "metadata": str(metadata_path),
        "approval_required": True,
        "uploaded": False,
        "thumbnail_uploaded": False,
    }

    if args.upload:
        set_thumbnail = (
            config["format"] != "shorts"
            and isinstance(config.get("thumbnail"), dict)
            and bool(config["thumbnail"].get("set_on_youtube", True))
        )
        video_id = await upload_video(
            settings,
            output_path,
            config,
            thumbnail_path if set_thumbnail else None,
        )
        status.update(
            {
                "stage": "uploaded",
                "uploaded": True,
                "youtube_video_id": video_id,
                "thumbnail_uploaded": set_thumbnail,
            }
        )
        print(f"YouTube upload complete: https://youtu.be/{video_id}")
    else:
        print("Render complete. YouTube upload is paused until approval.md says decision: approve.")

    status_path = project_dir / "pipeline-status.json"
    status_path.write_text(
        json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Video: {output_path}")
    print(f"Metadata: {metadata_path}")
    print(f"Status: {status_path}")
    return 0


def load_config(project_dir: Path, config_path: Path) -> dict[str, Any]:
    if not project_dir.is_dir():
        raise PipelineError(f"Project folder not found: {project_dir}")
    if not config_path.is_file():
        raise PipelineError(
            "pipeline.json is missing: "
            f"{config_path}. Copy the project template and fill in scenes."
        )
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise PipelineError(f"pipeline.json is not valid JSON: {error}") from error
    if not isinstance(config, dict):
        raise PipelineError("pipeline.json must contain one JSON object.")
    return config


def validate_project(project_dir: Path, config: dict[str, Any]) -> None:
    for required in ("script.md", "production.md"):
        if not (project_dir / required).is_file():
            raise PipelineError(f"Required project file is missing: {required}")
    scenes = config.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise PipelineError("pipeline.json must define at least one scene.")
    voice = config.get("voice")
    if not isinstance(voice, dict) or not str(voice.get("path", "")).strip():
        raise PipelineError("pipeline.json voice.path is required.")
    segments = config.get("caption_segments")
    if not isinstance(segments, list) or not segments:
        raise PipelineError("pipeline.json must define caption_segments.")
    video_format = str(config.get("format", "shorts")).strip().lower()
    if video_format not in {"shorts", "longform"}:
        raise PipelineError("pipeline.json format must be shorts or longform.")

    thumbnail = config.get("thumbnail")
    if thumbnail is not None:
        if not isinstance(thumbnail, dict):
            raise PipelineError("pipeline.json thumbnail must be an object.")
        thumbnail_file = str(thumbnail.get("file", "")).strip()
        thumbnail_prompt = str(thumbnail.get("prompt", "")).strip()
        if not thumbnail_file and not thumbnail_prompt:
            raise PipelineError("thumbnail needs file or prompt when configured.")
        if thumbnail_file:
            safe_relative_path(project_dir, thumbnail_file)

    previous_end = 0.0
    for index, scene in enumerate(scenes, start=1):
        if not isinstance(scene, dict):
            raise PipelineError(f"Scene {index} must be an object.")
        duration = scene.get("duration_seconds")
        if not isinstance(duration, (int, float)) or duration <= 0:
            raise PipelineError(f"Scene {index} duration_seconds must be positive.")
        source = str(scene.get("file", "")).strip()
        prompt = str(scene.get("prompt", "")).strip()
        if not source and not prompt:
            raise PipelineError(f"Scene {index} needs file or prompt.")
        if source:
            safe_relative_path(project_dir, source)
        previous_end += float(duration)

    previous_end = 0.0
    for index, segment in enumerate(segments, start=1):
        if not isinstance(segment, dict):
            raise PipelineError(f"Caption segment {index} must be an object.")
        start = number(segment.get("start"), f"caption segment {index} start")
        end = number(segment.get("end"), f"caption segment {index} end")
        if start < previous_end or end <= start:
            raise PipelineError(f"Caption segment {index} has overlapping or invalid times.")
        if not str(segment.get("text", "")).strip():
            raise PipelineError(f"Caption segment {index} text is empty.")
        previous_end = end


def number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise PipelineError(f"{label} must be a number.")
    return float(value)


def safe_relative_path(project_dir: Path, value: str) -> Path:
    candidate = (project_dir / value).resolve()
    if not candidate.is_relative_to(project_dir):
        raise PipelineError(f"Path must stay inside project folder: {value}")
    return candidate


def resolve_ffmpeg(configured: str) -> str:
    candidates = [os.getenv("FFMPEG_BINARY", "").strip(), configured.strip()]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
        if candidate and shutil.which(candidate):
            return candidate
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError) as error:
        raise PipelineError(
            "FFmpeg is not available. Run: "
            ".\\.venv\\Scripts\\pip.exe install -r scripts\\requirements-media.txt"
        ) from error


async def generate_missing_images(
    project_dir: Path,
    config: dict[str, Any],
    settings: Any,
    regenerate: bool,
) -> None:
    provider: GeminiImageProvider | None = None
    for index, scene in enumerate(config["scenes"], start=1):
        source = str(scene.get("file", "")).strip()
        prompt = str(scene.get("prompt", "")).strip()
        if not prompt:
            if not source:
                raise PipelineError(f"Scene {index} has no file or prompt.")
            if not safe_relative_path(project_dir, source).is_file():
                raise PipelineError(f"Scene {index} file not found: {source}")
            continue
        output = safe_relative_path(
            project_dir, source or f"assets/generated-scene-{index:02d}.jpg"
        )
        output = output.with_suffix(".jpg")
        scene["file"] = output.relative_to(project_dir).as_posix()
        if output.is_file() and not regenerate:
            continue
        if provider is None:
            provider = GeminiImageProvider(settings)
        print(f"Generating image {index}/{len(config['scenes'])}: {output.name}")
        await provider.generate_image(prompt, output)


async def ensure_thumbnail(
    ffmpeg_binary: str,
    project_dir: Path,
    config: dict[str, Any],
    settings: Any,
    regenerate: bool,
) -> Path:
    """Resolve a thumbnail source, generate it if requested, and normalize it.

    The normalized file is always JPEG and stays below YouTube's 2 MB limit.
    A Shorts thumbnail is intentionally portrait because it becomes the first
    frame/cover; a long-form thumbnail is normalized to 1280x720 for the API.
    """
    thumbnail = config.get("thumbnail")
    thumbnail = thumbnail if isinstance(thumbnail, dict) else {}
    source_name = str(thumbnail.get("file", "")).strip()
    prompt = str(thumbnail.get("prompt", "")).strip()
    if not source_name:
        source_name = (
            "assets/thumbnail-generated.jpg"
            if prompt
            else str(config["scenes"][0].get("file", "")).strip()
        )
    if not source_name and not prompt:
        raise PipelineError("A thumbnail source or prompt is required.")
    source = safe_relative_path(project_dir, source_name or "assets/thumbnail-source.jpg")
    if prompt and (regenerate or not source.is_file()):
        provider = GeminiImageProvider(settings)
        print(f"Generating thumbnail: {source.name}")
        await provider.generate_image(
            prompt,
            source,
            aspect_ratio="16:9" if config["format"] == "longform" else "9:16",
        )
    if not source.is_file():
        raise PipelineError(f"Thumbnail file not found: {source}")

    output_dir = project_dir / "rendered"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / "thumbnail.jpg"
    if output.is_file() and output.stat().st_size <= 2 * 1024 * 1024 and not regenerate:
        config.setdefault("thumbnail", {})["file"] = output.relative_to(project_dir).as_posix()
        return output

    dimensions = "1280:720" if config["format"] == "longform" else "1080:1920"
    temporary = output.with_name(".thumbnail-normalized.jpg")
    for quality in (3, 6, 9):
        run_ffmpeg(
            ffmpeg_binary,
            [
                "-y",
                "-i",
                str(source),
                "-vf",
                f"scale={dimensions}:force_original_aspect_ratio=increase,"
                f"crop={dimensions}",
                "-frames:v",
                "1",
                "-q:v",
                str(quality),
                str(temporary),
            ],
        )
        if temporary.is_file() and temporary.stat().st_size <= 2 * 1024 * 1024:
            temporary.replace(output)
            config.setdefault("thumbnail", {})["file"] = output.relative_to(project_dir).as_posix()
            return output
    temporary.unlink(missing_ok=True)
    raise PipelineError("Thumbnail could not be compressed below YouTube's 2 MB limit.")


async def ensure_voice(project_dir: Path, config: dict[str, Any], regenerate: bool) -> Path:
    voice = config["voice"]
    output = safe_relative_path(project_dir, str(voice["path"]))
    if output.is_file() and not regenerate:
        return output
    try:
        import edge_tts
    except ImportError as error:
        raise PipelineError(
            "edge-tts is required for natural narration. Run: "
            ".\\.venv\\Scripts\\pip.exe install -r scripts\\requirements-media.txt"
        ) from error
    text = str(config.get("narration_text", "")).strip()
    if not text:
        raise PipelineError("narration_text is required when narration audio is missing.")
    output.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(
        text,
        voice=str(voice.get("name", "ko-KR-InJoonNeural")),
        rate=str(voice.get("rate", "+0%")),
        pitch=str(voice.get("pitch", "+0Hz")),
    )
    print(f"Generating Korean neural narration: {output.name}")
    await communicate.save(str(output))
    if not output.is_file() or output.stat().st_size == 0:
        raise PipelineError("Voice provider returned no audio file.")
    return output


def write_captions(project_dir: Path, config: dict[str, Any]) -> tuple[Path, Path]:
    assets_dir = project_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    srt_path = assets_dir / "captions.srt"
    ass_path = assets_dir / "captions.ass"
    segments = config["caption_segments"]
    srt_lines: list[str] = []
    ass_events: list[str] = []
    for index, segment in enumerate(segments, start=1):
        start = float(segment["start"])
        end = float(segment["end"])
        text = clean_caption(str(segment["text"]))
        srt_lines.extend(
            [str(index), f"{srt_time(start)} --> {srt_time(end)}", text, ""]
        )
        ass_events.append(
            f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Top,,0,0,80,,{text}"
        )
    srt_path.write_text("\n".join(srt_lines) + "\n", encoding="utf-8")
    ass_header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1080\n"
        "PlayResY: 1920\n"
        "WrapStyle: 2\n"
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, "
        "ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding\n"
        "Style: Top,Malgun Gothic,42,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80101010,"
        "-1,0,0,0,100,100,0,0,1,3,1,8,70,70,80,1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text\n"
    )
    ass_text = ass_header + "\n".join(ass_events) + "\n"
    ass_path.write_text(ass_text, encoding="utf-8")
    return srt_path, ass_path


def clean_caption(value: str) -> str:
    return value.replace("\n", " ").replace("{", "(").replace("}", ")").strip()


def render_video(
    ffmpeg_binary: str,
    project_dir: Path,
    config: dict[str, Any],
    voice_path: Path,
    ass_path: Path,
) -> Path:
    output_dir = project_dir / "rendered"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{project_dir.name}.mp4"
    total_duration = sum(float(scene["duration_seconds"]) for scene in config["scenes"])
    with tempfile.TemporaryDirectory(prefix="jay-youtube-") as temp_name:
        temp_dir = Path(temp_name)
        normalized: list[tuple[Path, float]] = []
        for index, scene in enumerate(config["scenes"], start=1):
            source = safe_relative_path(project_dir, str(scene["file"]))
            if not source.is_file():
                raise PipelineError(f"Scene {index} file not found: {source}")
            target = temp_dir / f"scene-{index:02d}.jpg"
            run_ffmpeg(
                ffmpeg_binary,
                [
                    "-y",
                    "-i",
                    str(source),
                    "-vf",
                    "scale=1080:1920:force_original_aspect_ratio=decrease,"
                    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p",
                    "-frames:v",
                    "1",
                    "-q:v",
                    "2",
                    str(target),
                ],
            )
            normalized.append((target, float(scene["duration_seconds"])))
        manifest = temp_dir / "images.txt"
        manifest.write_text(build_manifest(normalized), encoding="utf-8")
        subtitle_file = ffmpeg_filter_path(ass_path)
        video_filter = f"fps=30,format=yuv420p,subtitles=filename='{subtitle_file}'"
        run_ffmpeg(
            ffmpeg_binary,
            [
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(manifest),
                "-i",
                str(voice_path),
                "-vf",
                video_filter,
                "-r",
                "30",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-ar",
                "24000",
                "-t",
                f"{total_duration:g}",
                "-shortest",
                str(output_path),
            ],
            timeout=900,
        )
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise PipelineError("FFmpeg completed without producing a video file.")
    return output_path


def run_ffmpeg(binary: str, arguments: list[str], timeout: int = 120) -> None:
    try:
        result = subprocess.run(
            [binary, *arguments],
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as error:
        raise PipelineError(f"FFmpeg was not found: {binary}") from error
    if result.returncode:
        lines = [line.strip() for line in result.stderr.splitlines() if line.strip()]
        raise PipelineError(lines[-1] if lines else "FFmpeg returned a non-zero exit code.")


def build_manifest(images: list[tuple[Path, float]]) -> str:
    lines: list[str] = []
    for image, duration in images:
        escaped = str(image).replace("'", "'\\''")
        lines.extend([f"file '{escaped}'", f"duration {duration:g}"])
    escaped_last = str(images[-1][0]).replace("'", "'\\''")
    # The concat demuxer needs the final file repeated so the last frame is
    # emitted, but a second ``duration`` line would double-count that scene.
    # Leaving the repeated entry without a duration adds only one frame.
    lines.append(f"file '{escaped_last}'")
    return "\n".join(lines) + "\n"


def ffmpeg_filter_path(path: Path) -> str:
    return str(path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


def write_metadata(project_dir: Path, config: dict[str, Any]) -> Path:
    metadata = config.get("metadata")
    if not isinstance(metadata, dict):
        raise PipelineError("pipeline.json metadata object is required.")
    title = str(metadata.get("title", "")).strip()
    description = str(metadata.get("description", "")).strip()
    if not title:
        raise PipelineError("metadata.title is required.")
    tags = metadata.get("tags", [])
    if not isinstance(tags, list):
        raise PipelineError("metadata.tags must be an array.")
    lines = [
        f"# {title}",
        "",
        "## 설명",
        description,
        "",
        "## 태그",
        ", ".join(str(tag) for tag in tags),
        "",
        "## 고정 댓글",
        str(metadata.get("pinned_comment", "")),
        "",
        "## 썸네일",
        str(config.get("thumbnail", {}).get("file", "")),
        (
            "Shorts: 첫 장면으로 사용 (업로드 후 커스텀 썸네일 변경 제한)"
            if config.get("format") == "shorts"
            else "Long-form: YouTube thumbnails.set API로 업로드"
        ),
        "",
        "## 대표 확인",
        "- [ ] 사진·로고 사용 권리 확인",
        "- [ ] 사실관계와 공식 출처 확인",
        "- [ ] 썸네일과 영상 최종 확인",
        "- [ ] 대표 승인 후에만 YouTube 업로드",
        "",
    ]
    output = project_dir / "upload-metadata.md"
    output.write_text("\n".join(lines), encoding="utf-8")
    return output


def ensure_approval(approval_path: Path) -> None:
    if not approval_path.is_file():
        raise PipelineError(
            "approval.md is missing. Review the render and record decision: approve."
        )
    content = approval_path.read_text(encoding="utf-8", errors="replace").lower()
    if not re.search(r"decision\s*:\s*approve|결정\s*:\s*approve", content):
        raise PipelineError("Upload blocked: approval.md must contain 'decision: approve'.")


async def upload_video(
    settings: Any,
    video_path: Path,
    config: dict[str, Any],
    thumbnail_path: Path | None = None,
) -> str:
    metadata = config["metadata"]
    visibility = str(metadata.get("visibility", "private"))
    if visibility not in {"private", "unlisted", "public"}:
        raise PipelineError("metadata.visibility must be private, unlisted, or public.")
    intent = UploadIntent(
        id=0,
        title=str(metadata["title"]),
        description=str(metadata.get("description", "")),
        tags=[str(tag) for tag in metadata.get("tags", [])],
        visibility=visibility,
        scheduled_at=None,
        status="pending",
        youtube_video_id=None,
        created_at=now_iso(),
    )
    return await YouTubeUploadProvider(settings).upload_video(
        video_path,
        intent,
        thumbnail_path=thumbnail_path,
    )


def print_plan(project_dir: Path, config: dict[str, Any], args: argparse.Namespace) -> None:
    print("Dry run: no provider or FFmpeg calls will be made.")
    for index, scene in enumerate(config["scenes"], start=1):
        source = scene.get("file") or f"assets/generated-scene-{index:02d}.jpg"
        action = "reuse" if safe_relative_path(project_dir, str(source)).is_file() else "generate"
        print(f"  scene {index}: {action} -> {source} ({scene['duration_seconds']}s)")
    voice = safe_relative_path(project_dir, str(config["voice"]["path"]))
    print(
        f"  voice: {'reuse' if voice.is_file() else 'generate'} "
        f"-> {voice.relative_to(project_dir)}"
    )
    thumbnail = config.get("thumbnail")
    thumbnail_file = (
        str(thumbnail.get("file", "")).strip()
        if isinstance(thumbnail, dict)
        else ""
    ) or str(config["scenes"][0].get("file", ""))
    thumbnail_source = safe_relative_path(project_dir, thumbnail_file)
    print(
        f"  thumbnail: {'reuse' if thumbnail_source.is_file() else 'generate/normalize'} "
        f"-> {thumbnail_file} "
        f"({'first frame' if config.get('format') == 'shorts' else 'YouTube API'})"
    )
    print(f"  upload: {'requested (approval still required)' if args.upload else 'not requested'}")


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def srt_time(seconds: float) -> str:
    hours, remainder = divmod(max(0.0, seconds), 3600)
    minutes, remainder = divmod(remainder, 60)
    whole = int(remainder)
    milliseconds = int(round((remainder - whole) * 1000))
    if milliseconds == 1000:
        whole += 1
        milliseconds = 0
    return f"{int(hours):02d}:{int(minutes):02d}:{whole:02d},{milliseconds:03d}"


def ass_time(seconds: float) -> str:
    hours, remainder = divmod(max(0.0, seconds), 3600)
    minutes, remainder = divmod(remainder, 60)
    whole = int(remainder)
    centiseconds = int(round((remainder - whole) * 100))
    if centiseconds == 100:
        whole += 1
        centiseconds = 0
    return f"{int(hours)}:{int(minutes):02d}:{whole:02d}.{centiseconds:02d}"


if __name__ == "__main__":
    raise SystemExit(main())
