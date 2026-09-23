from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GanhoCerto"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://ganhocerto:change_me@localhost:5432/ganhocerto"
    jwt_secret_key: str = Field(min_length=32)
    jwt_access_token_expire_minutes: int = 30
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
