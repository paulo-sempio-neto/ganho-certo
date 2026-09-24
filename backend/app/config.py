from functools import lru_cache

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GanhoCerto"
    app_env: str = Field(default="local", validation_alias=AliasChoices("APP_ENV", "ENVIRONMENT"))
    app_host: str = Field(default="0.0.0.0", validation_alias=AliasChoices("HOST", "APP_HOST"))
    app_port: int = Field(default=8000, validation_alias=AliasChoices("PORT", "APP_PORT"))
    database_url: str = Field(
        default="postgresql+psycopg://ganhocerto:change_me@localhost:5432/ganhocerto",
        validation_alias="DATABASE_URL",
    )
    jwt_secret_key: str = Field(
        min_length=32,
        validation_alias=AliasChoices("JWT_SECRET", "JWT_SECRET_KEY"),
    )
    jwt_access_token_expire_minutes: int = 30
    auth_login_rate_limit: int = Field(default=10, ge=0, validation_alias="AUTH_LOGIN_RATE_LIMIT")
    auth_login_ip_rate_limit: int = Field(
        default=60,
        ge=0,
        validation_alias="AUTH_LOGIN_IP_RATE_LIMIT",
    )
    auth_login_rate_window_seconds: int = Field(
        default=60,
        ge=1,
        validation_alias="AUTH_LOGIN_RATE_WINDOW_SECONDS",
    )
    auth_register_rate_limit: int = Field(
        default=5,
        ge=0,
        validation_alias="AUTH_REGISTER_RATE_LIMIT",
    )
    auth_register_rate_window_seconds: int = Field(
        default=300,
        ge=1,
        validation_alias="AUTH_REGISTER_RATE_WINDOW_SECONDS",
    )
    auth_rate_limit_max_entries: int = Field(
        default=5000,
        ge=100,
        validation_alias="AUTH_RATE_LIMIT_MAX_ENTRIES",
    )
    cors_allowed_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias=AliasChoices("CORS_ALLOWED_ORIGINS", "BACKEND_CORS_ORIGINS"),
    )

    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    @property
    def environment(self) -> str:
        return self.app_env

    @property
    def backend_cors_origins(self) -> str:
        return self.cors_allowed_origins

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)

        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)

        return value

    @model_validator(mode="after")
    def validate_production_safety(self) -> "Settings":
        is_production = self.app_env.lower() in {"production", "prod"}
        unsafe_jwt_secrets = {
            "change_me_to_a_long_random_secret_at_least_32_chars",
            "test_secret_key_with_at_least_32_chars",
        }

        if is_production and self.jwt_secret_key in unsafe_jwt_secrets:
            raise ValueError("JWT_SECRET must be a strong secret in production.")

        if is_production and len(self.jwt_secret_key) < 48:
            raise ValueError("JWT_SECRET must have at least 48 characters in production.")

        if is_production and len(set(self.jwt_secret_key)) < 12:
            raise ValueError("JWT_SECRET must have enough character diversity in production.")

        if is_production and "*" in self.cors_origins:
            raise ValueError("CORS_ALLOWED_ORIGINS cannot contain '*' in production.")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
