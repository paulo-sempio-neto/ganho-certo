import json
from collections.abc import Generator
from typing import cast
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Plan, User, WorkSession
from app.work_session_imports import MAX_FILE_SIZE_BYTES, MAX_IMPORT_ERRORS, MAX_ROWS

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
    column_mapping: dict[str, str] | None = None,
) -> Response:
    path = f"/imports/work-sessions/preview?vehicle_id={vehicle_id}"
    if column_mapping is not None:
        path += f"&column_mapping={quote(json.dumps(column_mapping))}"

    return cast(
        Response,
        client.post(
            path,
            content=csv_content.encode("utf-8"),
            headers=csv_headers(token),
        ),
    )


def post_import(
    client: TestClient,
    token: str,
    vehicle_id: int,
    csv_content: str,
    column_mapping: dict[str, str] | None = None,
) -> Response:
    path = f"/imports/work-sessions?vehicle_id={vehicle_id}"
    if column_mapping is not None:
        path += f"&column_mapping={quote(json.dumps(column_mapping))}"

    return cast(
        Response,
        client.post(
            path,
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
        "columns_found": [
            "date",
            "gross_revenue",
            "distance_km",
            "worked_minutes",
            "trip_count",
        ],
        "suggested_mapping": {
            "date": "date",
            "gross_revenue": "gross_revenue",
            "distance_km": "distance_km",
            "worked_minutes": "worked_minutes",
            "trip_count": "trip_count",
        },
        "column_mapping": {
            "date": "date",
            "gross_revenue": "gross_revenue",
            "distance_km": "distance_km",
            "worked_minutes": "worked_minutes",
            "trip_count": "trip_count",
        },
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


def test_free_plan_cannot_preview_or_import_work_session_csv(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "free-work-session-import@email.com", plan_code="free")
    vehicle_id = create_vehicle(client, token)

    preview_response = post_preview(client, token, vehicle_id, valid_csv())
    import_response = post_import(client, token, vehicle_id, valid_csv())

    assert preview_response.status_code == 403
    assert preview_response.json() == {
        "code": "plan_limit_reached",
        "detail": "Seu plano atual nao inclui importacao CSV.",
    }
    assert import_response.status_code == 403
    assert count_work_sessions(db_session) == 0


def test_preview_rejects_rows_with_extra_columns(client: TestClient) -> None:
    token = register_and_login(client, "extra-columns-work-sessions@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = CSV_HEADER + ",,,,,valor excedente\n"

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 0
    assert response.json()["invalid_rows"] == 1
    assert response.json()["errors"] == [
        {
            "row": 2,
            "field": "file",
            "message": "Linha CSV possui mais colunas do que o cabeçalho.",
        }
    ]


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


def test_preview_suggests_simple_aliases(client: TestClient) -> None:
    token = register_and_login(client, "aliases@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = (
        "data,ganhos,km,minutos,corridas\n"
        "2026-09-20,350.50,180.40,480,22\n"
    )

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["columns_found"] == ["data", "ganhos", "km", "minutos", "corridas"]
    assert response.json()["suggested_mapping"] == {
        "date": "data",
        "gross_revenue": "ganhos",
        "distance_km": "km",
        "worked_minutes": "minutos",
        "trip_count": "corridas",
    }
    assert response.json()["valid_rows"] == 1


def test_preview_accepts_manual_mapping(client: TestClient) -> None:
    token = register_and_login(client, "manual-mapping@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = "Dia,Valor,Distancia,Tempo\n2026-09-20,350.50,180.40,480\n"

    response = post_preview(
        client,
        token,
        vehicle_id,
        csv_content,
        {
            "date": "Dia",
            "gross_revenue": "Valor",
            "distance_km": "Distancia",
            "worked_minutes": "Tempo",
        },
    )

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 1
    assert response.json()["rows"][0]["trip_count"] == 0
    assert response.json()["column_mapping"] == {
        "date": "Dia",
        "gross_revenue": "Valor",
        "distance_km": "Distancia",
        "worked_minutes": "Tempo",
    }


def test_preview_rejects_missing_required_mapping(client: TestClient) -> None:
    token = register_and_login(client, "missing-mapping@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = "Dia,Valor,Distancia,Tempo\n2026-09-20,350.50,180.40,480\n"

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 0
    assert response.json()["errors"][0]["message"] == "Mapeamento obrigatório não informado."


def test_preview_rejects_missing_column_in_mapping(client: TestClient) -> None:
    token = register_and_login(client, "missing-column@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = "Dia,Valor,Distancia,Tempo\n2026-09-20,350.50,180.40,480\n"

    response = post_preview(
        client,
        token,
        vehicle_id,
        csv_content,
        {
            "date": "Dia",
            "gross_revenue": "Valor",
            "distance_km": "Distancia",
            "worked_minutes": "Minutos",
        },
    )

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 0
    assert response.json()["errors"][0]["field"] == "worked_minutes"
    assert response.json()["errors"][0]["message"] == "Coluna mapeada não encontrada no CSV."


def test_preview_rejects_duplicate_mapping(client: TestClient) -> None:
    token = register_and_login(client, "duplicate-mapping@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = "Dia,Valor,Distancia,Tempo\n2026-09-20,350.50,180.40,480\n"

    response = post_preview(
        client,
        token,
        vehicle_id,
        csv_content,
        {
            "date": "Dia",
            "gross_revenue": "Valor",
            "distance_km": "Distancia",
            "worked_minutes": "Distancia",
        },
    )

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 0
    assert any(
        error["message"] == "A mesma coluna não pode ser usada para mais de um campo."
        for error in response.json()["errors"]
    )


def test_ambiguous_mapping_does_not_import_automatically(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "ambiguous-mapping@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = "data,data,ganhos,km,minutos\n2026-09-20,2026-09-20,350.50,180.40,480\n"

    response = post_import(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["imported"] == 0
    assert response.json()["failed"] == 1
    assert count_work_sessions(db_session) == 0


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
            "quando,valor,distancia,tempo,total\n"
            "2026-09-20,10,1,60,1\n",
            "date",
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


def test_preview_rejects_body_above_size_limit(client: TestClient) -> None:
    token = register_and_login(client, "oversized-work-sessions@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = "x" * (MAX_FILE_SIZE_BYTES + 1)

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 413
    assert response.json()["detail"] == "CSV too large."


def test_preview_accepts_body_at_exact_size_limit(client: TestClient) -> None:
    token = register_and_login(client, "exact-size-work-sessions@email.com")
    vehicle_id = create_vehicle(client, token)
    header = CSV_HEADER.rstrip("\n") + ",ignored\n"
    row_prefix = "2026-09-20,10.00,1.00,60,1,"
    suffix = "\n"
    filler_size = MAX_FILE_SIZE_BYTES - len((header + row_prefix + suffix).encode("utf-8"))
    csv_content = header + row_prefix + ("x" * filler_size) + suffix

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 1
    assert response.json()["errors"] == []


def test_preview_stops_when_row_limit_is_exceeded(client: TestClient) -> None:
    token = register_and_login(client, "row-limit-work-sessions@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = CSV_HEADER + ("2026-09-20,10.00,1.00,60,1\n" * (MAX_ROWS + 1))

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["total_rows"] == MAX_ROWS + 1
    assert response.json()["valid_rows"] == MAX_ROWS
    assert response.json()["invalid_rows"] == 1
    assert response.json()["errors"] == [
        {
            "row": MAX_ROWS + 2,
            "field": "file",
            "message": "Limite de linhas excedido.",
        }
    ]


def test_preview_limits_returned_errors(client: TestClient) -> None:
    token = register_and_login(client, "error-limit-work-sessions@email.com")
    vehicle_id = create_vehicle(client, token)
    csv_content = CSV_HEADER + (
        "invalid,valor,km,0,-1\n" * (MAX_IMPORT_ERRORS + 10)
    )

    response = post_preview(client, token, vehicle_id, csv_content)

    assert response.status_code == 200
    assert response.json()["invalid_rows"] == MAX_IMPORT_ERRORS + 10
    assert len(response.json()["errors"]) == MAX_IMPORT_ERRORS


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
