from __future__ import annotations

import argparse
import os
import sqlite3
import tempfile
import time
from contextlib import closing
from datetime import datetime, timedelta
from pathlib import Path

DATABASE_NAME = "jay_ai_platform.db"
BACKUP_PREFIX = "jay_ai_platform-"


def verify_database(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"Database not found: {path}")

    source_uri = f"file:{path.resolve().as_posix()}?mode=ro"
    with closing(sqlite3.connect(source_uri, uri=True)) as connection:
        result = connection.execute("PRAGMA integrity_check").fetchone()
    if result is None or result[0] != "ok":
        detail = result[0] if result else "no result"
        raise sqlite3.DatabaseError(f"Integrity check failed for {path}: {detail}")


def restore_database(backup_path: Path, destination: Path) -> Path:
    if destination.exists():
        raise FileExistsError(f"Restore destination already exists: {destination}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    source_uri = f"file:{backup_path.resolve().as_posix()}?mode=ro"
    try:
        with (
            closing(sqlite3.connect(source_uri, uri=True)) as source_connection,
            closing(sqlite3.connect(destination)) as destination_connection,
        ):
            source_connection.backup(destination_connection)
        verify_database(destination)
    except (OSError, sqlite3.Error):
        destination.unlink(missing_ok=True)
        raise
    return destination


def verify_restore(backup_path: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="jay-ai-restore-check-") as temporary_dir:
        restore_database(backup_path, Path(temporary_dir) / DATABASE_NAME)


def prune_backups(
    backup_dir: Path,
    retention_days: int,
    *,
    now: datetime | None = None,
) -> list[Path]:
    if retention_days < 1:
        raise ValueError("retention_days must be at least 1")

    cutoff = (now or datetime.now()) - timedelta(days=retention_days)
    removed: list[Path] = []
    for candidate in backup_dir.glob(f"{BACKUP_PREFIX}*.db"):
        modified_at = datetime.fromtimestamp(candidate.stat().st_mtime)
        if modified_at < cutoff:
            candidate.unlink()
            removed.append(candidate)
    return removed


def backup_database(data_dir: Path, backup_dir: Path | None = None) -> tuple[Path, bool]:
    source = data_dir / DATABASE_NAME
    if not source.is_file():
        raise FileNotFoundError(f"Database not found: {source}")

    destination_dir = backup_dir or data_dir / "backups"
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"{BACKUP_PREFIX}{datetime.now().strftime('%Y%m%d')}.db"
    if destination.exists():
        verify_database(destination)
        return destination, False

    source_uri = f"file:{source.resolve().as_posix()}?mode=ro"
    try:
        with (
            closing(sqlite3.connect(source_uri, uri=True)) as source_connection,
            closing(sqlite3.connect(destination)) as destination_connection,
        ):
            source_connection.backup(destination_connection)
        verify_database(destination)
    except (OSError, sqlite3.Error):
        destination.unlink(missing_ok=True)
        raise
    return destination, True


def run_backup(
    data_dir: Path,
    backup_dir: Path | None,
    retention_days: int,
    restore_check: bool,
) -> Path:
    destination, created = backup_database(data_dir, backup_dir)
    if restore_check:
        verify_restore(destination)
    removed = prune_backups(destination.parent, retention_days)

    action = "Created" if created else "Already exists for today"
    print(f"{action}: {destination}", flush=True)
    print(f"Restore check: {'passed' if restore_check else 'skipped'}", flush=True)
    print(f"Expired backups removed: {len(removed)}", flush=True)
    return destination


def parse_args() -> argparse.Namespace:
    configured_data_dir = os.environ.get("DATA_DIR")
    default_data_dir = Path(configured_data_dir) if configured_data_dir else Path("data")
    parser = argparse.ArgumentParser(
        description="Create, verify, and retain consistent Jay AI SQLite backups."
    )
    parser.add_argument("--data-dir", type=Path, default=default_data_dir)
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--retention-days", type=int, default=30)
    parser.add_argument(
        "--no-restore-check",
        action="store_true",
        help="Skip restoring the backup into a temporary database for verification.",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        help="Run continuously at this interval; omit for a single backup.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.interval_seconds is not None and args.interval_seconds < 60:
        print("Backup failed: interval_seconds must be at least 60", flush=True)
        return 1

    while True:
        try:
            run_backup(
                args.data_dir,
                args.backup_dir,
                args.retention_days,
                not args.no_restore_check,
            )
        except (FileNotFoundError, FileExistsError, OSError, ValueError, sqlite3.Error) as exc:
            print(f"Backup failed: {exc}", flush=True)
            if args.interval_seconds is None:
                return 1

        if args.interval_seconds is None:
            return 0
        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
