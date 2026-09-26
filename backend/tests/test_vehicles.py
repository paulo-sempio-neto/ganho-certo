from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Plan, User, Vehicle


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


def vehicle_payload(name: str = "Carro do app") -> dict[str, object]:
    return {
        "name": name,
        "brand": "Toyota",
        "model": "Corolla",
        "year": 2022,
        "fuel_type": "flex",
    }


def register_and_login(client: TestClient, email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"name": "Paulo", "email": email, "password": "senha123"},
    )
    assert response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": "senha123"},
    )
    assert login_response.status_code == 200
    return str(login_response.json()["access_token"])


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_vehicle(client: TestClient, token: str, name: str = "Carro do app") -> int:
    response = client.post(
        "/vehicles",
        json=vehicle_payload(name=name),
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def set_user_plan(db_session: Session, email: str, plan_code: str) -> None:
    user = db_session.scalar(select(User).where(User.email == email))
    plan = db_session.scalar(select(Plan).where(Plan.code == plan_code))
    assert user is not None
    assert plan is not None
    user.current_plan_id = plan.id
    db_session.commit()


def test_create_vehicle_authenticated(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")

    response = client.post("/vehicles", json=vehicle_payload(), headers=auth_headers(token))

    assert response.status_code == 201
    assert response.json()["name"] == "Carro do app"
    assert response.json()["fuel_type"] == "flex"
    assert "user" not in response.json()
    assert "user_id" not in response.json()


def test_free_plan_vehicle_limit_blocks_second_vehicle(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "free-limit@email.com")
    first_vehicle_id = create_vehicle(client, token, "Carro gratis")

    response = client.post(
        "/vehicles",
        json=vehicle_payload(name="Segundo carro"),
        headers=auth_headers(token),
    )
    user = db_session.scalar(select(User).where(User.email == "free-limit@email.com"))
    assert user is not None
    vehicles = db_session.scalars(select(Vehicle).where(Vehicle.user_id == user.id)).all()

    assert response.status_code == 403
    assert response.json() == {
        "code": "plan_limit_reached",
        "detail": "Seu plano atual atingiu o limite de veiculos cadastrados.",
    }
    assert [vehicle.id for vehicle in vehicles] == [first_vehicle_id]


def test_pro_plan_can_create_multiple_vehicles(
    client: TestClient,
    db_session: Session,
) -> None:
    email = "pro-vehicles@email.com"
    token = register_and_login(client, email)
    set_user_plan(db_session, email, "pro")

    first_vehicle_id = create_vehicle(client, token, "Carro Pro 1")
    second_vehicle_id = create_vehicle(client, token, "Carro Pro 2")

    assert second_vehicle_id != first_vehicle_id


def test_free_plan_can_edit_existing_vehicle_at_limit(client: TestClient) -> None:
    token = register_and_login(client, "free-edit-limit@email.com")
    vehicle_id = create_vehicle(client, token)
    payload = vehicle_payload(name="Carro atualizado no limite")

    response = client.put(
        f"/vehicles/{vehicle_id}",
        json=payload,
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Carro atualizado no limite"


def test_vehicle_limit_counts_only_current_user_vehicles(client: TestClient) -> None:
    user_a_token = register_and_login(client, "limit-isolation-a@email.com")
    user_b_token = register_and_login(client, "limit-isolation-b@email.com")

    user_a_vehicle = create_vehicle(client, user_a_token, "Carro A")
    user_b_vehicle = create_vehicle(client, user_b_token, "Carro B")

    assert user_a_vehicle != user_b_vehicle


def test_list_only_current_user_vehicles(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    create_vehicle(client, user_a_token, "Carro A")
    create_vehicle(client, user_b_token, "Carro B")

    response = client.get("/vehicles", headers=auth_headers(user_a_token))

    assert response.status_code == 200
    assert [vehicle["name"] for vehicle in response.json()] == ["Carro A"]


def test_get_own_vehicle(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.get(f"/vehicles/{vehicle_id}", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["id"] == vehicle_id


def test_update_own_vehicle(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    payload = vehicle_payload(name="Carro atualizado")
    payload["year"] = 2023

    response = client.put(
        f"/vehicles/{vehicle_id}",
        json=payload,
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Carro atualizado"
    assert response.json()["year"] == 2023


def test_delete_own_vehicle(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    delete_response = client.delete(f"/vehicles/{vehicle_id}", headers=auth_headers(token))
    get_response = client.get(f"/vehicles/{vehicle_id}", headers=auth_headers(token))

    assert delete_response.status_code == 204
    assert get_response.status_code == 404


def test_delete_vehicle_with_related_records_returns_conflict(client: TestClient) -> None:
    token = register_and_login(client, "vehicle-dependencies@email.com")
    vehicle_id = create_vehicle(client, token)
    work_session_response = client.post(
        "/work-sessions",
        json={
            "vehicle_id": vehicle_id,
            "work_date": "2026-09-23",
            "gross_revenue": "120.00",
            "distance_km": "40.00",
            "worked_minutes": 180,
            "trip_count": 8,
        },
        headers=auth_headers(token),
    )

    delete_response = client.delete(f"/vehicles/{vehicle_id}", headers=auth_headers(token))
    get_response = client.get(f"/vehicles/{vehicle_id}", headers=auth_headers(token))

    assert work_session_response.status_code == 201
    assert delete_response.status_code == 409
    assert delete_response.json()["detail"] == (
        "Vehicle cannot be deleted because it has related records."
    )
    assert get_response.status_code == 200


def test_vehicles_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/vehicles")

    assert response.status_code == 401


def test_user_cannot_get_vehicle_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    vehicle_id = create_vehicle(client, user_b_token)

    response = client.get(f"/vehicles/{vehicle_id}", headers=auth_headers(user_a_token))

    assert response.status_code == 404


def test_user_cannot_update_vehicle_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    vehicle_id = create_vehicle(client, user_b_token)

    response = client.put(
        f"/vehicles/{vehicle_id}",
        json=vehicle_payload(name="Tentativa"),
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_user_cannot_delete_vehicle_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    vehicle_id = create_vehicle(client, user_b_token)

    response = client.delete(f"/vehicles/{vehicle_id}", headers=auth_headers(user_a_token))

    assert response.status_code == 404
