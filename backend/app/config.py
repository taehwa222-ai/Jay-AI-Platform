from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class Settings(BaseSettings):
    app_name: str = "Jay Stock AI Server"
    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    data_dir: Path = DEFAULT_DATA_DIR

    default_tickers: str = "AAPL,MSFT,NVDA,TSLA,AMD,META,GOOGL,AMZN"
    default_volume_multiplier: float = 2.0

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = Field(default="")

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def default_ticker_list(self) -> list[str]:
        return [
            ticker.strip().upper()
            for ticker in self.default_tickers.split(",")
            if ticker.strip()
        ]

    @property
    def has_model_provider(self) -> bool:
        return bool(self.openai_api_key and self.openai_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
