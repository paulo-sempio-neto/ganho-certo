from collections.abc import Generator
from datetime import date
from decimal import Decimal
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Plan, User, WorkSession


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


def set_user_plan(email: str, plan_code: str) -> None:
    override_get_db = app.dependency_overrides[get_db]
    db_session = next(override_get_db())
    user = db_session.scalar(select(User).where(User.email == email))
    plan = db_session.scalar(select(Plan).where(Plan.code == plan_code))
    assert user is not None
    assert plan is not None
    user.current_plan_id = plan.id
    db_session.commit()


def register_and_login(client: TestClient, email: str, plan_code: str = "pro") -> str:
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
    set_user_plan(email=email, plan_code=plan_code)
    return str(login_response.json()["access_token"])


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
    gross_revenue: str = "100.00",
    distance_km: str = "50.00",
    worked_minutes: int = 120,
    trip_count: int = 5,
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
    frequency: str = "monthly",
    vehicle_id: int | None = None,
) -> None:
    response = client.post(
        "/recurring-expenses",
        json={
            "vehicle_id": vehicle_id,
            "category": "parking",
            "amount": amount,
            "frequency": frequency,
            "start_date": start_date,
            "end_date": None,
            "description": "Recorrente",
            "active": True,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def upsert_cost_profile(client: TestClient, token: str, vehicle_id: int) -> None:
    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json={
            "ownership_type": "rented",
            "rental_monthly": "300.00",
            "financing_monthly": None,
            "insurance_monthly": None,
            "ipva_annual": None,
            "other_fixed_monthly": None,
            "maintenance_per_km": None,
            "tires_per_km": None,
            "oil_per_km": None,
            "depreciation_per_km": None,
            "fuel_efficiency_km_per_liter": None,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 200


def get_history(
    client: TestClient,
    token: str,
    *,
    start_date: str,
    end_date: str,
    grouping: str,
    vehicle_id: int | None = None,
) -> dict[str, Any]:
    params: dict[str, str | int] = {
        "start_date": start_date,
        "end_date": end_date,
        "grouping": grouping,
    }
    if vehicle_id is not None:
        params["vehicle_id"] = vehicle_id

    response = client.get("/financial-history", params=params, headers=auth_headers(token))
    assert response.status_code == 200
    return cast(dict[str, Any], response.json())


def test_financial_history_daily_grouping(client: TestClient) -> None:
    token = register_and_login(client, "daily-history@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01", gross_revenue="100.00")
    create_work_session(client, token, vehicle_id, "2026-09-02", gross_revenue="150.00")

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-02",
        grouping="daily",
    )

    periods = history["periods"]
    assert [period["period_start"] for period in periods] == ["2026-09-01", "2026-09-02"]
    assert [period["gross_revenue"] for period in periods] == ["100.00", "150.00"]


def test_free_plan_financial_history_is_restricted_but_summary_still_works(
    client: TestClient,
) -> None:
    token = register_and_login(client, "free-history@email.com", plan_code="free")

    history_response = client.get(
        "/financial-history",
        params={
            "start_date": "2026-09-01",
            "end_date": "2026-09-01",
            "grouping": "daily",
        },
        headers=auth_headers(token),
    )
    summary_response = client.get(
        "/financial-summary",
        params={"start_date": "2026-09-01", "end_date": "2026-09-01"},
        headers=auth_headers(token),
    )

    assert history_response.status_code == 403
    assert history_response.json() == {
        "code": "plan_limit_reached",
        "detail": "Seu plano atual nao inclui historico avancado.",
    }
    assert summary_response.status_code == 200


def test_financial_history_weekly_grouping(client: TestClient) -> None:
    token = register_and_login(client, "weekly-history@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01")
    create_work_session(client, token, vehicle_id, "2026-09-09", gross_revenue="200.00")

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-09",
        grouping="weekly",
    )

    periods = history["periods"]
    assert [(period["period_start"], period["period_end"]) for period in periods] == [
        ("2026-09-01", "2026-09-07"),
        ("2026-09-08", "2026-09-09"),
    ]
    assert [period["gross_revenue"] for period in periods] == ["100.00", "200.00"]


def test_financial_history_monthly_grouping(client: TestClient) -> None:
    token = register_and_login(client, "monthly-history@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-01-20")
    create_work_session(client, token, vehicle_id, "2026-03-05", gross_revenue="300.00")

    history = get_history(
        client,
        token,
        start_date="2026-01-15",
        end_date="2026-03-05",
        grouping="monthly",
    )

    periods = history["periods"]
    assert [(period["period_start"], period["period_end"]) for period in periods] == [
        ("2026-01-15", "2026-01-31"),
        ("2026-02-01", "2026-02-28"),
        ("2026-03-01", "2026-03-05"),
    ]
    assert [period["gross_revenue"] for period in periods] == ["100.00", "0.00", "300.00"]


def test_financial_history_compares_current_with_previous_equivalent_period(
    client: TestClient,
) -> None:
    token = register_and_login(client, "comparison-history@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-08-01", gross_revenue="100.00")
    create_expense(client, token, "2026-08-01", "20.00", vehicle_id=vehicle_id)
    create_work_session(client, token, vehicle_id, "2026-09-01", gross_revenue="150.00")
    create_expense(client, token, "2026-09-01", "30.00", vehicle_id=vehicle_id)

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-30",
        grouping="monthly",
    )

    comparison = history["comparison"]
    assert comparison["previous_period_start"] == "2026-08-02"
    assert comparison["previous_period_end"] == "2026-08-31"
    assert comparison["gross_revenue"] == {
        "current": "150.00",
        "previous": "0.00",
        "absolute_delta": "150.00",
        "percentage_delta": None,
    }


