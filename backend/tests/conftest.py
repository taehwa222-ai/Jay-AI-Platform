import shutil
import tempfile
from pathlib import Path

import pytest

from app.config import get_settings


@pytest.fixture(autouse=True)
def isolated_data_dir(monkeypatch):
    base_dir = Path(__file__).resolve().parents[2] / ".test-data"
    base_dir.mkdir(exist_ok=True)
    data_dir = Path(tempfile.mkdtemp(prefix="jay-ai-platform-", dir=base_dir))
    settings = get_settings()
    monkeypatch.setattr(settings, "data_dir", data_dir)
    monkeypatch.setattr(settings, "auth_secret_key", "test-secret-key")
    yield
    shutil.rmtree(data_dir, ignore_errors=True)
