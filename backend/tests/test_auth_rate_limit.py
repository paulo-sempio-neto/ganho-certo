from collections.abc import Generator
from contextlib import contextmanager

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.database import Base, get_db
from app.main import create_app
from app.rate_limit import auth_rate_limiter

STRONG_SECRET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def auth_test_settings(
    *,
    login_limit: int = 2,
    login_ip_limit: int = 100,
    login_window_seconds: int = 10,
    register_limit: int = 100,
    register_window_seconds: int = 10,
) -> Settings:
    return Settings(
        app_env="local",
        jwt_secret_key=STRONG_SECRET,
        auth_login_rate_limit=login_limit,
        auth_login_ip_rate_limit=login_ip_limit,
        auth_login_rate_window_seconds=login_window_seconds,
        auth_register_rate_limit=register_limit,
        auth_register_rate_window_seconds=register_window_seconds,
    )


@contextmanager
def make_client(settings: Settings) -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as session:
        application = create_app(settings)

        def override_get_db() -> Generator[Session, None, None]:
            yield session

        application.dependency_overrides[get_db] = override_get_db
        with TestClient(application) as test_client:
            yield test_client

        application.dependency_overrides.clear()

    Base.metadata.drop_all(bind=engine)


def register_user(client: TestClient, email: str = "paulo@email.com") -> None:
    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": email, "password": "senha123"},
    )
    assert response.status_code == 201


def test_login_allows_normal_attempts() -> None:
    with make_client(auth_test_settings()) as client:
        register_user(client)

        response = client.post(
            "/auth/login",
            json={"email": "paulo@email.com", "password": "senha123"},
        )

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_returns_429_when_limit_is_exceeded() -> None:
    with make_client(auth_test_settings(login_limit=2)) as client:
        register_user(client)

        for _ in range(2):
            response = client.post(
                "/auth/login",
                json={"email": "paulo@email.com", "password": "senha-errada"},
            )
            assert response.status_code == 401

        limited_response = client.post(
            "/auth/login",
            json={"email": "paulo@email.com", "password": "senha-errada"},
        )

    assert limited_response.status_code == 429
    assert limited_response.headers["Retry-After"]
    assert limited_response.json()["detail"] == (
        "Muitas tentativas. Aguarde alguns instantes e tente novamente."
    )


def test_login_rate_limit_expires_after_window() -> None:
    now: list[float] = [1000.0]
    auth_rate_limiter.set_clock(lambda: now[0])

    with make_client(auth_test_settings(login_limit=1, login_window_seconds=10)) as client:
        register_user(client)

        first_response = client.post(
            "/auth/login",
            json={"email": "paulo@email.com", "password": "senha-errada"},
        )
        second_response = client.post(
            "/auth/login",
            json={"email": "paulo@email.com", "password": "senha-errada"},
        )

        now[0] += 11
        reset_response = client.post(
            "/auth/login",
            json={"email": "paulo@email.com", "password": "senha-errada"},
        )

    assert first_response.status_code == 401
    assert second_response.status_code == 429
    assert reset_response.status_code == 401


def test_register_returns_429_when_limit_is_exceeded() -> None:
    with make_client(auth_test_settings(register_limit=1)) as client:
        first_response = client.post(
            "/auth/register",
            json={"name": "Paulo", "email": "paulo@email.com", "password": "senha123"},
        )
        limited_response = client.post(
            "/auth/register",
            json={"name": "Ana", "email": "ana@email.com", "password": "senha123"},
        )

    assert first_response.status_code == 201
    assert limited_response.status_code == 429
    assert limited_response.json()["detail"] == (
        "Muitas tentativas. Aguarde alguns instantes e tente novamente."
    )
