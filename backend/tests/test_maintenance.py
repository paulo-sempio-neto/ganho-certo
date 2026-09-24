from collections.abc import Generator
from datetime import date, timedelta
from typing import TypedDict, cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import MaintenancePlan


class MaintenancePlanResponse(TypedDict):
    id: int
    vehicle_id: int
    name: str
    category: str
    interval_km: str | None
    interval_days: int | None
    estimated_cost: str | None
    active: bool
    created_at: str
    updated_at: str


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
    work_date: date,
    distance_km: str,
) -> int:
    response = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": work_date.isoformat(),
            "gross_revenue": "100.00",
            "distance_km": distance_km,
            "worked_minutes": 60,
            "trip_count": 1,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def create_plan(
    client: TestClient,
    token: str,
    vehicle_id: int,
    payload: dict[str, object] | None = None,
) -> MaintenancePlanResponse:
    base_payload: dict[str, object] = {
        "vehicle_id": vehicle_id,
        "name": "Troca de oleo",
        "category": "oil",
        "interval_km": "1000.00",
        "interval_days": None,
        "estimated_cost": "250.50",
        "active": True,
    }
    if payload:
        base_payload.update(payload)

    response = client.post(
        "/maintenance-plans",
        json=base_payload,
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return cast(MaintenancePlanResponse, response.json())


def create_record(
    client: TestClient,
    token: str,
    plan_id: int,
    service_date: date,
    notes: str | None = "Realizada",
) -> dict[str, object]:
    response = client.post(
        f"/maintenance-plans/{plan_id}/records",
        json={"service_date": service_date.isoformat(), "notes": notes},
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return dict(response.json())


def test_create_maintenance_plan_by_km_days_and_both(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-create@email.com")
    vehicle_id = create_vehicle(client, token)

    km_plan = create_plan(client, token, vehicle_id)
    days_plan = create_plan(
        client,
        token,
        vehicle_id,
        {"name": "Inspecao", "category": "inspection", "interval_km": None, "interval_days": 90},
    )
    both_plan = create_plan(
        client,
        token,
        vehicle_id,
        {"name": "Pneus", "category": "tires", "interval_days": 180},
    )

    assert km_plan["interval_km"] == "1000.00"
    assert days_plan["interval_days"] == 90
    assert both_plan["interval_km"] == "1000.00"
    assert both_plan["interval_days"] == 180


@pytest.mark.parametrize(
    "payload",
    [
        {"interval_km": None, "interval_days": None},
        {"interval_km": "0.00"},
        {"interval_days": 0, "interval_km": None},
        {"estimated_cost": "-1.00"},
        {"name": " "},
    ],
)
def test_maintenance_plan_rejects_invalid_values(
    client: TestClient,
    payload: dict[str, object],
) -> None:
    token = register_and_login(client, f"maintenance-invalid-{len(str(payload))}@email.com")
    vehicle_id = create_vehicle(client, token)
    base_payload = {
        "vehicle_id": vehicle_id,
        "name": "Plano",
        "category": "oil",
        "interval_km": "1000.00",
        "interval_days": None,
        "estimated_cost": "10.00",
        "active": True,
    }
    base_payload.update(payload)

    response = client.post(
        "/maintenance-plans",
        json=base_payload,
        headers=auth_headers(token),
    )

    assert response.status_code == 422


def test_maintenance_plans_are_listed_only_for_current_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "maintenance-list-a@email.com")
    user_b_token = register_and_login(client, "maintenance-list-b@email.com")
    user_a_vehicle = create_vehicle(client, user_a_token)
    user_b_vehicle = create_vehicle(client, user_b_token)
    create_plan(client, user_a_token, user_a_vehicle, {"name": "Plano A"})
    create_plan(client, user_b_token, user_b_vehicle, {"name": "Plano B"})

    response = client.get("/maintenance-plans", headers=auth_headers(user_a_token))

    assert response.status_code == 200
    assert [plan["name"] for plan in response.json()] == ["Plano A"]


def test_create_and_list_maintenance_records_ordered(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-records@email.com")
    vehicle_id = create_vehicle(client, token)
    plan = create_plan(client, token, vehicle_id)
    today = date.today()

    create_record(client, token, int(plan["id"]), today - timedelta(days=10), "Antiga")
    create_record(client, token, int(plan["id"]), today, "Nova")
    response = client.get(
        f"/maintenance-plans/{plan['id']}/records",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert [record["notes"] for record in response.json()] == ["Nova", "Antiga"]


def test_maintenance_record_rejects_future_service_date(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-future-date@email.com")
    vehicle_id = create_vehicle(client, token)
    plan = create_plan(client, token, vehicle_id)

    response = client.post(
        f"/maintenance-plans/{plan['id']}/records",
        json={
            "service_date": (date.today() + timedelta(days=1)).isoformat(),
            "notes": "Agendada",
        },
        headers=auth_headers(token),
    )

    assert response.status_code == 422


def test_maintenance_isolation_and_authentication(client: TestClient) -> None:
    user_a_token = register_and_login(client, "maintenance-access-a@email.com")
    user_b_token = register_and_login(client, "maintenance-access-b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)
    plan = create_plan(client, user_b_token, user_b_vehicle)

    no_token_response = client.get("/maintenance-plans")
    foreign_get_response = client.get(
        f"/maintenance-plans/{plan['id']}",
        headers=auth_headers(user_a_token),
    )
    foreign_record_response = client.post(
        f"/maintenance-plans/{plan['id']}/records",
        json={"service_date": date.today().isoformat(), "notes": "Nao pode"},
        headers=auth_headers(user_a_token),
    )

    assert no_token_response.status_code == 401
    assert foreign_get_response.status_code == 404
    assert foreign_record_response.status_code == 404


def test_maintenance_plan_rejects_vehicle_from_other_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "maintenance-vehicle-a@email.com")
    user_b_token = register_and_login(client, "maintenance-vehicle-b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = client.post(
        "/maintenance-plans",
        json={
            "vehicle_id": user_b_vehicle,
            "name": "Plano",
            "category": "oil",
            "interval_km": "1000.00",
            "active": True,
        },
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_km_since_last_service_ignores_previous_journeys(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-km@email.com")
    vehicle_id = create_vehicle(client, token)
    plan = create_plan(client, token, vehicle_id, {"interval_km": "1000.00", "interval_days": 30})
    today = date.today()
    create_record(client, token, int(plan["id"]), today - timedelta(days=5))
    create_work_session(client, token, vehicle_id, today - timedelta(days=6), "900.00")
    create_work_session(client, token, vehicle_id, today - timedelta(days=4), "100.25")
    create_work_session(client, token, vehicle_id, today, "200.25")

    response = client.get(f"/maintenance-plans/{plan['id']}/status", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["km_since_last_service"] == "300.50"
    assert response.json()["km_remaining"] == "699.50"


def test_status_due_by_km(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-km-due@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()

    due_plan = create_plan(client, token, vehicle_id, {"interval_km": "1000.00"})
    create_record(client, token, int(due_plan["id"]), today - timedelta(days=1))
    create_work_session(client, token, vehicle_id, today, "1000.00")

    due_status = client.get(
        f"/maintenance-plans/{due_plan['id']}/status",
        headers=auth_headers(token),
    )

    assert due_status.status_code == 200
    assert due_status.json()["status"] == "due"
    assert due_status.json()["km_remaining"] == "0.00"


def test_status_due_soon_by_km(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-km-soon@email.com")
    vehicle_id = create_vehicle(client, token)
    plan = create_plan(client, token, vehicle_id, {"interval_km": "1000.00", "interval_days": 30})
    today = date.today()
    create_record(client, token, int(plan["id"]), today - timedelta(days=1))
    create_work_session(client, token, vehicle_id, today, "850.00")

    response = client.get(f"/maintenance-plans/{plan['id']}/status", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["status"] == "due_soon"
    assert response.json()["km_remaining"] == "150.00"


def test_status_ok_by_km(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-km-ok@email.com")
    vehicle_id = create_vehicle(client, token)
    plan = create_plan(client, token, vehicle_id, {"interval_km": "1000.00"})
    today = date.today()
    create_record(client, token, int(plan["id"]), today - timedelta(days=1))
    create_work_session(client, token, vehicle_id, today, "100.00")

    response = client.get(f"/maintenance-plans/{plan['id']}/status", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_status_due_soon_and_due_by_time(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-time-status@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    soon_plan = create_plan(
        client,
        token,
        vehicle_id,
        {"name": "Soon", "interval_km": None, "interval_days": 30},
    )
    due_plan = create_plan(
        client,
        token,
        vehicle_id,
        {"name": "Due", "interval_km": None, "interval_days": 30},
    )
    create_record(client, token, int(soon_plan["id"]), today - timedelta(days=16))
    create_record(client, token, int(due_plan["id"]), today - timedelta(days=30))

    soon_response = client.get(
        f"/maintenance-plans/{soon_plan['id']}/status",
        headers=auth_headers(token),
    )
    due_response = client.get(
        f"/maintenance-plans/{due_plan['id']}/status",
        headers=auth_headers(token),
    )

    assert soon_response.status_code == 200
    assert soon_response.json()["status"] == "due_soon"
    assert soon_response.json()["days_remaining"] == 14
    assert due_response.json()["status"] == "due"
    assert due_response.json()["days_remaining"] == 0


def test_combined_km_and_time_due_wins(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-combined@email.com")
    vehicle_id = create_vehicle(client, token)
    today = date.today()
    plan = create_plan(
        client,
        token,
        vehicle_id,
        {"interval_km": "1000.00", "interval_days": 30},
    )
    create_record(client, token, int(plan["id"]), today - timedelta(days=30))
    create_work_session(client, token, vehicle_id, today, "100.00")

    response = client.get(f"/maintenance-plans/{plan['id']}/status", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["status"] == "due"
    assert response.json()["km_since_last_service"] == "100.00"
    assert response.json()["days_since_last_service"] == 30


def test_recommended_reserve_precision_and_inactive_plan(client: TestClient) -> None:
    token = register_and_login(client, "maintenance-reserve@email.com")
    vehicle_id = create_vehicle(client, token)
    plan = create_plan(
        client,
        token,
        vehicle_id,
        {"interval_km": "3000.00", "estimated_cost": "100.00", "active": False},
    )

    response = client.get(f"/maintenance-plans/{plan['id']}/status", headers=auth_headers(token))
    get_response = client.get(f"/maintenance-plans/{plan['id']}", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["estimated_cost"] == "100.00"
    assert response.json()["recommended_reserve_per_km"] == "0.0333"
    assert get_response.json()["active"] is False


def test_plan_without_records_uses_plan_creation_date(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "maintenance-no-record@email.com")
    vehicle_id = create_vehicle(client, token)
    plan = create_plan(client, token, vehicle_id, {"interval_km": "1000.00", "interval_days": 30})
    created_date = date.today() - timedelta(days=3)
    db_session.execute(
        update(MaintenancePlan)
        .where(MaintenancePlan.id == plan["id"])
        .values(created_at=created_date, updated_at=created_date)
    )
    db_session.commit()
    create_work_session(client, token, vehicle_id, created_date - timedelta(days=1), "900.00")
    create_work_session(client, token, vehicle_id, created_date, "100.00")
    create_work_session(client, token, vehicle_id, created_date + timedelta(days=1), "200.00")

    response = client.get(f"/maintenance-plans/{plan['id']}/status", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["km_since_last_service"] == "300.00"
    assert response.json()["days_since_last_service"] == 3
