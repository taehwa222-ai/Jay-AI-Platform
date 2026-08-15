"""Generate one image or voice asset for an existing YouTube project.

The script intentionally requires an explicit project slug and output filename so a
provider cannot silently write into another project.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.schemas.video_pipeline import AssetRegister  # noqa: E402
from app.services.google_providers import (  # noqa: E402
    GeminiImageProvider,
    GoogleTextToSpeechProvider,
    ProviderError,
    ProviderNotConfigured,
)
from app.services.video_pipeline import VideoPipelineService  # noqa: E402


async def run(args: argparse.Namespace) -> int:
    settings = get_settings()
    service = VideoPipelineService(settings)
    service.init_db()
    job = service.get_job(args.slug)
    project_dir = (settings.content_dir / "youtube" / job.slug).resolve()
    output_path = (project_dir / "assets" / args.output).resolve()
    if not output_path.is_relative_to(project_dir):
        raise ValueError("The output file must stay inside the project folder.")

    if args.kind == "image":
        output_path = output_path.with_suffix(".png")
        await GeminiImageProvider(settings).generate_image(args.prompt, output_path)
        asset = AssetRegister(
            asset_type="image",
            storage_uri=f"file://{output_path}",
            mime_type="image/png",
        )
    else:
        output_path = output_path.with_suffix(".mp3")
        await GoogleTextToSpeechProvider(settings).synthesize(args.text, output_path)
        asset = AssetRegister(
            asset_type="audio",
            storage_uri=f"file://{output_path}",
            mime_type="audio/mpeg",
        )
    service.register_asset(job.slug, asset)
    print(f"Generated {args.kind} asset: {output_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate one Jay YouTube media asset.")
    parser.add_argument("--slug", required=True, help="Existing YouTube project slug.")
    parser.add_argument("--kind", choices=("image", "audio"), required=True)
    parser.add_argument(
        "--output",
        required=True,
        help="Filename inside the project assets folder.",
    )
    parser.add_argument("--prompt", default="", help="Prompt for image generation.")
    parser.add_argument("--text", default="", help="Text for speech synthesis.")
    args = parser.parse_args()
    if args.kind == "image" and not args.prompt.strip():
        parser.error("--prompt is required for image generation.")
    if args.kind == "audio" and not args.text.strip():
        parser.error("--text is required for speech synthesis.")
    try:
        return asyncio.run(run(args))
    except (ProviderError, ProviderNotConfigured, ValueError, LookupError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
