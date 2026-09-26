from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app

STRONG_SECRET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def test_local_app_keeps_api_docs_enabled() -> None:
    application = create_app(Settings(app_env="local", jwt_secret_key=STRONG_SECRET))

    with TestClient(application) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200


def test_production_app_disables_public_api_docs() -> None:
    application = create_app(Settings(
        app_env="production", jwt_secret_key=STRONG_SECRET,
        database_url="postgresql+psycopg://example:example@db.example.com/app",
        cors_allowed_origins="https://app.example.com",
        frontend_base_url="https://app.example.com",
        allowed_hosts="testserver", smtp_host="smtp.example.com",
        smtp_from_email="support@example.com",
    ))

    with TestClient(application) as client:
        docs_response = client.get("/docs")
        redoc_response = client.get("/redoc")
        openapi_response = client.get("/openapi.json")
        health_response = client.get("/health")

    assert docs_response.status_code == 404
    assert redoc_response.status_code == 404
    assert openapi_response.status_code == 404
    assert health_response.status_code == 200


@pytest.mark.parametrize(
    "jwt_secret",
    [
        "change_me_to_a_long_random_secret_at_least_32_chars",
        "a" * 48,
        "short_secret_with_at_least_32_chars",
    ],
)
def test_production_rejects_known_or_weak_jwt_secret(jwt_secret: str) -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret_key=jwt_secret)


def test_billing_defaults_to_disabled() -> None:
    settings = Settings(app_env="local", jwt_secret_key=STRONG_SECRET)

    assert settings.billing_provider == "none"
    assert settings.billing_secret_key is None


def test_production_requires_billing_secret_only_when_provider_enabled() -> None:
    Settings(
        app_env="production",
        jwt_secret_key=STRONG_SECRET,
        database_url="postgresql+psycopg://example:example@db.example.com/app",
        cors_allowed_origins="https://app.example.com",
        frontend_base_url="https://app.example.com",
        allowed_hosts="testserver",
        smtp_host="smtp.example.com",
        smtp_from_email="support@example.com",
        billing_provider="none",
    )

    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            jwt_secret_key=STRONG_SECRET,
            database_url="postgresql+psycopg://example:example@db.example.com/app",
            cors_allowed_origins="https://app.example.com",
            frontend_base_url="https://app.example.com",
            allowed_hosts="testserver",
            smtp_host="smtp.example.com",
            smtp_from_email="support@example.com",
            billing_provider="stripe",
        )


def test_unknown_billing_provider_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="local", jwt_secret_key=STRONG_SECRET, billing_provider="unknown")


def test_production_requires_mercadopago_credentials_when_enabled() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            jwt_secret_key=STRONG_SECRET,
            database_url="postgresql+psycopg://example:example@db.example.com/app",
            cors_allowed_origins="https://app.example.com",
            frontend_base_url="https://app.example.com",
            allowed_hosts="testserver",
            smtp_host="smtp.example.com",
            smtp_from_email="support@example.com",
            billing_provider="mercado_pago",
            mercadopago_webhook_secret="webhook_secret",
            billing_pro_monthly_amount=Decimal("29.90"),
        )


def test_production_accepts_mercadopago_specific_secret() -> None:
    settings = Settings(
        app_env="production",
        jwt_secret_key=STRONG_SECRET,
        database_url="postgresql+psycopg://example:example@db.example.com/app",
        cors_allowed_origins="https://app.example.com",
        frontend_base_url="https://app.example.com",
        allowed_hosts="testserver",
        smtp_host="smtp.example.com",
        smtp_from_email="support@example.com",
        billing_provider="mercado_pago",
        mercadopago_access_token="APP_USR-test-token",
        mercadopago_webhook_secret="webhook_secret",
        billing_pro_monthly_amount=Decimal("29.90"),
    )

    assert settings.billing_provider == "mercado_pago"
    assert settings.mercadopago_public_key is None
