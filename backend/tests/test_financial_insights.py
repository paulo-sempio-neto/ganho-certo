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
    distance_km: str = "10.00",
    worked_minutes: int = 60,
) -> None:
    response = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": work_date,
            "gross_revenue": gross_revenue,
            "distance_km": distance_km,
            "worked_minutes": worked_minutes,
            "trip_count": 1,
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
            "description": None,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201


def insights_by_code(response: dict[str, object]) -> dict[str, dict[str, str]]:
    insights = response["insights"]
    assert isinstance(insights, list)
    return {str(insight["code"]): insight for insight in insights}


def test_financial_insights_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/financial-insights")

    assert response.status_code == 401


def test_financial_insights_return_period_metrics_and_best_day(client: TestClient) -> None:
    token = register_and_login(client, "metrics@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01", "100.00", "100.00", 60)
    create_work_session(client, token, vehicle_id, "2026-09-02", "200.00", "50.00", 120)
    create_expense(client, token, "2026-09-01", "30.00", vehicle_id, "fuel")
    create_expense(client, token, "2026-09-01", "10.00", vehicle_id, "maintenance")
    create_expense(client, token, "2026-09-02", "20.00", vehicle_id, "fuel")

    response = client.get(
        "/financial-insights?start_date=2026-09-01&end_date=2026-09-02",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    insights = insights_by_code(response.json())
    assert insights["expense_share"]["message"] == (
        "Suas despesas registradas representam 20% do faturamento."
    )
    assert insights["net_per_hour"]["message"] == (
        "Seu resultado médio após despesas foi de R$ 80,00 por hora."
    )
    assert insights["net_per_km"]["message"] == (
        "Seu resultado médio após despesas foi de R$ 1,60 por km."
    )
    assert insights["top_expense_category"]["message"] == (
        "Combustível foi sua maior despesa registrada no período, totalizando R$ 50,00."
    )
    assert insights["best_day"]["message"] == (
        "Seu melhor resultado diário foi em 02/09, com R$ 180,00 após despesas registradas."
    )


def test_financial_insights_compare_with_previous_period_increase(
    client: TestClient,
) -> None:
    token = register_and_login(client, "increase@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01", "100.00", "10.00", 60)
    create_work_session(client, token, vehicle_id, "2026-09-02", "100.00", "10.00", 60)
    create_expense(client, token, "2026-09-01", "25.00", vehicle_id)
    create_expense(client, token, "2026-09-02", "25.00", vehicle_id)
    create_work_session(client, token, vehicle_id, "2026-09-03", "150.00", "10.00", 60)
    create_work_session(client, token, vehicle_id, "2026-09-04", "150.00", "10.00", 60)
    create_expense(client, token, "2026-09-03", "30.00", vehicle_id)
    create_expense(client, token, "2026-09-04", "30.00", vehicle_id)

    response = client.get(
        "/financial-insights?start_date=2026-09-03&end_date=2026-09-04",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    insights = insights_by_code(response.json())
    assert insights["gross_revenue_change"]["message"] == (
        "Seu faturamento aumentou 50% em relação ao período anterior."
    )
    assert insights["net_result_change"]["message"] == (
        "Seu resultado após despesas aumentou 60% em relação ao período anterior."
    )
    assert insights["net_per_hour_change"]["message"] == (
        "Seu resultado por hora aumentou 60% em relação ao período anterior."
    )


def test_financial_insights_compare_with_previous_period_drop(client: TestClient) -> None:
    token = register_and_login(client, "drop@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01", "200.00", "10.00", 60)
    create_work_session(client, token, vehicle_id, "2026-09-02", "100.00", "10.00", 60)

    response = client.get(
        "/financial-insights?start_date=2026-09-02&end_date=2026-09-02",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    insights = insights_by_code(response.json())
    assert insights["gross_revenue_change"]["message"] == (
        "Seu faturamento caiu 50% em relação ao período anterior."
    )
    assert insights["net_result_change"]["message"] == (
        "Seu resultado após despesas caiu 50% em relação ao período anterior."
    )
    assert insights["net_per_hour_change"]["message"] == (
        "Seu resultado por hora caiu 50% em relação ao período anterior."
    )


def test_financial_insights_empty_period_avoids_division_by_zero(client: TestClient) -> None:
    token = register_and_login(client, "empty@email.com")

    response = client.get(
        "/financial-insights?start_date=2026-09-01&end_date=2026-09-02",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json() == {"insights": []}


def test_financial_insights_filter_by_vehicle_and_isolate_users(client: TestClient) -> None:
    user_a_token = register_and_login(client, "filter-a@email.com")
    user_b_token = register_and_login(client, "filter-b@email.com")
    vehicle_a = create_vehicle(client, user_a_token, "Carro A")
    vehicle_b = create_vehicle(client, user_a_token, "Carro B")
    user_b_vehicle = create_vehicle(client, user_b_token, "Carro B")
    create_work_session(client, user_a_token, vehicle_a, "2026-09-01", "100.00", "10.00", 60)
    create_expense(client, user_a_token, "2026-09-01", "30.00", vehicle_a)
    create_work_session(client, user_a_token, vehicle_b, "2026-09-01", "900.00", "10.00", 60)
    create_expense(client, user_a_token, "2026-09-01", "400.00", vehicle_b)
    create_work_session(client, user_b_token, user_b_vehicle, "2026-09-01", "800.00", "10.00", 60)
    create_expense(client, user_b_token, "2026-09-01", "700.00", user_b_vehicle)

    response = client.get(
        f"/financial-insights?vehicle_id={vehicle_a}",
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 200
    insights = insights_by_code(response.json())
    assert insights["expense_share"]["message"] == (
        "Suas despesas registradas representam 30% do faturamento."
    )
    assert insights["top_expense_category"]["message"] == (
        "Combustível foi sua maior despesa registrada no período, totalizando R$ 30,00."
    )


def test_financial_insights_reject_vehicle_from_other_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "vehicle-a@email.com")
    user_b_token = register_and_login(client, "vehicle-b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = client.get(
        f"/financial-insights?vehicle_id={user_b_vehicle}",
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_financial_insights_money_precision_without_float_error(client: TestClient) -> None:
    token = register_and_login(client, "precision-insights@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-09-01", "0.30", "1.00", 60)
    create_expense(client, token, "2026-09-01", "0.10", vehicle_id)

    response = client.get(
        "/financial-insights?start_date=2026-09-01&end_date=2026-09-01",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    insights = insights_by_code(response.json())
    assert insights["net_per_hour"]["message"] == (
        "Seu resultado médio após despesas foi de R$ 0,20 por hora."
    )
