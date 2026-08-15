from __future__ import annotations

import argparse
import os
import sqlite3
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def backup_database(data_dir: Path, backup_dir: Path | None = None) -> tuple[Path, bool]:
    source = data_dir / "jay_ai_platform.db"
    if not source.is_file():
        raise FileNotFoundError(f"Database not found: {source}")

    destination_dir = backup_dir or data_dir / "backups"
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / f"jay_ai_platform-{datetime.now().strftime('%Y%m%d')}.db"
    if destination.exists():
        return destination, False

    source_uri = f"file:{source.resolve().as_posix()}?mode=ro"
    with sqlite3.connect(source_uri, uri=True) as source_connection:
        with sqlite3.connect(destination) as destination_connection:
            source_connection.backup(destination_connection)
            destination_connection.execute("PRAGMA integrity_check").fetchone()
    return destination, True


def parse_args() -> argparse.Namespace:
    configured_data_dir = os.environ.get("DATA_DIR")
    default_data_dir = Path(configured_data_dir) if configured_data_dir else PROJECT_ROOT / "data"
    parser = argparse.ArgumentParser(
        description="Create at most one consistent Jay AI SQLite backup per day."
    )
    parser.add_argument("--data-dir", type=Path, default=default_data_dir)
    parser.add_argument("--backup-dir", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        destination, created = backup_database(args.data_dir, args.backup_dir)
    except (FileNotFoundError, sqlite3.Error) as exc:
        print(f"Backup failed: {exc}")
        return 1
    action = "Created" if created else "Already exists for today"
    print(f"{action}: {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
