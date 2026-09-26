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
