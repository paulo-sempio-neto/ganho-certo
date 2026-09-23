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


def create_vehicle(client: TestClient, token: str, name: str = "Carro") -> int:
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


def create_work_session(
    client: TestClient,
    token: str,
    vehicle_id: int,
    work_date: str,
    gross_revenue: str,
    distance_km: str,
    worked_minutes: int,
    trip_count: int,
) -> None:
    response = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": work_date,
            "gross_revenue": gross_revenue,
            "distance_km": distance_km,
            "worked_minutes": worked_minutes,
            "trip_count": trip_count,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def create_expense(
    client: TestClient,
    token: str,
    expense_date: str,
    amount: str,
    vehicle_id: int | None = None,
) -> None:
    response = client.post(
        "/expenses",
        json={
            "vehicle_id": vehicle_id,
            "expense_date": expense_date,
            "category": "fuel",
            "amount": amount,
            "description": None,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def test_summary_for_period_calculates_all_main_metrics(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-22", "100.00", "50.00", 120, 4)
    create_work_session(client, token, vehicle_id, "2026-09-23", "200.10", "50.50", 180, 6)
    create_expense(client, token, "2026-09-22", "30.05", vehicle_id)
    create_expense(client, token, "2026-09-23", "20.05")

    response = client.get(
        "/financial-summary?start_date=2026-09-22&end_date=2026-09-23",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["gross_revenue"] == "300.10"
    assert response.json()["total_expenses"] == "50.10"
    assert response.json()["estimated_net_profit"] == "250.00"
    assert response.json()["total_distance_km"] == "100.50"
    assert response.json()["total_worked_minutes"] == 300
    assert response.json()["total_trip_count"] == 10
    assert response.json()["gross_per_hour"] == "60.02"
    assert response.json()["net_per_hour"] == "50.00"
    assert response.json()["gross_per_km"] == "2.99"
    assert response.json()["net_per_km"] == "2.49"
    assert response.json()["expense_per_km"] == "0.50"
    assert response.json()["average_ticket"] == "30.01"
    assert response.json()["daily"] == [
        {
            "date": "2026-09-22",
            "gross_revenue": "100.00",
            "expenses": "30.05",
            "estimated_net_profit": "69.95",
        },
        {
            "date": "2026-09-23",
            "gross_revenue": "200.10",
            "expenses": "20.05",
            "estimated_net_profit": "180.05",
        },
    ]


def test_summary_filters_by_vehicle_without_unlinked_expenses(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_a = create_vehicle(client, token, "Carro A")
    vehicle_b = create_vehicle(client, token, "Carro B")
    create_work_session(client, token, vehicle_a, "2026-09-22", "100.00", "10.00", 60, 2)
    create_work_session(client, token, vehicle_b, "2026-09-22", "300.00", "30.00", 60, 3)
    create_expense(client, token, "2026-09-22", "20.00", vehicle_a)
    create_expense(client, token, "2026-09-22", "70.00", vehicle_b)
    create_expense(client, token, "2026-09-22", "999.00")

    response = client.get(
        f"/financial-summary?vehicle_id={vehicle_a}",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["gross_revenue"] == "100.00"
    assert response.json()["total_expenses"] == "20.00"
    assert response.json()["estimated_net_profit"] == "80.00"


def test_summary_isolated_between_users(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_a_vehicle = create_vehicle(client, user_a_token)
    user_b_vehicle = create_vehicle(client, user_b_token)
    create_work_session(
        client, user_a_token, user_a_vehicle, "2026-09-22", "100.00", "10.00", 60, 2
    )
    create_work_session(
        client, user_b_token, user_b_vehicle, "2026-09-22", "900.00", "90.00", 60, 9
    )
    create_expense(client, user_b_token, "2026-09-22", "300.00", user_b_vehicle)

    response = client.get("/financial-summary", headers=auth_headers(user_a_token))

    assert response.status_code == 200
    assert response.json()["gross_revenue"] == "100.00"
    assert response.json()["total_expenses"] == "0.00"


def test_summary_empty_period_returns_zeroes_and_null_metrics(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")

    response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["gross_revenue"] == "0.00"
    assert response.json()["total_expenses"] == "0.00"
    assert response.json()["estimated_net_profit"] == "0.00"
    assert response.json()["total_distance_km"] == "0.00"
    assert response.json()["gross_per_hour"] is None
    assert response.json()["gross_per_km"] is None
    assert response.json()["average_ticket"] is None
    assert response.json()["daily"] == []


def test_summary_zero_km_and_zero_trips_return_null_dependent_metrics(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-22", "100.00", "0.00", 60, 0)
    create_expense(client, token, "2026-09-22", "10.00", vehicle_id)

    response = client.get("/financial-summary", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["gross_per_hour"] == "100.00"
    assert response.json()["gross_per_km"] is None
    assert response.json()["net_per_km"] is None
    assert response.json()["expense_per_km"] is None
    assert response.json()["average_ticket"] is None


def test_summary_money_precision_without_float_error(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-22", "0.10", "1.00", 60, 1)
    create_work_session(client, token, vehicle_id, "2026-09-22", "0.20", "1.00", 60, 1)
    create_expense(client, token, "2026-09-22", "0.03", vehicle_id)

    response = client.get("/financial-summary", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["gross_revenue"] == "0.30"
    assert response.json()["total_expenses"] == "0.03"
    assert response.json()["estimated_net_profit"] == "0.27"


def test_summary_rejects_invalid_date_range(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")

    response = client.get(
        "/financial-summary?start_date=2026-09-23&end_date=2026-09-22",
        headers=auth_headers(token),
    )

    assert response.status_code == 422


def test_summary_rejects_vehicle_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = client.get(
        f"/financial-summary?vehicle_id={user_b_vehicle}",
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404
