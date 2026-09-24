import logging

from fastapi.testclient import TestClient
from pytest import LogCaptureFixture

from app.config import Settings
from app.main import create_app

STRONG_SECRET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def test_unexpected_errors_return_safe_response_and_request_id(
    caplog: LogCaptureFixture,
) -> None:
    application = create_app(Settings(app_env="local", jwt_secret_key=STRONG_SECRET))

    @application.get("/raise-unexpected-error")
    def raise_unexpected_error() -> None:
        raise RuntimeError("internal implementation detail")

    with caplog.at_level(logging.INFO, logger="app.api"):
        with TestClient(application) as client:
            response = client.get("/raise-unexpected-error")

    body = response.json()
    assert response.status_code == 500
    assert body["detail"] == "Erro interno inesperado. Informe o codigo da requisicao ao suporte."
    assert body["request_id"] == response.headers["X-Request-ID"]
    assert "internal implementation detail" not in response.text
    assert "unexpected_exception" in caplog.text
    assert body["request_id"] in caplog.text


def test_expected_http_errors_keep_their_status_and_message() -> None:
    application = create_app(Settings(app_env="local", jwt_secret_key=STRONG_SECRET))

    with TestClient(application) as client:
        response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
    assert response.headers["X-Request-ID"]
