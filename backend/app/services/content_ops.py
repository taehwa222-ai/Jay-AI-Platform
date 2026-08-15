import re
from datetime import UTC, datetime
from pathlib import Path

from app.config import Settings
from app.schemas.content_ops import (
    ContentDocument,
    EmoticonProjectDetail,
    EmoticonProjectSummary,
    EmoticonSetDetail,
    EmoticonSetSummary,
    ReviewMetrics,
    YoutubeProjectDetail,
    YoutubeProjectSummary,
)

CONTENT_FILES = (
    "research.md",
    "ideas.md",
    "qa.md",
    "script.md",
    "production.md",
    "review.md",
)
EMOTICON_CHARACTER_FILES = (
    "character.md",
    "research.md",
    "qa.md",
    "friends.md",
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
SAFE_MARKDOWN_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*\.md$")


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

    def list_emoticon_projects(self) -> list[EmoticonProjectSummary]:
        emoticon_dir = self.content_dir / "emoticon"
        if not emoticon_dir.is_dir():
            return []

        projects = [
            self._emoticon_summary(project_dir)
            for project_dir in emoticon_dir.iterdir()
            if project_dir.is_dir() and not project_dir.is_symlink()
        ]
        return sorted(projects, key=lambda project: project.updated_at, reverse=True)

    def get_emoticon_project(self, slug: str) -> EmoticonProjectDetail | None:
        emoticon_dir = self.content_dir / "emoticon"
        if not emoticon_dir.is_dir():
            return None

        project_dir = next(
            (
                candidate
                for candidate in emoticon_dir.iterdir()
                if candidate.name == slug and candidate.is_dir() and not candidate.is_symlink()
            ),
            None,
        )
        if project_dir is None:
            return None

        contents = {
            name.removesuffix(".md"): self._read_file(project_dir / name)
            for name in EMOTICON_CHARACTER_FILES
        }
        return EmoticonProjectDetail(
            slug=project_dir.name,
            character=contents["character"],
            research=contents["research"],
            qa=contents["qa"],
            friends=contents["friends"],
            review=contents["review"],
            sets=self._emoticon_set_details(project_dir),
        )

    def list_documents(self, kind: str, slug: str) -> list[ContentDocument] | None:
        project_dir = self._project_dir(kind, slug)
        if project_dir is None:
            return None
        return [
            ContentDocument(
                filename=path.name,
                content=path.read_text(encoding="utf-8"),
                updated_at=datetime.fromtimestamp(path.stat().st_mtime, tz=UTC).isoformat(),
            )
            for path in sorted(project_dir.glob("*.md"), key=lambda item: item.name)
            if self._is_safe_file(path)
        ]

    def save_document(
        self,
        kind: str,
        slug: str,
        filename: str,
        content: str,
    ) -> ContentDocument | None:
        project_dir = self._project_dir(kind, slug)
        if project_dir is None:
            return None
        if not SAFE_MARKDOWN_FILENAME.fullmatch(filename):
            raise ValueError("Only a safe Markdown filename is allowed.")

        target = project_dir / filename
        if target.exists() and (not target.is_file() or target.is_symlink()):
            raise ValueError("The document target is not a regular file.")
        temporary = project_dir / f".{filename}.tmp"
        temporary.write_text(content, encoding="utf-8", newline="\n")
        temporary.replace(target)
        return ContentDocument(
            filename=target.name,
            content=content,
            updated_at=datetime.fromtimestamp(target.stat().st_mtime, tz=UTC).isoformat(),
        )

    def _project_dir(self, kind: str, slug: str) -> Path | None:
        if kind not in {"youtube", "emoticon"}:
            return None
        parent = self.content_dir / kind
        if not parent.is_dir():
            return None
        return next(
            (
                candidate
                for candidate in parent.iterdir()
                if candidate.name == slug and candidate.is_dir() and not candidate.is_symlink()
            ),
            None,
        )

    def _emoticon_summary(self, project_dir: Path) -> EmoticonProjectSummary:
        files = {name: self._is_safe_file(project_dir / name) for name in EMOTICON_CHARACTER_FILES}
        sets = self._emoticon_set_summaries(project_dir)
        tracked_files = [
            path
            for pattern in (
                *EMOTICON_CHARACTER_FILES,
                "set-*.md",
                "submission-checklist*.md",
                "submission-copy*.md",
            )
            for path in project_dir.glob(pattern)
            if self._is_safe_file(path)
        ]
        latest_mtime = max((path.stat().st_mtime for path in tracked_files), default=None)
        updated_at = (
            datetime.fromtimestamp(latest_mtime, tz=UTC).isoformat()
            if latest_mtime is not None
            else ""
        )
        return EmoticonProjectSummary(
            slug=project_dir.name,
            has_character=files["character.md"],
            has_research=files["research.md"],
            has_qa=files["qa.md"],
            has_friends=files["friends.md"],
            has_review=files["review.md"],
            sets=sets,
            updated_at=updated_at,
        )

    def _emoticon_set_summaries(self, project_dir: Path) -> list[EmoticonSetSummary]:
        return [
            EmoticonSetSummary(
                set_key=set_key,
                has_set_doc=self._is_safe_file(set_path),
                has_submission_checklist=self._is_safe_file(
                    self._emoticon_submission_path(project_dir, "submission-checklist", set_key)
                ),
                has_submission_copy=self._is_safe_file(
                    self._emoticon_submission_path(project_dir, "submission-copy", set_key)
                ),
            )
            for set_key, set_path in self._emoticon_set_files(project_dir)
        ]

    def _emoticon_set_details(self, project_dir: Path) -> list[EmoticonSetDetail]:
        return [
            EmoticonSetDetail(
                set_key=set_key,
                set_doc=self._read_file(set_path),
                submission_checklist=self._read_file(
                    self._emoticon_submission_path(project_dir, "submission-checklist", set_key)
                ),
                submission_copy=self._read_file(
                    self._emoticon_submission_path(project_dir, "submission-copy", set_key)
                ),
            )
            for set_key, set_path in self._emoticon_set_files(project_dir)
        ]

    def _emoticon_set_files(self, project_dir: Path) -> list[tuple[str, Path]]:
        set_files = sorted(
            (path for path in project_dir.glob("set-*.md") if self._is_safe_file(path)),
            key=lambda path: path.name,
        )
        return [
            (set_path.name.removeprefix("set-").removesuffix(".md"), set_path)
            for set_path in set_files
        ]

    def _emoticon_submission_path(self, project_dir: Path, prefix: str, set_key: str) -> Path:
        set_name = re.sub(r"-\d+$", "", set_key)
        set_specific_path = project_dir / f"{prefix}-{set_name}.md"
        if self._is_safe_file(set_specific_path):
            return set_specific_path
        return project_dir / f"{prefix}.md"

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
