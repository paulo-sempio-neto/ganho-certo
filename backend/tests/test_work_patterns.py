from collections.abc import Generator
from datetime import date
from decimal import Decimal
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import WorkSession


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


def get_current_user_id(client: TestClient, token: str) -> int:
    response = client.get("/auth/me", headers=auth_headers(token))
    assert response.status_code == 200
    return int(response.json()["id"])


def create_vehicle(client: TestClient, token: str, name: str = "Carro") -> int:
    response = client.post(
        "/vehicles",
        json={
            "name": name,
            "brand": "Fiat",
            "model": "Argo",
            "year": 2020,
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
    distance_km: str = "20.00",
    worked_minutes: int = 60,
    trip_count: int = 1,
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
    category: str = "fuel",
) -> None:
    response = client.post(
        "/expenses",
        json={
            "vehicle_id": vehicle_id,
            "expense_date": expense_date,
            "category": category,
            "amount": amount,
            "description": "Teste",
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def create_recurring_expense(
    client: TestClient,
    token: str,
    start_date: str,
    amount: str,
    vehicle_id: int | None = None,
) -> None:
    response = client.post(
        "/recurring-expenses",
        json={
            "vehicle_id": vehicle_id,
            "category": "parking",
            "amount": amount,
            "frequency": "monthly",
            "start_date": start_date,
            "end_date": None,
            "description": "Recorrente",
            "active": True,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def get_work_patterns(
    client: TestClient,
    token: str,
    *,
    start_date: str,
    end_date: str,
    vehicle_id: int | None = None,
) -> dict[str, Any]:
    params: dict[str, str | int] = {"start_date": start_date, "end_date": end_date}
    if vehicle_id is not None:
        params["vehicle_id"] = vehicle_id

    response = client.get("/work-patterns", params=params, headers=auth_headers(token))
    assert response.status_code == 200
    return cast(dict[str, Any], response.json())


def weekday_by_name(patterns: dict[str, Any], weekday: str) -> dict[str, Any]:
    weekdays = cast(list[dict[str, Any]], patterns["weekdays"])
    return next(item for item in weekdays if item["weekday"] == weekday)


def test_work_patterns_weekday_metrics_confidence_and_observations(
    client: TestClient,
) -> None:
    token = register_and_login(client, "work-patterns-main@email.com")
    vehicle_id = create_vehicle(client, token)

    create_work_session(client, token, vehicle_id, "2026-09-07", "10000.00", "100.00", 60)
    create_work_session(client, token, vehicle_id, "2026-09-01", "80.00", "20.00", 60)
    create_work_session(client, token, vehicle_id, "2026-09-08", "80.00", "20.00", 60)
    create_work_session(client, token, vehicle_id, "2026-09-03", "100.00", "10.00", 60, 1)
    create_work_session(client, token, vehicle_id, "2026-09-03", "50.00", "5.00", 30, 1)
    create_work_session(client, token, vehicle_id, "2026-09-10", "200.00", "20.00", 60, 2)
    create_work_session(client, token, vehicle_id, "2026-09-17", "300.00", "30.00", 60, 3)
    create_work_session(client, token, vehicle_id, "2026-09-24", "400.00", "40.00", 90, 4)
    create_expense(client, token, "2026-09-03", "50.00", vehicle_id=vehicle_id)
    create_expense(client, token, "2026-09-10", "160.00", vehicle_id=vehicle_id)

    patterns = get_work_patterns(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-30",
    )

    assert [weekday["weekday"] for weekday in patterns["weekdays"]] == [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    monday = weekday_by_name(patterns, "monday")
    tuesday = weekday_by_name(patterns, "tuesday")
    thursday = weekday_by_name(patterns, "thursday")

    assert monday["sample_classification"] == "insufficient"
    assert tuesday["sample_classification"] == "limited"
    assert thursday["sample_classification"] == "usable"
    assert thursday["active_days"] == 4
    assert thursday["total_worked_minutes"] == 300
    assert thursday["total_distance_km"] == "105.00"
    assert thursday["total_trip_count"] == 11
    assert thursday["gross_revenue"] == "1050.00"
    assert thursday["registered_expenses"] == "210.00"
    assert thursday["estimated_result"] == "840.00"
    assert thursday["average_gross_revenue_per_active_day"] == "262.50"
    assert thursday["average_estimated_result_per_active_day"] == "210.00"
    assert thursday["gross_revenue_per_hour"] == "210.00"
    assert thursday["estimated_result_per_hour"] == "168.00"
    assert thursday["gross_revenue_per_km"] == "10.00"
    assert thursday["estimated_result_per_km"] == "8.00"
    assert thursday["expense_ratio"] == "0.2000"

    observations = {observation["type"]: observation for observation in patterns["observations"]}
    assert observations["highest_estimated_result_per_hour_weekday"]["weekday"] == "thursday"
    assert observations["highest_estimated_result_per_km_weekday"]["weekday"] == "thursday"
    assert (
        observations["highest_average_estimated_result_per_active_day"]["weekday"] == "thursday"
    )
    assert observations["highest_expense_burden_weekday"]["weekday"] == "thursday"
    assert observations["most_frequently_worked_weekday"]["weekday"] == "thursday"


def test_work_patterns_zero_revenue_hours_and_distance_return_null_rates(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "work-patterns-zero@email.com")
    vehicle_id = create_vehicle(client, token)
    user_id = get_current_user_id(client, token)
    db_session.add(
        WorkSession(
            user_id=user_id,
            vehicle_id=vehicle_id,
            work_date=date(2026, 9, 2),
            gross_revenue_cents=0,
            distance_km=Decimal("0.00"),
            worked_minutes=0,
            trip_count=0,
        )
    )
    db_session.commit()
    create_expense(client, token, "2026-09-02", "5.00", vehicle_id=vehicle_id)

    patterns = get_work_patterns(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-07",
    )

    wednesday = weekday_by_name(patterns, "wednesday")
    assert wednesday["gross_revenue"] == "0.00"
    assert wednesday["registered_expenses"] == "5.00"
    assert wednesday["estimated_result"] == "-5.00"
    assert wednesday["expense_ratio"] is None
    assert wednesday["gross_revenue_per_hour"] is None
    assert wednesday["estimated_result_per_hour"] is None
    assert wednesday["gross_revenue_per_km"] is None
    assert wednesday["estimated_result_per_km"] is None
    assert patterns["overall"]["estimated_result_per_hour"] is None
    assert patterns["overall"]["estimated_result_per_km"] is None


def test_work_patterns_empty_history_returns_stable_response(client: TestClient) -> None:
    token = register_and_login(client, "work-patterns-empty@email.com")

    patterns = get_work_patterns(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-07",
    )

    assert patterns["overall"] == {
        "active_days": 0,
        "total_worked_minutes": 0,
        "total_distance_km": "0.00",
        "total_trip_count": 0,
        "gross_revenue": "0.00",
        "registered_expenses": "0.00",
        "estimated_result": "0.00",
        "estimated_result_per_hour": None,
        "estimated_result_per_km": None,
    }
    assert len(patterns["weekdays"]) == 7
    assert {weekday["sample_classification"] for weekday in patterns["weekdays"]} == {
        "insufficient"
    }
    assert patterns["observations"] == []


def test_work_patterns_vehicle_filter_and_user_isolation(client: TestClient) -> None:
    user_a_token = register_and_login(client, "work-patterns-a@email.com")
    user_b_token = register_and_login(client, "work-patterns-b@email.com")
    user_a_vehicle_id = create_vehicle(client, user_a_token, "A")
    user_a_other_vehicle_id = create_vehicle(client, user_a_token, "A2")
    user_b_vehicle_id = create_vehicle(client, user_b_token, "B")
    create_work_session(client, user_a_token, user_a_vehicle_id, "2026-09-01", "100.00")
    create_work_session(client, user_a_token, user_a_other_vehicle_id, "2026-09-01", "999.00")
    create_work_session(client, user_b_token, user_b_vehicle_id, "2026-09-01", "500.00")

    patterns = get_work_patterns(
        client,
        user_a_token,
        start_date="2026-09-01",
        end_date="2026-09-01",
        vehicle_id=user_a_vehicle_id,
    )
    forbidden_vehicle_response = client.get(
        "/work-patterns",
        params={
            "start_date": "2026-09-01",
            "end_date": "2026-09-01",
            "vehicle_id": user_b_vehicle_id,
        },
        headers=auth_headers(user_a_token),
    )

    assert patterns["vehicle_id"] == user_a_vehicle_id
    assert patterns["overall"]["gross_revenue"] == "100.00"
    assert weekday_by_name(patterns, "tuesday")["gross_revenue"] == "100.00"
    assert forbidden_vehicle_response.status_code == 404


def test_work_patterns_overall_matches_financial_summary(client: TestClient) -> None:
    token = register_and_login(client, "work-patterns-summary@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01", "300.00", "100.00", 120)
    create_expense(client, token, "2026-09-01", "50.00", vehicle_id=vehicle_id)
    create_recurring_expense(client, token, "2026-09-01", "25.00")

    patterns = get_work_patterns(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-30",
    )
    summary_response = client.get(
        "/financial-summary",
        params={"start_date": "2026-09-01", "end_date": "2026-09-30"},
        headers=auth_headers(token),
    )

    assert summary_response.status_code == 200
    summary = summary_response.json()
    overall = patterns["overall"]
    assert overall["active_days"] == 1
    assert overall["gross_revenue"] == summary["gross_revenue"]
    assert overall["registered_expenses"] == summary["total_expenses"]
    assert overall["estimated_result"] == summary["estimated_economic_result"]
    assert overall["total_worked_minutes"] == summary["total_worked_minutes"]
    assert overall["total_distance_km"] == summary["total_distance_km"]
    assert overall["total_trip_count"] == summary["total_trip_count"]
    assert overall["estimated_result_per_hour"] == "125.00"
    assert overall["estimated_result_per_km"] == "2.50"


def test_work_patterns_rejects_invalid_date_range(client: TestClient) -> None:
    token = register_and_login(client, "work-patterns-dates@email.com")

    response = client.get(
        "/work-patterns",
        params={"start_date": "2026-09-02", "end_date": "2026-09-01"},
        headers=auth_headers(token),
    )

    assert response.status_code == 422
