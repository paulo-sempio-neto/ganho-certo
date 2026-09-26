import asyncio
import json
import logging
from collections.abc import Generator
from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from starlette.types import Message
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import Settings
from app.database import get_db
from app.main import create_app
from app.observability import JsonLogFormatter
from app.rate_limit import InMemoryRateLimiter, get_client_ip
from app.request_limits import RequestSizeLimitMiddleware


def production_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "app_env": "production",
        "jwt_secret_key": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        "database_url": "postgresql+psycopg://example:example@db.example.com/app",
        "cors_allowed_origins": "https://app.example.com",
        "frontend_base_url": "https://app.example.com",
        "allowed_hosts": "testserver",
        "smtp_host": "smtp.example.com",
        "smtp_from_email": "support@example.com",
        "smtp_username": "",
        "smtp_password": "",
        "smtp_use_tls": True,
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize("request_id", ["report_123-abc", "", "a" * 10000, "bad id", "bad\nvalue"])
def test_request_ids_are_safe(request_id: str) -> None:
    with TestClient(create_app(production_settings())) as client:
        response = client.get("/health", headers={"X-Request-ID": request_id})
    value = response.headers["X-Request-ID"]
    assert 1 <= len(value) <= 64
    assert all(char.isalnum() or char in "_-" for char in value)
    if request_id == "report_123-abc":
        assert value == request_id
    else:
        assert value != request_id


def test_structured_logs_and_safe_database_failure(caplog: pytest.LogCaptureFixture) -> None:
    application = create_app(production_settings())
    secret = "private-password-reset-token-and-database-credentials"

    def failed_db() -> Generator[Session, None, None]:
        raise OperationalError("SELECT sensitive_sql", {"password": secret}, Exception(secret))
        yield  # pragma: no cover

    application.dependency_overrides[get_db] = failed_db
    with caplog.at_level(logging.INFO, logger="app.api"), TestClient(application) as client:
        response = client.post(
            "/auth/login?token=" + secret,
            json={"email": "user@example.com", "password": secret},
            headers={"Origin": "https://app.example.com", "Authorization": "Bearer " + secret},
        )
        assert client.get("/health").status_code == 200

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "https://app.example.com"
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    records = [record for record in caplog.records if record.name == "app.api"]
    logs = [json.loads(JsonLogFormatter().format(record)) for record in records]
    serialized = json.dumps(logs)
    assert secret not in serialized + response.text
    assert "sensitive_sql" not in serialized + response.text
    error = next(log for log in logs if "exception_type" in log)
    assert error["exception_type"] == "OperationalError"
    assert error["stack_trace"]
    assert error["request_id"] == response.headers["X-Request-ID"]
    completed = next(log for log in logs if log.get("status_code") == 500)
    assert completed["path"] == "/auth/login"
    assert completed["method"] == "POST"
    assert completed["duration_ms"] >= 0
    assert completed["timestamp"]
    assert completed["level"] == "INFO"


@pytest.mark.parametrize("healthy", [True, False])
def test_readiness(healthy: bool, caplog: pytest.LogCaptureFixture) -> None:
    application = create_app(production_settings())
    engine = create_engine("sqlite://")

    def database() -> Generator[Session, None, None]:
        with Session(engine) as session:
            if not healthy:
                session.execute = MagicMock(  # type: ignore[method-assign]
                    side_effect=OperationalError("private SQL", {}, Exception("private URL")),
                )
            yield session

    application.dependency_overrides[get_db] = database
    with TestClient(application) as client:
        response = client.get("/ready")
        assert client.get("/health").json() == {"status": "ok"}
    engine.dispose()
    assert response.status_code == (200 if healthy else 503)
    assert response.json() == {"status": "ready" if healthy else "unavailable"}
    assert "private" not in response.text + caplog.text


