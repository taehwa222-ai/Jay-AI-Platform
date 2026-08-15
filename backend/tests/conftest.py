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
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "opendart_api_key", "")
    monkeypatch.setattr(settings, "ai_daily_limit", 100)
    monkeypatch.setattr(settings, "telegram_bot_token", "")
    monkeypatch.setattr(settings, "telegram_chat_id", "")
    yield
    shutil.rmtree(data_dir, ignore_errors=True)


@pytest.fixture(autouse=True)
def isolated_content_dir(monkeypatch):
    base_dir = Path(__file__).resolve().parents[2] / ".test-content"
    base_dir.mkdir(exist_ok=True)
    content_dir = Path(tempfile.mkdtemp(prefix="jay-ai-content-", dir=base_dir))
    settings = get_settings()
    monkeypatch.setattr(settings, "content_dir", content_dir)
    yield
    shutil.rmtree(content_dir, ignore_errors=True)
