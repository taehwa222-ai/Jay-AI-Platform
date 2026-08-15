# ruff: noqa: E402, I001

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.services.backup import (
    backup_database,
    main,
    prune_backups,
    restore_database,
    verify_database,
    verify_restore,
)

__all__ = [
    "backup_database",
    "main",
    "prune_backups",
    "restore_database",
    "verify_database",
    "verify_restore",
]


if __name__ == "__main__":
    raise SystemExit(main())
