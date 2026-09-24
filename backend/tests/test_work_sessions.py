from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Expense, WorkSession


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


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_and_login(client: TestClient, email: str) -> str:
    register_response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": email, "password": "senha123"},
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": "senha123"},
    )
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


def create_vehicle(client: TestClient, token: str, name: str = "Carro do app") -> int:
    response = client.post(
        "/vehicles",
        json={
            "name": name,
            "brand": "Toyota",
            "model": "Corolla",
            "year": 2022,
            "fuel_type": "flex",
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def work_session_payload(vehicle_id: int, gross_revenue: str = "123.45") -> dict[str, object]:
    return {
        "vehicle_id": vehicle_id,
        "work_date": "2026-09-23",
        "gross_revenue": gross_revenue,
        "distance_km": "87.50",
        "worked_minutes": 360,
        "trip_count": 14,
    }


def create_work_session(client: TestClient, token: str, vehicle_id: int) -> int:
    response = client.post(
        "/work-sessions",
        json=work_session_payload(vehicle_id),
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def quick_start_payload(
    vehicle_id: int,
    expense_amount: str | None = "45.00",
) -> dict[str, object]:
    payload = work_session_payload(vehicle_id)
    if expense_amount is not None:
        payload["expense_amount"] = expense_amount
        payload["expense_category"] = "fuel"
    return payload


def test_create_work_session(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.post(
        "/work-sessions",
        json=work_session_payload(vehicle_id),
        headers=auth_headers(token),
    )

    assert response.status_code == 201
    assert response.json()["vehicle_id"] == vehicle_id
    assert response.json()["gross_revenue"] == "123.45"
    assert "user_id" not in response.json()


def test_quick_start_creates_work_session_and_optional_expense(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "quick-start-success@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.post(
        "/work-sessions/quick-start",
        json=quick_start_payload(vehicle_id),
        headers=auth_headers(token),
    )

    work_sessions = db_session.scalars(select(WorkSession)).all()
    expenses = db_session.scalars(select(Expense)).all()
    assert response.status_code == 201
    assert len(work_sessions) == 1
    assert len(expenses) == 1
    assert expenses[0].vehicle_id == vehicle_id
    assert expenses[0].amount_cents == 4500


def test_quick_start_rolls_back_work_session_when_expense_creation_fails(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = register_and_login(client, "quick-start-rollback@email.com")
    vehicle_id = create_vehicle(client, token)
    original_add = db_session.add

    def fail_expense_add(instance: object, _warn: bool = True) -> None:
        if isinstance(instance, Expense):
            raise IntegrityError("Simulated expense failure", {}, Exception())
        original_add(instance, _warn=_warn)

    monkeypatch.setattr(db_session, "add", fail_expense_add)

    response = client.post(
        "/work-sessions/quick-start",
        json=quick_start_payload(vehicle_id),
        headers=auth_headers(token),
    )

    assert response.status_code == 500
    assert db_session.scalars(select(WorkSession)).all() == []
    assert db_session.scalars(select(Expense)).all() == []


def test_quick_start_without_expense_creates_only_work_session(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "quick-start-no-expense@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.post(
        "/work-sessions/quick-start",
        json=quick_start_payload(vehicle_id, expense_amount=None),
        headers=auth_headers(token),
    )

    assert response.status_code == 201
    assert len(db_session.scalars(select(WorkSession)).all()) == 1
    assert db_session.scalars(select(Expense)).all() == []


def test_quick_start_keeps_data_isolated_between_users(client: TestClient) -> None:
    user_a_token = register_and_login(client, "quick-start-a@email.com")
    user_b_token = register_and_login(client, "quick-start-b@email.com")
    user_a_vehicle = create_vehicle(client, user_a_token, "Carro A")

    response = client.post(
        "/work-sessions/quick-start",
        json=quick_start_payload(user_a_vehicle),
        headers=auth_headers(user_a_token),
    )
    user_b_sessions = client.get("/work-sessions", headers=auth_headers(user_b_token))
    user_b_expenses = client.get("/expenses", headers=auth_headers(user_b_token))

    assert response.status_code == 201
    assert user_b_sessions.json() == []
    assert user_b_expenses.json() == []


def test_list_only_current_user_work_sessions(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_a_vehicle = create_vehicle(client, user_a_token, "Carro A")
    user_b_vehicle = create_vehicle(client, user_b_token, "Carro B")
    create_work_session(client, user_a_token, user_a_vehicle)
    create_work_session(client, user_b_token, user_b_vehicle)

    response = client.get("/work-sessions", headers=auth_headers(user_a_token))

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["vehicle_id"] == user_a_vehicle


def test_get_own_work_session(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    session_id = create_work_session(client, token, vehicle_id)

    response = client.get(f"/work-sessions/{session_id}", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["id"] == session_id


def test_update_own_work_session(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    session_id = create_work_session(client, token, vehicle_id)
    payload = work_session_payload(vehicle_id, gross_revenue="150.25")
    payload["worked_minutes"] = 420

    response = client.put(
        f"/work-sessions/{session_id}",
        json=payload,
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["gross_revenue"] == "150.25"
    assert response.json()["worked_minutes"] == 420


def test_delete_own_work_session(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    session_id = create_work_session(client, token, vehicle_id)

    delete_response = client.delete(f"/work-sessions/{session_id}", headers=auth_headers(token))
    get_response = client.get(f"/work-sessions/{session_id}", headers=auth_headers(token))

    assert delete_response.status_code == 204
    assert get_response.status_code == 404


def test_work_sessions_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/work-sessions")

    assert response.status_code == 401


def test_reject_vehicle_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = client.post(
        "/work-sessions",
        json=work_session_payload(user_b_vehicle),
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_user_cannot_get_work_session_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)
    session_id = create_work_session(client, user_b_token, user_b_vehicle)

    response = client.get(f"/work-sessions/{session_id}", headers=auth_headers(user_a_token))

    assert response.status_code == 404


def test_user_cannot_update_work_session_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_a_vehicle = create_vehicle(client, user_a_token)
    user_b_vehicle = create_vehicle(client, user_b_token)
    session_id = create_work_session(client, user_b_token, user_b_vehicle)

    response = client.put(
        f"/work-sessions/{session_id}",
        json=work_session_payload(user_a_vehicle),
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_user_cannot_delete_work_session_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)
    session_id = create_work_session(client, user_b_token, user_b_vehicle)

    response = client.delete(f"/work-sessions/{session_id}", headers=auth_headers(user_a_token))

    assert response.status_code == 404


def test_reject_negative_values(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    invalid_payloads = [
        {**work_session_payload(vehicle_id), "gross_revenue": "-0.01"},
        {**work_session_payload(vehicle_id), "distance_km": "-1"},
        {**work_session_payload(vehicle_id), "worked_minutes": 0},
        {**work_session_payload(vehicle_id), "trip_count": -1},
    ]

    for payload in invalid_payloads:
        response = client.post("/work-sessions", json=payload, headers=auth_headers(token))
        assert response.status_code == 422


def test_money_is_stored_as_cents_without_float_imprecision(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.post(
        "/work-sessions",
        json=work_session_payload(vehicle_id, gross_revenue="0.10"),
        headers=auth_headers(token),
    )
    work_session = db_session.scalar(select(WorkSession))

    assert response.status_code == 201
    assert response.json()["gross_revenue"] == "0.10"
    assert work_session is not None
    assert work_session.gross_revenue_cents == 10
