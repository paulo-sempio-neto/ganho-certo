from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import BetaFeedback, User


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "User-Agent": "GanhoCerto beta tester"}


def register_and_login(client: TestClient, email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"name": "Beta", "email": email, "password": "senha123"},
    )
    assert response.status_code == 201
    login_response = client.post("/auth/login", json={"email": email, "password": "senha123"})
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


def test_create_feedback_stores_current_user_feedback(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "feedback@email.com")

    response = client.post(
        "/feedback",
        json={
            "category": "confusing",
            "message": "Nao entendi bem o resultado projetado.",
            "path": "/#resultado",
        },
        headers=auth_headers(token),
    )

    user = db_session.scalar(select(User).where(User.email == "feedback@email.com"))
    assert user is not None
    stored_feedback = db_session.scalar(
        select(BetaFeedback).where(BetaFeedback.user_id == user.id)
    )
    assert response.status_code == 201
    assert response.json()["category"] == "confusing"
    assert response.json()["priority"] == "normal"
    assert response.json()["status"] == "open"
    assert response.json()["path"] == "/#resultado"
    assert "user_id" not in response.json()
    assert stored_feedback is not None
    assert stored_feedback.message == "Nao entendi bem o resultado projetado."
    assert stored_feedback.user_agent == "GanhoCerto beta tester"


def test_feedback_requires_authenticated_user(client: TestClient) -> None:
    response = client.post(
        "/feedback",
        json={"category": "bug", "message": "Botao nao respondeu ao toque."},
    )

    assert response.status_code == 401


def test_feedback_validates_message_and_path(client: TestClient) -> None:
    token = register_and_login(client, "feedback-invalid@email.com")

    short_response = client.post(
        "/feedback",
        json={"category": "idea", "message": "curto"},
        headers=auth_headers(token),
    )
    external_path_response = client.post(
        "/feedback",
        json={
            "category": "bug",
            "message": "Mensagem longa o bastante.",
            "path": "https://example.com",
        },
        headers=auth_headers(token),
    )

    assert short_response.status_code == 422
    assert external_path_response.status_code == 422


def test_feedback_is_isolated_by_user(
    client: TestClient,
    db_session: Session,
) -> None:
    first_token = register_and_login(client, "feedback-a@email.com")
    second_token = register_and_login(client, "feedback-b@email.com")

    first_response = client.post(
        "/feedback",
        json={"category": "bug", "message": "Erro apareceu no cadastro."},
        headers=auth_headers(first_token),
    )
    second_response = client.post(
        "/feedback",
        json={"category": "idea", "message": "Quero comparar semanas diferentes."},
        headers=auth_headers(second_token),
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    users = {
        user.email: user.id
        for user in db_session.scalars(
            select(User).where(User.email.in_(["feedback-a@email.com", "feedback-b@email.com"]))
        )
    }
    feedback_by_user = {
        feedback.user_id: feedback.category
        for feedback in db_session.scalars(select(BetaFeedback)).all()
    }
    assert feedback_by_user[users["feedback-a@email.com"]] == "bug"
    assert feedback_by_user[users["feedback-b@email.com"]] == "idea"


# Local fixtures keep this file independent from the many endpoint-specific test modules.
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
