from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as session:
        yield session

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def register_user(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": "paulo@email.com", "password": "senha123"},
    )
    assert response.status_code == 201


def login_user(
    client: TestClient,
    email: str = "paulo@email.com",
    password: str = "senha123",
) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    return str(body["access_token"])


def test_login_with_valid_credentials(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/auth/login",
        json={"email": "PAULO@EMAIL.COM", "password": "senha123"},
    )

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]


def test_login_with_wrong_password_returns_401(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/auth/login",
        json={"email": "paulo@email.com", "password": "senha-errada"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials."


def test_login_with_unknown_email_returns_401(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"email": "naoexiste@email.com", "password": "senha123"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials."


def test_me_with_valid_token(client: TestClient) -> None:
    register_user(client)
    token = login_user(client)

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "paulo@email.com"
    assert "password_hash" not in response.json()


def test_me_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_me_with_invalid_token_returns_401(client: TestClient) -> None:
    response = client.get("/auth/me", headers={"Authorization": "Bearer invalid-token"})

    assert response.status_code == 401


def test_login_and_me_responses_do_not_expose_password_hash(client: TestClient) -> None:
    register_user(client)
    token = login_user(client)

    login_response = client.post(
        "/auth/login",
        json={"email": "paulo@email.com", "password": "senha123"},
    )
    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert "password_hash" not in login_response.json()
    assert "password_hash" not in me_response.json()
