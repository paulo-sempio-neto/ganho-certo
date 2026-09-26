from collections.abc import Generator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.database import Base, get_db
from app.email import EmailDeliveryError
from app.main import app, create_app
from app.models import PasswordResetToken, User
from app.security import hash_token

STRONG_SECRET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
PUBLIC_RESET_MESSAGE = (
    "Se o email estiver cadastrado, enviaremos instrucoes para redefinir a senha."
)


class CapturingPasswordResetSender:
    def __init__(self) -> None:
        self.reset_urls: list[str] = []
        self.recipients: list[str] = []

    def send_password_reset(self, recipient_email: str, reset_url: str) -> None:
        self.recipients.append(recipient_email)
        self.reset_urls.append(reset_url)


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


@contextmanager
def make_client(settings: Settings, db_session: Session) -> Generator[TestClient, None, None]:
    application = create_app(settings)

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db

    with TestClient(application) as test_client:
        yield test_client

    application.dependency_overrides.clear()


def register_user(
    client: TestClient,
    email: str = "paulo@email.com",
    password: str = "senha123",
) -> None:
    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": email, "password": password},
    )
    assert response.status_code == 201


def login_user(
    client: TestClient,
    email: str = "paulo@email.com",
    password: str = "senha123",
) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return str(response.json()["access_token"])


def extract_token_from_reset_url(reset_url: str) -> str:
    query = parse_qs(urlparse(reset_url).query)
    return query["token"][0]


def request_password_reset(client: TestClient, email: str = "paulo@email.com") -> None:
    response = client.post("/auth/forgot-password", json={"email": email})
    assert response.status_code == 200
    assert response.json()["message"] == PUBLIC_RESET_MESSAGE


def test_change_password_success_rejects_old_jwt_and_allows_new_login(
    client: TestClient,
) -> None:
    register_user(client)
    old_token = login_user(client)

    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {old_token}"},
        json={"current_password": "senha123", "new_password": "novaSenha123"},
    )
    old_token_response = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    new_token = login_user(client, password="novaSenha123")
    new_token_response = client.get("/auth/me", headers={"Authorization": f"Bearer {new_token}"})

    assert response.status_code == 200
    assert response.json()["message"] == "Senha alterada com sucesso."
    assert old_token_response.status_code == 401
    assert new_token_response.status_code == 200


def test_change_password_rejects_wrong_current_password(client: TestClient) -> None:
    register_user(client)
    token = login_user(client)

    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "errada", "new_password": "novaSenha123"},
    )

    assert response.status_code == 400


def test_change_password_rejects_invalid_new_password(client: TestClient) -> None:
    register_user(client)
    token = login_user(client)

    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "senha123", "new_password": "123"},
    )

    assert response.status_code == 422


def test_change_password_rejects_same_password(client: TestClient) -> None:
    register_user(client)
    token = login_user(client)

    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "senha123", "new_password": "senha123"},
    )

    assert response.status_code == 400


def test_change_password_invalidates_only_current_user_token(client: TestClient) -> None:
    register_user(client, email="paulo@email.com")
    register_user(client, email="ana@email.com")
    paulo_token = login_user(client, email="paulo@email.com")
    ana_token = login_user(client, email="ana@email.com")

    response = client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {paulo_token}"},
        json={"current_password": "senha123", "new_password": "novaSenha123"},
    )
    paulo_old_token_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {paulo_token}"},
    )
    ana_token_response = client.get("/auth/me", headers={"Authorization": f"Bearer {ana_token}"})

    assert response.status_code == 200
    assert paulo_old_token_response.status_code == 401
    assert ana_token_response.status_code == 200


