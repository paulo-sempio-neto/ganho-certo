from functools import lru_cache
from ipaddress import ip_network
from urllib.parse import urlsplit

from pydantic import AliasChoices, EmailStr, Field, TypeAdapter, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

from app.billing_config import BILLING_PROVIDER_NONE, SUPPORTED_BILLING_PROVIDERS


def valid_origin(value: str, *, production: bool) -> bool:
    try:
        parsed = urlsplit(value)
        return bool(
            parsed.scheme in ({"https"} if production else {"http", "https"})
            and parsed.hostname
            and not any(char.isspace() for char in value)
            and not any(char in value for char in ("*", "\\", "?", "#"))
            and not parsed.username
            and not parsed.password
            and not parsed.path
            and (parsed.port is None or 1 <= parsed.port <= 65535)
        )
    except ValueError:
        return False


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
    password_reset_token_expire_minutes: int = Field(
        default=30,
        ge=1,
        validation_alias="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES",
    )
    frontend_base_url: str = Field(
        default="http://localhost:5173",
        validation_alias="FRONTEND_BASE_URL",
    )
    billing_provider: str = Field(
        default=BILLING_PROVIDER_NONE,
        validation_alias="BILLING_PROVIDER",
    )
    billing_secret_key: str | None = Field(default=None, validation_alias="BILLING_SECRET_KEY")
    smtp_host: str | None = Field(default=None, validation_alias="SMTP_HOST")
    smtp_port: int = Field(default=587, ge=1, le=65535, validation_alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, validation_alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, validation_alias="SMTP_PASSWORD")
    smtp_from_email: str | None = Field(default=None, validation_alias="SMTP_FROM_EMAIL")
    smtp_use_tls: bool = Field(default=True, validation_alias="SMTP_USE_TLS")
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    forwarded_allow_ips: str = "127.0.0.1"
    max_request_body_bytes: int = Field(default=1024 * 1024, ge=1024)

    model_config = SettingsConfigDict(
        env_file="../.env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True,
    )

    @property
    def trusted_hosts(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]

    @field_validator("app_env")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"local", "development", "test", "staging", "production", "prod"}:
            raise ValueError("APP_ENV is invalid.")
        return value

    @field_validator("forwarded_allow_ips")
    @classmethod
    def validate_proxy_networks(cls, value: str) -> str:
        for network in value.split(","):
            if not network.strip():
                continue
            try:
                if ip_network(network.strip()).prefixlen == 0:
                    raise ValueError
            except ValueError:
                raise ValueError(
                    "FORWARDED_ALLOW_IPS must contain explicit IPs or CIDRs."
                ) from None
        return value

    @field_validator("billing_provider")
    @classmethod
    def validate_billing_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in SUPPORTED_BILLING_PROVIDERS:
            raise ValueError("BILLING_PROVIDER is invalid.")
        return normalized

    @property
    def environment(self) -> str:
        return self.app_env

    @property
    def backend_cors_origins(self) -> str:
        return self.cors_allowed_origins

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

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

        if (
            is_production
            and self.billing_provider != BILLING_PROVIDER_NONE
            and not self.billing_secret_key
        ):
            raise ValueError(
                "BILLING_SECRET_KEY must be configured when billing is enabled in production."
            )

        if not self.cors_origins or any(
            not valid_origin(origin, production=is_production) for origin in self.cors_origins
        ):
            raise ValueError("CORS_ALLOWED_ORIGINS must contain valid explicit origins.")

        if not valid_origin(self.frontend_base_url.rstrip("/"), production=is_production):
            raise ValueError("FRONTEND_BASE_URL must be a valid frontend origin.")

        if not self.trusted_hosts or any(
            not valid_origin(f"https://{host}", production=True) or ":" in host
            for host in self.trusted_hosts
        ):
            raise ValueError("ALLOWED_HOSTS must contain explicit hostnames without ports.")

        if is_production:
            try:
                database = make_url(self.database_url)
                safe_database = (
                    database.drivername == "postgresql+psycopg"
                    and database.host
                    and database.database
                    and database.password != "change_me"
                )
            except Exception:
                safe_database = False
            if not safe_database:
                raise ValueError("DATABASE_URL must configure a production PostgreSQL database.")
            if self.allowed_hosts == "localhost,127.0.0.1,testserver":
                raise ValueError("ALLOWED_HOSTS must be configured in production.")
            if not self.smtp_host or not self.smtp_from_email or not self.smtp_use_tls:
                raise ValueError(
                    "Production password recovery requires SMTP_HOST, SMTP_FROM_EMAIL and TLS."
                )
            if bool(self.smtp_username) != bool(self.smtp_password):
                raise ValueError("SMTP_USERNAME and SMTP_PASSWORD must be configured together.")
            if not valid_origin(f"https://{self.smtp_host}", production=True):
                raise ValueError("SMTP_HOST must be a valid hostname.")
            try:
                TypeAdapter(EmailStr).validate_python(self.smtp_from_email)
            except ValueError:
                raise ValueError("SMTP_FROM_EMAIL must be a valid email address.") from None

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
