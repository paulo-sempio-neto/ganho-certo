from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User


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


def test_register_user(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": "PAULO@EMAIL.COM", "password": "senha123"},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Paulo"
    assert response.json()["email"] == "paulo@email.com"
    assert "password" not in response.json()
    assert "password_hash" not in response.json()


def test_register_user_with_duplicate_email(client: TestClient) -> None:
    payload = {"name": "Paulo", "email": "paulo@email.com", "password": "senha123"}

    first_response = client.post("/auth/register", json=payload)
    second_response = client.post("/auth/register", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 409


def test_password_is_not_stored_as_plain_text(client: TestClient, db_session: Session) -> None:
    password = "senha123"

    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": "paulo@email.com", "password": password},
    )
    user = db_session.scalar(select(User).where(User.email == "paulo@email.com"))

    assert response.status_code == 201
    assert user is not None
    assert user.password_hash != password


def test_register_response_does_not_expose_password_hash(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": "paulo@email.com", "password": "senha123"},
    )

    assert response.status_code == 201
    assert "password_hash" not in response.json()