def test_forgot_password_public_response_is_same_for_existing_and_unknown_email(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sender = CapturingPasswordResetSender()
    monkeypatch.setattr("app.auth.get_password_reset_email_sender", lambda settings: sender)
    register_user(client)

    existing_response = client.post("/auth/forgot-password", json={"email": "PAULO@EMAIL.COM"})
    unknown_response = client.post("/auth/forgot-password", json={"email": "unknown@email.com"})

    assert existing_response.status_code == 200
    assert unknown_response.status_code == 200
    assert existing_response.json() == unknown_response.json()
    assert sender.recipients == ["paulo@email.com"]


def test_forgot_password_rate_limit(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sender = CapturingPasswordResetSender()
    monkeypatch.setattr("app.auth.get_password_reset_email_sender", lambda settings: sender)
    settings = Settings(
        app_env="local",
        jwt_secret_key=STRONG_SECRET,
        auth_register_rate_limit=1,
        auth_register_rate_window_seconds=60,
    )

    with make_client(settings, db_session) as client:
        first_response = client.post("/auth/forgot-password", json={"email": "a@email.com"})
        limited_response = client.post("/auth/forgot-password", json={"email": "b@email.com"})

    assert first_response.status_code == 200
    assert limited_response.status_code == 429


def test_email_failure_does_not_log_reset_url_or_smtp_details(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    class FailingSender:
        def send_password_reset(self, recipient_email: str, reset_url: str) -> None:
            raise EmailDeliveryError("smtp-private-credential " + reset_url)

    monkeypatch.setattr(
        "app.auth.get_password_reset_email_sender", lambda settings: FailingSender(),
    )
    register_user(client)
    response = client.post("/auth/forgot-password", json={"email": "paulo@email.com"})
    assert response.status_code == 200
    assert response.json()["message"] == PUBLIC_RESET_MESSAGE
    assert "smtp-private-credential" not in caplog.text + response.text
    assert "token=" not in caplog.text + response.text
    assert response.headers["X-Request-ID"] in caplog.text


def test_forgot_password_invalidates_previous_unused_token(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sender = CapturingPasswordResetSender()
    monkeypatch.setattr("app.auth.get_password_reset_email_sender", lambda settings: sender)
    register_user(client)

    request_password_reset(client)
    first_token = extract_token_from_reset_url(sender.reset_urls[-1])
    request_password_reset(client)
    second_token = extract_token_from_reset_url(sender.reset_urls[-1])
    first_response = client.post(
        "/auth/reset-password",
        json={"token": first_token, "new_password": "novaSenha123"},
    )
    second_response = client.post(
        "/auth/reset-password",
        json={"token": second_token, "new_password": "novaSenha123"},
    )

    assert first_response.status_code == 400
    assert second_response.status_code == 200


def test_forgot_password_stores_only_token_hash(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sender = CapturingPasswordResetSender()
    monkeypatch.setattr("app.auth.get_password_reset_email_sender", lambda settings: sender)
    register_user(client)

    request_password_reset(client)
    raw_token = extract_token_from_reset_url(sender.reset_urls[-1])
    stored_token = db_session.scalar(select(PasswordResetToken))

    assert stored_token is not None
    assert stored_token.token_hash == hash_token(raw_token)
    assert stored_token.token_hash != raw_token


def test_reset_password_success_updates_password_and_rejects_old_jwt(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sender = CapturingPasswordResetSender()
    monkeypatch.setattr("app.auth.get_password_reset_email_sender", lambda settings: sender)
    register_user(client)
    old_token = login_user(client)
    request_password_reset(client)
    raw_token = extract_token_from_reset_url(sender.reset_urls[-1])

    response = client.post(
        "/auth/reset-password",
        json={"token": raw_token, "new_password": "novaSenha123"},
    )
    old_password_response = client.post(
        "/auth/login",
        json={"email": "paulo@email.com", "password": "senha123"},
    )
    old_token_response = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    new_token = login_user(client, password="novaSenha123")

    assert response.status_code == 200
    assert response.json()["message"] == "Senha redefinida com sucesso."
    assert old_password_response.status_code == 401
    assert old_token_response.status_code == 401
    assert new_token


def test_reset_password_rejects_invalid_token(client: TestClient) -> None:
    response = client.post(
        "/auth/reset-password",
        json={"token": "invalido", "new_password": "novaSenha123"},
    )

    assert response.status_code == 400


def test_reset_password_rejects_expired_token(client: TestClient, db_session: Session) -> None:
    register_user(client)
    user = db_session.scalar(select(User).where(User.email == "paulo@email.com"))
    assert user is not None
    raw_token = "token-expirado"
    db_session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
    )
    db_session.commit()

    response = client.post(
        "/auth/reset-password",
        json={"token": raw_token, "new_password": "novaSenha123"},
    )

    assert response.status_code == 400


def test_reset_password_rejects_used_token(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sender = CapturingPasswordResetSender()
    monkeypatch.setattr("app.auth.get_password_reset_email_sender", lambda settings: sender)
    register_user(client)
    request_password_reset(client)
    raw_token = extract_token_from_reset_url(sender.reset_urls[-1])

    first_response = client.post(
        "/auth/reset-password",
        json={"token": raw_token, "new_password": "novaSenha123"},
    )
    second_response = client.post(
        "/auth/reset-password",
        json={"token": raw_token, "new_password": "outraSenha123"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 400
