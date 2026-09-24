from collections.abc import Generator
from typing import cast

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import WorkSession

CSV_HEADER = "date,gross_revenue,distance_km,worked_minutes,trip_count\n"


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


def csv_headers(token: str) -> dict[str, str]:
    return {**auth_headers(token), "Content-Type": "text/csv"}


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


def valid_csv() -> str:
    return (
        CSV_HEADER
        + "2026-09-20,350.50,180.40,480,22\n"
        + "2026-09-21,410.00,205.00,530,25\n"
    )


def post_preview(
    client: TestClient,
    token: str,
    vehicle_id: int,
    csv_content: str,
) -> Response:
    return cast(
        Response,
        client.post(
            f"/imports/work-sessions/preview?vehicle_id={vehicle_id}",
            content=csv_content.encode("utf-8"),
            headers=csv_headers(token),
        ),
    )


def post_import(
    client: TestClient,
    token: str,
    vehicle_id: int,
    csv_content: str,
) -> Response:
    return cast(
        Response,
        client.post(
            f"/imports/work-sessions?vehicle_id={vehicle_id}",
            content=csv_content.encode("utf-8"),
            headers=csv_headers(token),
        ),
    )


def count_work_sessions(db_session: Session) -> int:
    return len(db_session.scalars(select(WorkSession)).all())


def test_preview_valid_csv_normalizes_rows_without_persisting(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "preview@email.com")
    vehicle_id = create_vehicle(client, token)

    response = post_preview(client, token, vehicle_id, valid_csv())

    assert response.status_code == 200
    assert response.json() == {
        "total_rows": 2,
        "valid_rows": 2,
        "invalid_rows": 0,
        "rows": [
            {
                "row": 2,
                "date": "2026-09-20",
                "gross_revenue": "350.50",
                "distance_km": "180.40",
                "worked_minutes": 480,
                "trip_count": 22,
            },
            {
                "row": 3,
                "date": "2026-09-21",
                "gross_revenue": "410.00",
                "distance_km": "205.00",
                "worked_minutes": 530,
                "trip_count": 25,
            },
        ],
        "errors": [],
    }
    assert count_work_sessions(db_session) == 0


def test_import_valid_csv_imports_multiple_rows(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client, "import@email.com")
    vehicle_id = create_vehicle(client, token)

    response = post_import(client, token, vehicle_id, valid_csv())

    assert response.status_code == 200
    assert response.json() == {
        "imported": 2,
        "duplicates_skipped": 0,
        "failed": 0,
        "errors": [],
    }
    assert count_work_sessions(db_session) == 2


def test_import_preserves_money_precision(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client, "precision-import@email.com")
    vehicle_id = create_vehicle(client, token)

    response = post_import(client, token, vehicle_id, CSV_HEADER + "2026-09-20,0.30,1.00,60,1\n")

    assert response.status_code == 200
    work_session = db_session.scalar(select(WorkSession))
    assert work_session is not None
    assert work_session.gross_revenue_cents == 30
    assert f"{work_session.gross_revenue:.2f}" == "0.30"


def test_import_rejects_vehicle_from_other_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "vehicle-import-a@email.com")
    user_b_token = register_and_login(client, "vehicle-import-b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = post_import(client, user_a_token, user_b_vehicle, valid_csv())

    assert response.status_code == 404


def test_import_without_token_returns_401(client: TestClient) -> None:
    response = client.post(
        "/imports/work-sessions?vehicle_id=1",
        content=valid_csv().encode("utf-8"),
        headers={"Content-Type": "text/csv"},
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("csv_content", "field"),
    [
        (
            "gross_revenue,date,distance_km,worked_minutes,trip_count\n"
            "10,2026-09-20,1,60,1\n",
            "header",
        ),
        (CSV_HEADER + "20-09-2026,10.00,1.00,60,1\n", "date"),
        (CSV_HEADER + "2026-09-20,valor,1.00,60,1\n", "gross_revenue"),
        (CSV_HEADER + "2026-09-20,10.00,km,60,1\n", "distance_km"),
        (CSV_HEADER + "2026-09-20,10.00,1.00,0,1\n", "worked_minutes"),
        (CSV_HEADER + "2026-09-20,10.00,1.00,60,-1\n", "trip_count"),
        (CSV_HEADER + "2026-09-20,=10,1.00,60,1\n", "gross_revenue"),
    ],
)
def test_preview_returns_errors_for_invalid_csv_fields(
    client: TestClient,
    csv_content: str,
    field: str,
) -> None:
    token = register_and_login(client, f"invalid-{field}@email.com")
    vehicle_id = create_vehicle(client, token)

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 0
    assert response.json()["invalid_rows"] == 1
    assert response.json()["errors"][0]["field"] == field


def test_preview_rejects_empty_file(client: TestClient) -> None:
    token = register_and_login(client, "empty-import@email.com")
    vehicle_id = create_vehicle(client, token)

    response = post_preview(client, token, vehicle_id, "")

    assert response.status_code == 400


def test_preview_skips_empty_lines(client: TestClient) -> None:
    token = register_and_login(client, "empty-line-import@email.com")
    vehicle_id = create_vehicle(client, token)

    response = post_preview(
        client,
        token,
        vehicle_id,
        CSV_HEADER + "\n2026-09-20,100.00,10.00,60,1\n\n",
    )

    assert response.status_code == 200
    assert response.json()["total_rows"] == 1
    assert response.json()["valid_rows"] == 1
    assert response.json()["errors"] == []


def test_import_repeated_csv_skips_duplicates(client: TestClient, db_session: Session) -> None:
    token = register_and_login(client, "duplicate-import@email.com")
    vehicle_id = create_vehicle(client, token)

    first_response = post_import(client, token, vehicle_id, valid_csv())
    second_response = post_import(client, token, vehicle_id, valid_csv())

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json() == {
        "imported": 0,
        "duplicates_skipped": 2,
        "failed": 0,
        "errors": [],
    }
    assert count_work_sessions(db_session) == 2


def test_import_allows_same_date_with_different_journeys(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "same-date-import@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = (
        CSV_HEADER
        + "2026-09-20,100.00,10.00,60,1\n"
        + "2026-09-20,120.00,15.00,90,2\n"
    )

    response = post_import(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["imported"] == 2
    assert count_work_sessions(db_session) == 2


def test_import_is_transactional_when_any_row_is_invalid(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "transaction-import@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = (
        CSV_HEADER
        + "2026-09-20,100.00,10.00,60,1\n"
        + "2026-09-21,invalido,10.00,60,1\n"
    )

    response = post_import(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["imported"] == 0
    assert response.json()["failed"] == 1
    assert count_work_sessions(db_session) == 0


def test_import_isolated_between_users(client: TestClient, db_session: Session) -> None:
    user_a_token = register_and_login(client, "isolated-import-a@email.com")
    user_b_token = register_and_login(client, "isolated-import-b@email.com")
    vehicle_a = create_vehicle(client, user_a_token)
    vehicle_b = create_vehicle(client, user_b_token)

    response_a = post_import(client, user_a_token, vehicle_a, valid_csv())
    response_b = post_import(client, user_b_token, vehicle_b, valid_csv())

    assert response_a.status_code == 200
    assert response_b.status_code == 200
    assert response_a.json()["imported"] == 2
    assert response_b.json()["imported"] == 2
    assert count_work_sessions(db_session) == 4
