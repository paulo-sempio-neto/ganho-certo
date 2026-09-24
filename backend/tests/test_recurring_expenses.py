from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import RecurringExpense


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


def recurring_expense_payload(
    vehicle_id: int | None = None,
    amount: str = "120.35",
    frequency: str = "monthly",
    start_date: str = "2026-09-23",
    end_date: str | None = None,
) -> dict[str, object]:
    return {
        "vehicle_id": vehicle_id,
        "category": "insurance",
        "amount": amount,
        "frequency": frequency,
        "start_date": start_date,
        "end_date": end_date,
        "description": "Seguro mensal",
        "active": True,
    }


def create_recurring_expense(
    client: TestClient,
    token: str,
    vehicle_id: int | None = None,
) -> int:
    response = client.post(
        "/recurring-expenses",
        json=recurring_expense_payload(vehicle_id=vehicle_id),
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_create_recurring_expense(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.post(
        "/recurring-expenses",
        json=recurring_expense_payload(vehicle_id=vehicle_id),
        headers=auth_headers(token),
    )
    recurring_expense = db_session.scalar(select(RecurringExpense))

    assert response.status_code == 201
    assert response.json()["amount"] == "120.35"
    assert response.json()["frequency"] == "monthly"
    assert response.json()["vehicle_id"] == vehicle_id
    assert response.json()["active"] is True
    assert "user_id" not in response.json()
    assert recurring_expense is not None
    assert recurring_expense.amount_cents == 12035


def test_list_only_current_user_recurring_expenses(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    create_recurring_expense(client, user_a_token)
    create_recurring_expense(client, user_b_token)

    response = client.get("/recurring-expenses", headers=auth_headers(user_a_token))

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["amount"] == "120.35"


def test_get_update_and_delete_own_recurring_expense(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    recurring_expense_id = create_recurring_expense(client, token)
    update_payload = recurring_expense_payload(amount="250.00", frequency="yearly")
    update_payload["category"] = "maintenance"
    update_payload["active"] = False

    get_response = client.get(
        f"/recurring-expenses/{recurring_expense_id}",
        headers=auth_headers(token),
    )
    update_response = client.put(
        f"/recurring-expenses/{recurring_expense_id}",
        json=update_payload,
        headers=auth_headers(token),
    )
    delete_response = client.delete(
        f"/recurring-expenses/{recurring_expense_id}",
        headers=auth_headers(token),
    )
    get_deleted_response = client.get(
        f"/recurring-expenses/{recurring_expense_id}",
        headers=auth_headers(token),
    )

    assert get_response.status_code == 200
    assert update_response.status_code == 200
    assert update_response.json()["amount"] == "250.00"
    assert update_response.json()["frequency"] == "yearly"
    assert update_response.json()["category"] == "maintenance"
    assert update_response.json()["active"] is False
    assert delete_response.status_code == 204
    assert get_deleted_response.status_code == 404


def test_recurring_expenses_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/recurring-expenses")

    assert response.status_code == 401


def test_user_cannot_access_update_or_delete_recurring_expense_from_another_user(
    client: TestClient,
) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    recurring_expense_id = create_recurring_expense(client, user_b_token)

    get_response = client.get(
        f"/recurring-expenses/{recurring_expense_id}",
        headers=auth_headers(user_a_token),
    )
    update_response = client.put(
        f"/recurring-expenses/{recurring_expense_id}",
        json=recurring_expense_payload(),
        headers=auth_headers(user_a_token),
    )
    delete_response = client.delete(
        f"/recurring-expenses/{recurring_expense_id}",
        headers=auth_headers(user_a_token),
    )

    assert get_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404


def test_reject_vehicle_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = client.post(
        "/recurring-expenses",
        json=recurring_expense_payload(vehicle_id=user_b_vehicle),
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_reject_invalid_amount(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")

    for amount in ("0", "-0.01"):
        response = client.post(
            "/recurring-expenses",
            json=recurring_expense_payload(amount=amount),
            headers=auth_headers(token),
        )
        assert response.status_code == 422


def test_reject_invalid_date_range(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")

    response = client.post(
        "/recurring-expenses",
        json=recurring_expense_payload(start_date="2026-09-23", end_date="2026-09-22"),
        headers=auth_headers(token),
    )

    assert response.status_code == 422


def test_reject_invalid_frequency(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")

    response = client.post(
        "/recurring-expenses",
        json=recurring_expense_payload(frequency="daily"),
        headers=auth_headers(token),
    )

    assert response.status_code == 422
