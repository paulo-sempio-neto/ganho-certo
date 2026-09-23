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


def test_create_vehicle_authenticated(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")

    response = client.post("/vehicles", json=vehicle_payload(), headers=auth_headers(token))

    assert response.status_code == 201
    assert response.json()["name"] == "Carro do app"
    assert response.json()["fuel_type"] == "flex"
    assert "user" not in response.json()
    assert "user_id" not in response.json()


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
