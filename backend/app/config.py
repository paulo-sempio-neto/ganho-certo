from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GanhoCerto"
    environment: str = "local"
    database_url: str = "postgresql+psycopg://ganhocerto:change_me@localhost:5432/ganhocerto"

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
