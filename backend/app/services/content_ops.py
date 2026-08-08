import re
from datetime import UTC, datetime
from pathlib import Path

from app.config import Settings
from app.schemas.content_ops import ReviewMetrics, YoutubeProjectDetail, YoutubeProjectSummary

CONTENT_FILES = (
    "research.md",
    "ideas.md",
    "qa.md",
    "script.md",
    "production.md",
    "review.md",
)
DATE_PREFIX = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})(?:-|$)")
REVIEW_TABLE_ROW = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$", re.MULTILINE)
REVIEW_METRIC_FIELDS = {
    "조회수": "view_count",
    "노출 대비 클릭률(CTR)": "ctr",
    "평균 시청 지속시간": "avg_watch_time",
    "구독자 증감": "subscriber_delta",
    "좋아요 / 댓글 / 공유": "engagement",
    "트래픽 소스 1위": "top_traffic_source",
}
EMPTY_METRIC_VALUES = {"", "미연동"}


class ContentOpsService:
    def __init__(self, settings: Settings):
        self.content_dir = settings.content_dir

    def list_youtube_projects(self) -> list[YoutubeProjectSummary]:
        youtube_dir = self.content_dir / "youtube"
        if not youtube_dir.is_dir():
            return []

        projects = [
            self._summary(project_dir)
            for project_dir in youtube_dir.iterdir()
            if project_dir.is_dir() and not project_dir.is_symlink()
        ]
        return sorted(projects, key=lambda project: project.updated_at, reverse=True)

    def get_youtube_project(self, slug: str) -> YoutubeProjectDetail | None:
        youtube_dir = self.content_dir / "youtube"
        if not youtube_dir.is_dir():
            return None

        project_dir = next(
            (
                candidate
                for candidate in youtube_dir.iterdir()
                if candidate.name == slug and candidate.is_dir() and not candidate.is_symlink()
            ),
            None,
        )
        if project_dir is None:
            return None

        contents = {
            name.removesuffix(".md"): self._read_file(project_dir / name) for name in CONTENT_FILES
        }
        return YoutubeProjectDetail(
            slug=project_dir.name,
            date=self._date_from_slug(project_dir.name),
            research=contents["research"],
            ideas=contents["ideas"],
            qa=contents["qa"],
            script=contents["script"],
            production=contents["production"],
            review=contents["review"],
            review_metrics=self._parse_review_metrics(contents["review"]),
        )

    def _summary(self, project_dir: Path) -> YoutubeProjectSummary:
        files = {name: self._is_safe_file(project_dir / name) for name in CONTENT_FILES}
        existing_files = [project_dir / name for name, exists in files.items() if exists]
        latest_mtime = max(
            (path.stat().st_mtime for path in existing_files),
            default=None,
        )
        updated_at = (
            datetime.fromtimestamp(latest_mtime, tz=UTC).isoformat()
            if latest_mtime is not None
            else ""
        )
        review_content = self._read_file(project_dir / "review.md") if files["review.md"] else None
        metrics = self._parse_review_metrics(review_content)
        return YoutubeProjectSummary(
            slug=project_dir.name,
            date=self._date_from_slug(project_dir.name),
            has_research=files["research.md"],
            has_ideas=files["ideas.md"],
            has_qa=files["qa.md"],
            has_script=files["script.md"],
            has_production=files["production.md"],
            has_review=files["review.md"],
            updated_at=updated_at,
            view_count=metrics.view_count if metrics else None,
        )

    @staticmethod
    def _parse_review_metrics(content: str | None) -> ReviewMetrics | None:
        if not content:
            return None

        values: dict[str, str] = {}
        for label, raw_value in REVIEW_TABLE_ROW.findall(content):
            field = REVIEW_METRIC_FIELDS.get(label.strip())
            value = raw_value.strip()
            if field and value not in EMPTY_METRIC_VALUES:
                values[field] = value

        if not values:
            return None
        return ReviewMetrics(
            **{field: values.get(field) for field in REVIEW_METRIC_FIELDS.values()}
        )

    @staticmethod
    def _date_from_slug(slug: str) -> str:
        match = DATE_PREFIX.match(slug)
        return match.group("date") if match else ""

    @staticmethod
    def _is_safe_file(path: Path) -> bool:
        return path.is_file() and not path.is_symlink()

    @classmethod
    def _read_file(cls, path: Path) -> str | None:
        if not cls._is_safe_file(path):
            return None
        return path.read_text(encoding="utf-8")
