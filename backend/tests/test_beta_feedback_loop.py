from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.database import Base, get_db
from app.main import create_app
from app.models import BetaFeedback, User

BETA_ADMIN_TOKEN = "beta-admin-token-with-at-least-32-chars"


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
    application = create_app(
        Settings(
            app_env="local",
            jwt_secret_key="test_secret_key_with_at_least_32_chars",
            beta_admin_token=BETA_ADMIN_TOKEN,
        )
    )

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db

    with TestClient(application) as test_client:
        yield test_client

    application.dependency_overrides.clear()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "User-Agent": "GanhoCerto beta tester"}


def admin_headers() -> dict[str, str]:
    return {"X-Beta-Admin-Token": BETA_ADMIN_TOKEN}


def register_and_login(client: TestClient, email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"name": "Beta", "email": email, "password": "senha123"},
    )
    assert response.status_code == 201
    login_response = client.post("/auth/login", json={"email": email, "password": "senha123"})
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def test_feedback_creation_defaults_and_redacts_money(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "feedback-loop@email.com")

    response = client.post(
        "/feedback",
        json={
            "category": "bug",
            "message": "A tela mostrou R$ 1.234,56 no lugar errado.",
            "path": "/#resultado",
        },
        headers=auth_headers(token),
    )

    user = get_user(db_session, "feedback-loop@email.com")
    stored_feedback = db_session.scalar(
        select(BetaFeedback).where(BetaFeedback.user_id == user.id)
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["priority"] == "normal"
    assert payload["status"] == "open"
    assert payload["resolved_at"] is None
    assert "R$ 1.234,56" not in payload["message"]
    assert "[valor removido]" in payload["message"]
    assert stored_feedback is not None
    assert stored_feedback.message == payload["message"]


def test_internal_feedback_summary_is_admin_only_and_aggregated(
    client: TestClient,
) -> None:
    first_token = register_and_login(client, "feedback-summary-a@email.com")
    second_token = register_and_login(client, "feedback-summary-b@email.com")
    client.post(
        "/feedback",
        json={"category": "bug", "message": "Botao nao respondeu ao toque."},
        headers=auth_headers(first_token),
    )
    client.post(
        "/feedback",
        json={"category": "idea", "message": "Seria bom comparar semanas."},
        headers=auth_headers(second_token),
    )

    no_token_response = client.get("/internal/beta/feedback")
    wrong_token_response = client.get(
        "/internal/beta/feedback",
        headers={"X-Beta-Admin-Token": "wrong-token"},
    )
    summary_response = client.get("/internal/beta/feedback", headers=admin_headers())

    assert no_token_response.status_code == 403
    assert wrong_token_response.status_code == 403
    assert summary_response.status_code == 200
    payload = summary_response.json()
    assert payload["total_feedback"] == 2
    assert payload["open_feedback"] == 2
    assert payload["by_category"] == {"bug": 1, "idea": 1}
    assert payload["by_status"] == {"open": 2}
    assert payload["by_priority"] == {"normal": 2}
    assert len(payload["recent_feedback"]) == 2
    assert "feedback-summary-a@email.com" not in summary_response.text


def test_internal_feedback_status_and_priority_can_be_updated(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "feedback-update@email.com")
    create_response = client.post(
        "/feedback",
        json={"category": "confusing", "message": "Nao entendi o historico avancado."},
        headers=auth_headers(token),
    )
    feedback_id = int(create_response.json()["id"])

    update_response = client.patch(
        f"/internal/beta/feedback/{feedback_id}",
        json={"status": "resolved", "priority": "high", "category": "bug"},
        headers=admin_headers(),
    )

    stored_feedback = db_session.get(BetaFeedback, feedback_id)
    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["status"] == "resolved"
    assert payload["priority"] == "high"
    assert payload["category"] == "bug"
    assert payload["resolved_at"] is not None
    assert stored_feedback is not None
    assert stored_feedback.status == "resolved"
    assert stored_feedback.priority == "high"
    assert stored_feedback.resolved_at is not None


def test_reopening_feedback_clears_resolved_at(client: TestClient) -> None:
    token = register_and_login(client, "feedback-reopen@email.com")
    create_response = client.post(
        "/feedback",
        json={"category": "bug", "message": "Mensagem para reabrir depois."},
        headers=auth_headers(token),
    )
    feedback_id = int(create_response.json()["id"])
    client.patch(
        f"/internal/beta/feedback/{feedback_id}",
        json={"status": "resolved"},
        headers=admin_headers(),
    )

    reopen_response = client.patch(
        f"/internal/beta/feedback/{feedback_id}",
        json={"status": "reviewing"},
        headers=admin_headers(),
    )

    assert reopen_response.status_code == 200
    assert reopen_response.json()["status"] == "reviewing"
    assert reopen_response.json()["resolved_at"] is None


def test_normal_user_cannot_access_internal_feedback_management(
    client: TestClient,
) -> None:
    token = register_and_login(client, "feedback-normal-user@email.com")
    create_response = client.post(
        "/feedback",
        json={"category": "idea", "message": "Quero ver ganhos por semana."},
        headers=auth_headers(token),
    )
    feedback_id = int(create_response.json()["id"])

    list_response = client.get("/internal/beta/feedback", headers=auth_headers(token))
    update_response = client.patch(
        f"/internal/beta/feedback/{feedback_id}",
        json={"status": "resolved"},
        headers=auth_headers(token),
    )

    assert list_response.status_code == 403
    assert update_response.status_code == 403


def test_internal_feedback_management_is_disabled_without_admin_token(
    db_session: Session,
) -> None:
    application = create_app(
        Settings(app_env="local", jwt_secret_key="test_secret_key_with_at_least_32_chars")
    )

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db

    with TestClient(application) as test_client:
        response = test_client.get("/internal/beta/feedback", headers=admin_headers())

    application.dependency_overrides.clear()
    assert response.status_code == 404
