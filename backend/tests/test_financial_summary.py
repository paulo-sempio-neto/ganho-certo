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


def create_cost_profile(
    client: TestClient,
    token: str,
    vehicle_id: int,
    **overrides: object,
) -> None:
    payload: dict[str, object] = {
        "ownership_type": "owned",
        "rental_monthly": None,
        "financing_monthly": None,
        "insurance_monthly": None,
        "ipva_annual": None,
        "other_fixed_monthly": None,
        "maintenance_per_km": None,
        "tires_per_km": None,
        "oil_per_km": None,
        "depreciation_per_km": None,
        "fuel_efficiency_km_per_liter": None,
    }
    payload.update(overrides)

    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=payload,
        headers=auth_headers(token),
    )
    assert response.status_code == 200


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


def test_summary_without_cost_profile_uses_registered_expenses_only(
    client: TestClient,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-01-10", "100.00", "10.00", 60, 2)
    create_expense(client, token, "2026-01-10", "30.00", vehicle_id, "maintenance")

    response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["estimated_structural_costs"] == "0.00"
    assert response.json()["estimated_economic_costs"] == "30.00"
    assert response.json()["estimated_economic_result"] == "70.00"
    assert response.json()["structural_costs"] == {
        "ownership": "0.00",
        "insurance": "0.00",
        "ipva": "0.00",
        "other_fixed": "0.00",
        "maintenance": "0.00",
        "tires": "0.00",
        "oil": "0.00",
        "depreciation": "0.00",
    }


def test_summary_owned_vehicle_structural_costs_without_ownership_cost(
    client: TestClient,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-01-15", "1000.00", "100.00", 600, 20)
    create_cost_profile(
        client,
        token,
        vehicle_id,
        ownership_type="owned",
        rental_monthly="999.00",
        financing_monthly="999.00",
        insurance_monthly="310.00",
        ipva_annual="365.00",
        other_fixed_monthly="31.00",
        maintenance_per_km="0.1000",
        tires_per_km="0.0500",
        oil_per_km="0.0200",
        depreciation_per_km="0.2000",
    )

    response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["structural_costs"] == {
        "ownership": "0.00",
        "insurance": "310.00",
        "ipva": "31.00",
        "other_fixed": "31.00",
        "maintenance": "10.00",
        "tires": "5.00",
        "oil": "2.00",
        "depreciation": "20.00",
    }
    assert response.json()["estimated_structural_costs"] == "409.00"
    assert response.json()["estimated_economic_costs"] == "409.00"
    assert response.json()["estimated_economic_result"] == "591.00"


def test_summary_rented_vehicle_prorates_partial_month_and_avoids_rental_double_count(
    client: TestClient,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-01-15", "200.00", "10.00", 60, 2)
    create_expense(client, token, "2026-01-15", "500.00", vehicle_id, "rental")
    create_expense(client, token, "2026-01-15", "10.00", vehicle_id, "fuel")
    create_cost_profile(
        client,
        token,
        vehicle_id,
        ownership_type="rented",
        rental_monthly="310.00",
    )

    response = client.get(
        "/financial-summary?start_date=2026-01-10&end_date=2026-01-20",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["total_expenses"] == "510.00"
    assert response.json()["estimated_net_profit"] == "-310.00"
    assert response.json()["structural_costs"]["ownership"] == "110.00"
    assert response.json()["estimated_economic_costs"] == "120.00"
    assert response.json()["estimated_economic_result"] == "80.00"


def test_summary_financed_vehicle_prorates_across_months_and_avoids_double_count(
    client: TestClient,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-02-10", "500.00", "20.00", 120, 5)
    create_expense(client, token, "2026-02-10", "999.00", vehicle_id, "financing")
    create_expense(client, token, "2026-02-10", "20.00", vehicle_id, "parking")
    create_cost_profile(
        client,
        token,
        vehicle_id,
        ownership_type="financed",
        financing_monthly="310.00",
    )

    response = client.get(
        "/financial-summary?start_date=2026-01-16&end_date=2026-02-15",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["total_expenses"] == "1019.00"
    assert response.json()["structural_costs"]["ownership"] == "326.07"
    assert response.json()["estimated_economic_costs"] == "346.07"
    assert response.json()["estimated_economic_result"] == "153.93"


def test_summary_avoids_insurance_and_maintenance_double_count(
    client: TestClient,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-01-10", "200.00", "10.00", 60, 2)
    create_expense(client, token, "2026-01-10", "90.00", vehicle_id, "insurance")
    create_expense(client, token, "2026-01-10", "80.00", vehicle_id, "maintenance")
    create_expense(client, token, "2026-01-10", "7.00", vehicle_id, "toll")
    create_cost_profile(
        client,
        token,
        vehicle_id,
        ownership_type="owned",
        insurance_monthly="31.00",
        maintenance_per_km="0.5000",
    )

    response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["total_expenses"] == "177.00"
    assert response.json()["structural_costs"]["insurance"] == "31.00"
    assert response.json()["structural_costs"]["maintenance"] == "5.00"
    assert response.json()["estimated_economic_costs"] == "43.00"
    assert response.json()["estimated_economic_result"] == "157.00"


def test_summary_uses_real_maintenance_expense_when_profile_has_no_maintenance_provision(
    client: TestClient,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-01-10", "100.00", "10.00", 60, 2)
    create_expense(client, token, "2026-01-10", "25.00", vehicle_id, "maintenance")
    create_cost_profile(
        client,
        token,
        vehicle_id,
        ownership_type="owned",
        depreciation_per_km="0.1000",
    )

    response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["structural_costs"]["depreciation"] == "1.00"
    assert response.json()["estimated_economic_costs"] == "26.00"


def test_summary_aggregates_multiple_vehicles_separately_and_filters_by_vehicle(
    client: TestClient,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_a = create_vehicle(client, token, "Carro A")
    vehicle_b = create_vehicle(client, token, "Carro B")
    create_work_session(client, token, vehicle_a, "2026-01-10", "100.00", "10.00", 60, 2)
    create_work_session(client, token, vehicle_b, "2026-01-10", "200.00", "20.00", 60, 4)
    create_cost_profile(client, token, vehicle_a, maintenance_per_km="0.1000")
    create_cost_profile(client, token, vehicle_b, maintenance_per_km="0.2000")

    all_response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(token),
    )
    vehicle_response = client.get(
        f"/financial-summary?start_date=2026-01-01&end_date=2026-01-31&vehicle_id={vehicle_a}",
        headers=auth_headers(token),
    )

    assert all_response.status_code == 200
    assert all_response.json()["structural_costs"]["maintenance"] == "5.00"
    assert all_response.json()["estimated_economic_result"] == "295.00"
    assert vehicle_response.status_code == 200
    assert vehicle_response.json()["structural_costs"]["maintenance"] == "1.00"
    assert vehicle_response.json()["estimated_economic_result"] == "99.00"


def test_summary_economic_costs_are_isolated_between_users(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a-costs@email.com")
    user_b_token = register_and_login(client, "b-costs@email.com")
    user_a_vehicle = create_vehicle(client, user_a_token)
    user_b_vehicle = create_vehicle(client, user_b_token)
    create_work_session(
        client, user_a_token, user_a_vehicle, "2026-01-10", "100.00", "10.00", 60, 2
    )
    create_work_session(
        client, user_b_token, user_b_vehicle, "2026-01-10", "100.00", "10.00", 60, 2
    )
    create_cost_profile(client, user_b_token, user_b_vehicle, maintenance_per_km="9.9900")

    response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 200
    assert response.json()["estimated_structural_costs"] == "0.00"
    assert response.json()["estimated_economic_result"] == "100.00"


def test_summary_economic_money_precision_without_float_error(client: TestClient) -> None:
    token = register_and_login(client, "precision-costs@email.com")
    vehicle_id = create_vehicle(client, token)
    create_work_session(client, token, vehicle_id, "2026-01-10", "1.00", "2.00", 60, 1)
    create_cost_profile(
        client,
        token,
        vehicle_id,
        other_fixed_monthly="0.10",
        maintenance_per_km="0.1000",
    )

    response = client.get(
        "/financial-summary?start_date=2026-01-01&end_date=2026-01-31",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["estimated_structural_costs"] == "0.30"
    assert response.json()["estimated_economic_costs"] == "0.30"
    assert response.json()["estimated_economic_result"] == "0.70"


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
