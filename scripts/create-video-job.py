"""Create a YouTube video project for the local automation pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.schemas.video_pipeline import VideoJobCreate  # noqa: E402
from app.services.video_pipeline import VideoPipelineService  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a Jay YouTube automation project.")
    parser.add_argument("--topic", required=True, help="Video topic.")
    parser.add_argument("--slug", required=True, help="Lowercase project slug.")
    parser.add_argument("--format", choices=("shorts", "longform"), default="shorts")
    args = parser.parse_args()

    service = VideoPipelineService(get_settings())
    service.init_db()
    job = service.create_job(
        VideoJobCreate(topic=args.topic, slug=args.slug, format=args.format)
    )
    print(f"Created project: {job.slug}")
    print(f"Stage: {job.stage}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