def test_headers_hosts_and_cors() -> None:
    with TestClient(create_app(production_settings())) as client:
        allowed = client.get("/health", headers={"Origin": "https://app.example.com"})
        denied = client.get("/health", headers={"Origin": "https://attacker.example.com"})
        invalid_host = client.get("/health", headers={"Host": "attacker.example.com"})
        preflight = client.options("/auth/login", headers={
            "Origin": "https://app.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        })
    assert allowed.headers["access-control-allow-origin"] == "https://app.example.com"
    assert allowed.headers["access-control-expose-headers"] == "X-Request-ID"
    assert "access-control-allow-credentials" not in allowed.headers
    assert "access-control-allow-origin" not in denied.headers
    assert invalid_host.status_code == 400
    assert preflight.status_code == 200
    for response in (allowed, denied, invalid_host, preflight):
        assert response.headers["X-Request-ID"]
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["Referrer-Policy"] == "no-referrer"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Permissions-Policy"] == "camera=(), microphone=(), geolocation=()"


@pytest.mark.parametrize(("setting", "value"), [
    ("app_env", "prodution"), ("cors_allowed_origins", "*"),
    ("cors_allowed_origins", "https://app.example.com/path"),
    ("cors_allowed_origins", "https://user:password@app.example.com"),
    ("cors_allowed_origins", "https://app.example.com:invalid"),
    ("cors_allowed_origins", ""), ("cors_allowed_origins", "http://app.example.com"),
    ("frontend_base_url", "http://localhost:5173"),
    ("database_url", "not-a-url-with-private-secret"),
    ("database_url", "postgresql+psycopg://user:change_me@host/db"),
    ("allowed_hosts", "*"), ("forwarded_allow_ips", "*"),
    ("forwarded_allow_ips", "0.0.0.0/0"), ("forwarded_allow_ips", "::/0"),
    ("smtp_host", ""), ("smtp_use_tls", False),
    ("smtp_host", "invalid host"), ("smtp_from_email", "invalid"),
    ("smtp_password", "private-secret"),
])
def test_unsafe_production_config_fails_without_secrets(setting: str, value: Any) -> None:
    with pytest.raises(ValidationError) as error:
        production_settings(**{setting: value})
    assert "private-secret" not in str(error.value)
    assert "abcdefghijklmnopqrstuvwxyz" not in str(error.value)


def test_request_size_limit_counts_streamed_bytes() -> None:
    async def run() -> None:
        reached = False
        messages: list[Message] = []

        async def downstream(scope: Any, receive: Any, send: Any) -> None:
            nonlocal reached
            reached = True

        chunks = iter([
            {"type": "http.request", "body": b"1234", "more_body": True},
            {"type": "http.request", "body": b"5678", "more_body": False},
        ])

        async def receive() -> Message:
            return next(chunks)

        async def send(message: Message) -> None:
            messages.append(message)

        await RequestSizeLimitMiddleware(downstream, max_bytes=6)(
            {"type": "http", "path": "/auth/login", "headers": [(b"content-length", b"1")]},
            receive, send,
        )
        assert not reached
        assert messages[0]["status"] == 413
    asyncio.run(run())


def test_large_json_is_rejected_with_request_id() -> None:
    with TestClient(create_app(production_settings(max_request_body_bytes=1024))) as client:
        response = client.post("/auth/login", json={"password": "x" * 2048})
    assert response.status_code == 413
    assert response.headers["X-Request-ID"]


def test_limiter_has_strict_capacity_and_keeps_active_limits() -> None:
    now = [0.0]
    limiter = InMemoryRateLimiter(clock=lambda: now[0])
    for key in ("first", "second"):
        assert limiter.hit(key, limit=1, window_seconds=10, max_entries=2).allowed
    assert not limiter.hit("third", limit=1, window_seconds=10, max_entries=2).allowed
    assert not limiter.hit("first", limit=1, window_seconds=10, max_entries=2).allowed
    now[0] = 11
    assert limiter.hit("third", limit=1, window_seconds=10, max_entries=2).allowed


@pytest.mark.parametrize("trusted", [True, False])
def test_forwarded_ip_is_accepted_only_from_configured_proxy(trusted: bool) -> None:
    application = create_app(production_settings())

    @application.get("/client-ip")
    def client_ip(request: Request) -> dict[str, str]:
        return {"ip": get_client_ip(request)}

    # Uvicorn and Starlette publish different, runtime-compatible ASGI type aliases.
    proxied = ProxyHeadersMiddleware(cast(Any, application), trusted_hosts="10.0.0.1")
    peer = "10.0.0.1" if trusted else "192.0.2.10"
    with TestClient(cast(Any, proxied), client=(peer, 1234)) as client:
        response = client.get("/client-ip", headers={"X-Forwarded-For": "198.51.100.20"})
    assert response.json()["ip"] == ("198.51.100.20" if trusted else peer)