def test_financial_history_percentage_delta_when_previous_value_exists(
    client: TestClient,
) -> None:
    token = register_and_login(client, "percentage-history@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-08-15", gross_revenue="100.00")
    create_work_session(client, token, vehicle_id, "2026-09-15", gross_revenue="150.00")

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-30",
        grouping="monthly",
    )

    assert history["comparison"]["gross_revenue"]["percentage_delta"] == "50.00"


def test_financial_history_zero_hours_and_zero_distance_do_not_return_invalid_numbers(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "zero-rates-history@email.com")
    vehicle_id = create_vehicle(client, token)
    user_id = int(client.get("/auth/me", headers=auth_headers(token)).json()["id"])
    db_session.add(
        WorkSession(
            user_id=user_id,
            vehicle_id=vehicle_id,
            work_date=date(2026, 9, 1),
            gross_revenue_cents=10000,
            distance_km=Decimal("0.00"),
            worked_minutes=0,
            trip_count=1,
        )
    )
    db_session.commit()

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-01",
        grouping="daily",
    )

    period = history["periods"][0]
    assert period["revenue_per_hour"] is None
    assert period["estimated_result_per_hour"] is None
    assert period["revenue_per_km"] is None
    assert period["estimated_result_per_km"] is None


def test_financial_history_empty_history_returns_zero_periods(client: TestClient) -> None:
    token = register_and_login(client, "empty-history@email.com")

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-02",
        grouping="daily",
    )

    assert [period["gross_revenue"] for period in history["periods"]] == ["0.00", "0.00"]
    assert history["comparison"]["gross_revenue"]["previous"] == "0.00"
    assert history["comparison"]["gross_revenue"]["percentage_delta"] is None


def test_financial_history_vehicle_filter_and_user_isolation(client: TestClient) -> None:
    user_a_token = register_and_login(client, "history-a@email.com")
    user_b_token = register_and_login(client, "history-b@email.com")
    user_a_vehicle_id = create_vehicle(client, user_a_token, "A")
    user_a_other_vehicle_id = create_vehicle(client, user_a_token, "A2")
    user_b_vehicle_id = create_vehicle(client, user_b_token, "B")
    create_work_session(
        client,
        user_a_token,
        user_a_vehicle_id,
        "2026-09-01",
        gross_revenue="100.00",
    )
    create_work_session(
        client,
        user_a_token,
        user_a_other_vehicle_id,
        "2026-09-01",
        gross_revenue="999.00",
    )
    create_work_session(
        client,
        user_b_token,
        user_b_vehicle_id,
        "2026-09-01",
        gross_revenue="500.00",
    )

    history = get_history(
        client,
        user_a_token,
        start_date="2026-09-01",
        end_date="2026-09-01",
        grouping="daily",
        vehicle_id=user_a_vehicle_id,
    )
    forbidden_vehicle_response = client.get(
        "/financial-history",
        params={
            "start_date": "2026-09-01",
            "end_date": "2026-09-01",
            "grouping": "daily",
            "vehicle_id": user_b_vehicle_id,
        },
        headers=auth_headers(user_a_token),
    )

    assert history["periods"][0]["gross_revenue"] == "100.00"
    assert forbidden_vehicle_response.status_code == 404


def test_financial_history_includes_recurring_expenses(client: TestClient) -> None:
    token = register_and_login(client, "recurring-history@email.com")
    create_recurring_expense(client, token, start_date="2026-09-01", amount="120.00")

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-30",
        grouping="monthly",
    )

    period = history["periods"][0]
    assert period["recurring_projected_expenses"] == "120.00"
    assert period["projected_result"] == "-120.00"


def test_financial_history_includes_structural_vehicle_costs(client: TestClient) -> None:
    token = register_and_login(client, "structural-history@email.com")
    vehicle_id = create_vehicle(client, token)
    upsert_cost_profile(client, token, vehicle_id)
    create_work_session(client, token, vehicle_id, "2026-09-01", gross_revenue="200.00")

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-10",
        grouping="daily",
        vehicle_id=vehicle_id,
    )

    assert history["periods"][0]["estimated_structural_costs"] == "10.00"
    assert history["comparison"]["estimated_result"]["current"] == "100.00"


def test_financial_history_single_period_matches_financial_summary(
    client: TestClient,
) -> None:
    token = register_and_login(client, "summary-consistency-history@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01", gross_revenue="300.00")
    create_expense(client, token, "2026-09-01", "50.00", vehicle_id=vehicle_id)
    create_recurring_expense(client, token, start_date="2026-09-01", amount="25.00")

    history = get_history(
        client,
        token,
        start_date="2026-09-01",
        end_date="2026-09-30",
        grouping="monthly",
    )
    summary_response = client.get(
        "/financial-summary",
        params={"start_date": "2026-09-01", "end_date": "2026-09-30"},
        headers=auth_headers(token),
    )

    assert summary_response.status_code == 200
    summary = summary_response.json()
    period = history["periods"][0]
    assert period["gross_revenue"] == summary["gross_revenue"]
    assert period["registered_expenses"] == summary["total_expenses"]
    assert period["estimated_structural_costs"] == summary["estimated_structural_costs"]
    assert period["recurring_projected_expenses"] == summary["recurring_expenses_total"]
    assert period["cash_remaining"] == summary["estimated_net_profit"]
    assert period["estimated_result"] == summary["estimated_economic_result"]
    assert period["projected_result"] == summary["projected_economic_result"]
