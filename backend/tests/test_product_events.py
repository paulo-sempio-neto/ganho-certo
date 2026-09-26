from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.database import Base, get_db
from app.main import create_app
from app.models import ProductEvent, User
from app.product_events import (
    ACCOUNT_CREATED,
    DASHBOARD_VIEWED,
    FEEDBACK_SENT,
    FIRST_FINANCIAL_ENTRY,
    FIRST_VEHICLE_CREATED,
)

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
    return {"Authorization": f"Bearer {token}"}


def register_and_login(client: TestClient, email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"name": "Beta", "email": email, "password": "senha123"},
    )
    assert response.status_code == 201
    login_response = client.post("/auth/login", json={"email": email, "password": "senha123"})
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


def vehicle_payload(name: str = "Carro beta") -> dict[str, object]:
    return {
        "name": name,
        "brand": "Toyota",
        "model": "Corolla",
        "year": 2022,
        "fuel_type": "flex",
    }


def create_vehicle(client: TestClient, token: str, name: str = "Carro beta") -> int:
    response = client.post("/vehicles", json=vehicle_payload(name), headers=auth_headers(token))
    assert response.status_code == 201
    return int(response.json()["id"])


def get_user(db_session: Session, email: str) -> User:
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def events_for_user(db_session: Session, user: User) -> list[ProductEvent]:
    return list(
        db_session.scalars(
            select(ProductEvent)
            .where(ProductEvent.user_id == user.id)
            .order_by(ProductEvent.id)
        ).all()
    )


def test_account_created_event_is_recorded_for_current_user(
    client: TestClient,
    db_session: Session,
) -> None:
    register_and_login(client, "event-account@email.com")

    user = get_user(db_session, "event-account@email.com")
    events = events_for_user(db_session, user)

    assert [event.event_type for event in events] == [ACCOUNT_CREATED]
    assert events[0].dedupe_key == "once"


def test_first_setup_events_are_deduplicated_per_user(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "event-setup@email.com")
    vehicle_id = create_vehicle(client, token)

    first_session = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": "2026-09-26",
            "gross_revenue": "300.00",
            "distance_km": "90.00",
            "worked_minutes": 480,
            "trip_count": 12,
        },
        headers=auth_headers(token),
    )
    second_session = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": "2026-09-27",
            "gross_revenue": "280.00",
            "distance_km": "80.00",
            "worked_minutes": 420,
            "trip_count": 10,
        },
        headers=auth_headers(token),
    )

    user = get_user(db_session, "event-setup@email.com")
    event_types = [event.event_type for event in events_for_user(db_session, user)]

    assert first_session.status_code == 201
    assert second_session.status_code == 201
    assert event_types.count(FIRST_VEHICLE_CREATED) == 1
    assert event_types.count(FIRST_FINANCIAL_ENTRY) == 1


def test_product_events_do_not_store_financial_values(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "event-privacy@email.com")
    vehicle_id = create_vehicle(client, token)
    response = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": "2026-09-26",
            "gross_revenue": "9999.99",
            "distance_km": "123.45",
            "worked_minutes": 600,
            "trip_count": 30,
        },
        headers=auth_headers(token),
    )

    user = get_user(db_session, "event-privacy@email.com")
    serialized_events = [
        {
            "event_type": event.event_type,
            "dedupe_key": event.dedupe_key,
            "occurred_at": event.occurred_at.isoformat(),
        }
        for event in events_for_user(db_session, user)
    ]

    assert response.status_code == 201
    assert "9999.99" not in str(serialized_events)
    assert "123.45" not in str(serialized_events)
    assert "senha123" not in str(serialized_events)


def test_dashboard_view_is_deduplicated_daily(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "event-dashboard@email.com")
    vehicle_id = create_vehicle(client, token)
    client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": "2026-09-26",
            "gross_revenue": "100.00",
            "distance_km": "25.00",
            "worked_minutes": 120,
            "trip_count": 4,
        },
        headers=auth_headers(token),
    )

    first_response = client.get("/financial-summary", headers=auth_headers(token))
    second_response = client.get("/financial-summary", headers=auth_headers(token))

    user = get_user(db_session, "event-dashboard@email.com")
    dashboard_events = [
        event for event in events_for_user(db_session, user) if event.event_type == DASHBOARD_VIEWED
    ]
    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(dashboard_events) == 1


def test_feedback_sent_event_is_recorded_without_feedback_payload(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "event-feedback@email.com")

    response = client.post(
        "/feedback",
        json={
            "category": "confusing",
            "message": "Nao encontrei onde ver o historico.",
            "path": "/#resultado",
        },
        headers=auth_headers(token),
    )

    user = get_user(db_session, "event-feedback@email.com")
    feedback_events = [
        event for event in events_for_user(db_session, user) if event.event_type == FEEDBACK_SENT
    ]
    assert response.status_code == 201
    assert len(feedback_events) == 1
    assert "Nao encontrei" not in str(feedback_events[0].__dict__)


def test_internal_beta_summary_is_token_protected_and_aggregated(
    client: TestClient,
    db_session: Session,
) -> None:
    first_token = register_and_login(client, "summary-a@email.com")
    second_token = register_and_login(client, "summary-b@email.com")
    first_vehicle = create_vehicle(client, first_token)
    client.post(
        "/work-sessions",
        json={
            "vehicle_id": first_vehicle,
            "work_date": "2026-09-26",
            "gross_revenue": "150.00",
            "distance_km": "45.00",
            "worked_minutes": 240,
            "trip_count": 7,
        },
        headers=auth_headers(first_token),
    )
    client.post(
        "/feedback",
        json={"category": "idea", "message": "Seria bom comparar por semana."},
        headers=auth_headers(second_token),
    )

    unauthorized_response = client.get("/internal/beta/summary")
    forbidden_response = client.get(
        "/internal/beta/summary",
        headers={"X-Beta-Admin-Token": "wrong-token"},
    )
    summary_response = client.get(
        "/internal/beta/summary",
        headers={"X-Beta-Admin-Token": BETA_ADMIN_TOKEN},
    )

    assert unauthorized_response.status_code == 403
    assert forbidden_response.status_code == 403
    assert summary_response.status_code == 200
    payload = summary_response.json()
    assert payload["total_users"] == 2
    assert payload["users_with_first_vehicle"] == 1
    assert payload["users_with_first_financial_entry"] == 1
    assert payload["users_completed_first_setup"] == 1
    assert payload["feedback_count"] == 1
    assert "summary-a@email.com" not in summary_response.text
    assert "150.00" not in summary_response.text


def test_internal_beta_summary_is_disabled_without_admin_token(
    db_session: Session,
) -> None:
    application = create_app(
        Settings(app_env="local", jwt_secret_key="test_secret_key_with_at_least_32_chars")
    )

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db

    with TestClient(application) as test_client:
        response = test_client.get(
            "/internal/beta/summary",
            headers={"X-Beta-Admin-Token": BETA_ADMIN_TOKEN},
        )

    application.dependency_overrides.clear()
    assert response.status_code == 404
