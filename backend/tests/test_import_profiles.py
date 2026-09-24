from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import CsvImportProfile

HEADERS = ["date", "gross_revenue", "distance_km", "worked_minutes", "trip_count"]
MAPPING = {
    "date": "date",
    "gross_revenue": "gross_revenue",
    "distance_km": "distance_km",
    "worked_minutes": "worked_minutes",
    "trip_count": "trip_count",
}
EXPENSE_HEADERS = ["expense_date", "amount", "category", "description"]
EXPENSE_MAPPING = {
    "expense_date": "expense_date",
    "amount": "amount",
    "category": "category",
    "description": "description",
}


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


def create_profile(
    client: TestClient,
    token: str,
    vehicle_id: int | None = None,
    name: str = "App CSV",
    headers: list[str] | None = None,
    mapping: dict[str, str] | None = None,
    import_type: str = "work_sessions",
) -> dict[str, object]:
    response = client.post(
        "/import-profiles",
        json={
            "name": name,
            "import_type": import_type,
            "headers": headers or HEADERS,
            "column_mapping": mapping or MAPPING,
            "vehicle_id": vehicle_id,
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return dict(response.json())


def test_create_list_update_delete_import_profile(client: TestClient) -> None:
    token = register_and_login(client, "paulo@example.com")
    vehicle_id = create_vehicle(client, token)

    profile = create_profile(client, token, vehicle_id=vehicle_id)
    list_response = client.get("/import-profiles", headers=auth_headers(token))
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    update_response = client.put(
        f"/import-profiles/{profile['id']}",
        json={"name": "CSV do app"},
        headers=auth_headers(token),
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "CSV do app"

    delete_response = client.delete(
        f"/import-profiles/{profile['id']}",
        headers=auth_headers(token),
    )
    assert delete_response.status_code == 204

    assert client.get("/import-profiles", headers=auth_headers(token)).json() == []


def test_import_profiles_require_authentication(client: TestClient) -> None:
    response = client.get("/import-profiles")

    assert response.status_code == 401


def test_import_profile_isolated_between_users(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@example.com")
    user_b_token = register_and_login(client, "b@example.com")
    profile = create_profile(client, user_a_token)

    list_response = client.get("/import-profiles", headers=auth_headers(user_b_token))
    match_response = client.post(
        "/import-profiles/match",
        json={"import_type": "work_sessions", "headers": HEADERS},
        headers=auth_headers(user_b_token),
    )
    update_response = client.put(
        f"/import-profiles/{profile['id']}",
        json={"name": "Outro nome"},
        headers=auth_headers(user_b_token),
    )

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert match_response.status_code == 200
    assert match_response.json()["profile"] is None
    assert update_response.status_code == 404


def test_import_profile_rejects_vehicle_from_other_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "a@example.com")
    user_b_token = register_and_login(client, "b@example.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = client.post(
        "/import-profiles",
        json={
            "name": "CSV",
            "import_type": "work_sessions",
            "headers": HEADERS,
            "column_mapping": MAPPING,
            "vehicle_id": user_b_vehicle,
        },
        headers=auth_headers(user_a_token),
    )

    assert response.status_code == 404


def test_import_profile_validates_mapping(client: TestClient) -> None:
    token = register_and_login(client, "paulo@example.com")

    response = client.post(
        "/import-profiles",
        json={
            "name": "CSV",
            "import_type": "work_sessions",
            "headers": HEADERS,
            "column_mapping": {"date": "missing_column"},
        },
        headers=auth_headers(token),
    )

    assert response.status_code == 422


def test_match_import_profile_by_header_signature(client: TestClient) -> None:
    token = register_and_login(client, "paulo@example.com")
    vehicle_id = create_vehicle(client, token)
    create_profile(client, token, vehicle_id=vehicle_id)

    response = client.post(
        "/import-profiles/match",
        json={
            "import_type": "work_sessions",
            "headers": [
                " date ",
                " gross_revenue ",
                " distance_km ",
                " worked_minutes ",
                " trip_count ",
            ],
        },
        headers=auth_headers(token),
    )
    data = response.json()

    assert response.status_code == 200
    assert data["profile"]["name"] == "App CSV"
    assert data["vehicle_id"] == vehicle_id
    assert data["column_mapping"]["date"] == " date "


def test_match_import_profile_returns_none_for_different_headers(client: TestClient) -> None:
    token = register_and_login(client, "paulo@example.com")
    create_profile(client, token)

    response = client.post(
        "/import-profiles/match",
        json={"import_type": "work_sessions", "headers": ["data", "ganho"]},
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert response.json()["profile"] is None


def test_match_ignores_missing_saved_vehicle(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client, "paulo@example.com")
    vehicle_id = create_vehicle(client, token)
    profile = create_profile(client, token, vehicle_id=vehicle_id)

    db_session.execute(
        update(CsvImportProfile)
        .where(CsvImportProfile.id == profile["id"])
        .values(vehicle_id=9999)
    )
    db_session.commit()

    response = client.post(
        "/import-profiles/match",
        json={"import_type": "work_sessions", "headers": HEADERS},
        headers=auth_headers(token),
    )
    data = response.json()

    assert response.status_code == 200
    assert data["profile"]["vehicle_id"] is None
    assert data["vehicle_id"] is None
    assert db_session.scalar(select(CsvImportProfile.vehicle_id)) == 9999


def test_expense_profiles_do_not_conflict_with_work_session_profiles(
    client: TestClient,
) -> None:
    token = register_and_login(client, "profiles-by-type@example.com")
    work_profile = create_profile(client, token, name="Jornadas")
    expense_profile = create_profile(
        client,
        token,
        name="Despesas",
        import_type="expenses",
        headers=EXPENSE_HEADERS,
        mapping=EXPENSE_MAPPING,
    )

    expense_match = client.post(
        "/import-profiles/match",
        json={"import_type": "expenses", "headers": EXPENSE_HEADERS},
        headers=auth_headers(token),
    )
    work_session_match = client.post(
        "/import-profiles/match",
        json={"import_type": "work_sessions", "headers": HEADERS},
        headers=auth_headers(token),
    )

    assert expense_match.status_code == 200
    assert expense_match.json()["profile"]["id"] == expense_profile["id"]
    assert expense_match.json()["profile"]["import_type"] == "expenses"
    assert work_session_match.status_code == 200
    assert work_session_match.json()["profile"]["id"] == work_profile["id"]
    assert work_session_match.json()["profile"]["import_type"] == "work_sessions"
