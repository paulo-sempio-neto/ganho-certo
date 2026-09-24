from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import VehicleCostProfile


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


def cost_profile_payload() -> dict[str, object]:
    return {
        "ownership_type": "financed",
        "rental_monthly": None,
        "financing_monthly": "1800.55",
        "insurance_monthly": "250.10",
        "ipva_annual": "1450.99",
        "other_fixed_monthly": "75.25",
        "maintenance_per_km": "0.1800",
        "tires_per_km": "0.0500",
        "oil_per_km": "0.0300",
        "depreciation_per_km": "0.2100",
        "fuel_efficiency_km_per_liter": "10.50",
    }


def create_cost_profile(client: TestClient, token: str, vehicle_id: int) -> dict[str, object]:
    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=cost_profile_payload(),
        headers=auth_headers(token),
    )
    assert response.status_code == 200
    return dict(response.json())


def test_create_cost_profile_for_own_vehicle(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=cost_profile_payload(),
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["vehicle_id"] == vehicle_id
    assert body["ownership_type"] == "financed"
    assert body["financing_monthly"] == "1800.55"
    assert body["maintenance_per_km"] == "0.1800"
    assert "user_id" not in body


def test_update_cost_profile(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_cost_profile(client, token, vehicle_id)
    payload = cost_profile_payload()
    payload["ownership_type"] = "rented"
    payload["rental_monthly"] = "2200.00"
    payload["financing_monthly"] = None

    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=payload,
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["ownership_type"] == "rented"
    assert response.json()["rental_monthly"] == "2200.00"
    assert response.json()["financing_monthly"] is None


def test_get_cost_profile(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    created = create_cost_profile(client, token, vehicle_id)

    response = client.get(
        f"/vehicles/{vehicle_id}/cost-profile",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]
    assert response.json()["vehicle_id"] == vehicle_id


def test_user_cannot_get_cost_profile_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    vehicle_id = create_vehicle(client, user_b_token)
    create_cost_profile(client, user_b_token, vehicle_id)

    response = client.get(
        f"/vehicles/{vehicle_id}/cost-profile",
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_user_cannot_update_cost_profile_from_another_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@email.com")
    user_b_token = register_and_login(client, "b@email.com")
    vehicle_id = create_vehicle(client, user_b_token)

    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=cost_profile_payload(),
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_reject_negative_values(client: TestClient) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    for field in ("rental_monthly", "maintenance_per_km"):
        payload = cost_profile_payload()
        payload[field] = "-0.01"

        response = client.put(
            f"/vehicles/{vehicle_id}/cost-profile",
            json=payload,
            headers=auth_headers(token),
        )

        assert response.status_code == 422


def test_money_is_stored_as_cents_without_float_imprecision(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)

    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=cost_profile_payload(),
        headers=auth_headers(token),
    )
    profile = db_session.scalar(select(VehicleCostProfile))

    assert response.status_code == 200
    assert response.json()["financing_monthly"] == "1800.55"
    assert profile is not None
    assert profile.financing_monthly_cents == 180055


def test_cost_profile_normalizes_fields_incompatible_with_ownership_type(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "normalize-ownership@email.com")
    owned_vehicle = create_vehicle(client, token, "Proprio")
    rented_vehicle = create_vehicle(client, token, "Alugado")
    financed_vehicle = create_vehicle(client, token, "Financiado")

    owned_payload = cost_profile_payload()
    owned_payload["ownership_type"] = "owned"
    owned_payload["rental_monthly"] = "1000.00"
    owned_payload["financing_monthly"] = "2000.00"
    rented_payload = cost_profile_payload()
    rented_payload["ownership_type"] = "rented"
    rented_payload["rental_monthly"] = "1000.00"
    rented_payload["financing_monthly"] = "2000.00"
    financed_payload = cost_profile_payload()
    financed_payload["ownership_type"] = "financed"
    financed_payload["rental_monthly"] = "1000.00"
    financed_payload["financing_monthly"] = "2000.00"

    owned_response = client.put(
        f"/vehicles/{owned_vehicle}/cost-profile",
        json=owned_payload,
        headers=auth_headers(token),
    )
    rented_response = client.put(
        f"/vehicles/{rented_vehicle}/cost-profile",
        json=rented_payload,
        headers=auth_headers(token),
    )
    financed_response = client.put(
        f"/vehicles/{financed_vehicle}/cost-profile",
        json=financed_payload,
        headers=auth_headers(token),
    )
    profiles = {
        profile.vehicle_id: profile
        for profile in db_session.scalars(select(VehicleCostProfile)).all()
    }

    assert owned_response.status_code == 200
    assert owned_response.json()["rental_monthly"] is None
    assert owned_response.json()["financing_monthly"] is None
    assert profiles[owned_vehicle].rental_monthly_cents is None
    assert profiles[owned_vehicle].financing_monthly_cents is None
    assert rented_response.status_code == 200
    assert rented_response.json()["rental_monthly"] == "1000.00"
    assert rented_response.json()["financing_monthly"] is None
    assert profiles[rented_vehicle].rental_monthly_cents == 100000
    assert profiles[rented_vehicle].financing_monthly_cents is None
    assert financed_response.status_code == 200
    assert financed_response.json()["rental_monthly"] is None
    assert financed_response.json()["financing_monthly"] == "2000.00"
    assert profiles[financed_vehicle].rental_monthly_cents is None
    assert profiles[financed_vehicle].financing_monthly_cents == 200000


def test_cost_profile_integrity_error_returns_conflict_and_rolls_back(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = register_and_login(client, "cost-profile-race@email.com")
    vehicle_id = create_vehicle(client, token)
    original_commit = db_session.commit
    should_fail = True

    def fail_once() -> None:
        nonlocal should_fail
        if should_fail:
            should_fail = False
            raise IntegrityError("simulated cost profile race", {}, Exception())
        original_commit()

    monkeypatch.setattr(db_session, "commit", fail_once)

    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=cost_profile_payload(),
        headers=auth_headers(token),
    )
    profile_count = db_session.scalar(select(func.count()).select_from(VehicleCostProfile))

    assert response.status_code == 409
    assert (
        response.json()["detail"]
        == "Vehicle cost profile was updated concurrently. Please retry."
    )
    assert profile_count == 0


def test_only_one_profile_per_vehicle(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client, "paulo@email.com")
    vehicle_id = create_vehicle(client, token)
    create_cost_profile(client, token, vehicle_id)

    response = client.put(
        f"/vehicles/{vehicle_id}/cost-profile",
        json=cost_profile_payload(),
        headers=auth_headers(token),
    )
    profile_count = db_session.scalar(select(func.count()).select_from(VehicleCostProfile))

    assert response.status_code == 200
    assert profile_count == 1


def test_cost_profile_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/vehicles/1/cost-profile")

    assert response.status_code == 401
