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
from app.models import Expense
from app.work_session_imports import MAX_FILE_SIZE_BYTES, MAX_IMPORT_ERRORS, MAX_ROWS

CSV_HEADER = "expense_date,amount,category,description\n"


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
        + "2026-09-20,35.50,fuel,Gasolina\n"
        + "2026-09-21,12.34,pedagio,Pedagio rodovia\n"
    )


def post_preview(
    client: TestClient,
    token: str,
    csv_content: str,
    vehicle_id: int | None = None,
    column_mapping: dict[str, str] | None = None,
) -> Response:
    params: list[str] = []
    if vehicle_id is not None:
        params.append(f"vehicle_id={vehicle_id}")
    if column_mapping is not None:
        params.append(f"column_mapping={quote(json.dumps(column_mapping))}")
    path = "/imports/expenses/preview"
    if params:
        path += f"?{'&'.join(params)}"

    return cast(
        Response,
        client.post(path, content=csv_content.encode("utf-8"), headers=csv_headers(token)),
    )


def post_import(
    client: TestClient,
    token: str,
    csv_content: str,
    vehicle_id: int | None = None,
    column_mapping: dict[str, str] | None = None,
) -> Response:
    params: list[str] = []
    if vehicle_id is not None:
        params.append(f"vehicle_id={vehicle_id}")
    if column_mapping is not None:
        params.append(f"column_mapping={quote(json.dumps(column_mapping))}")
    path = "/imports/expenses"
    if params:
        path += f"?{'&'.join(params)}"

    return cast(
        Response,
        client.post(path, content=csv_content.encode("utf-8"), headers=csv_headers(token)),
    )


def count_expenses(db_session: Session) -> int:
    return len(db_session.scalars(select(Expense)).all())


def test_expense_import_preview_valid_does_not_persist(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "preview-expenses@email.com")

    response = post_preview(client, token, valid_csv())
    data = response.json()

    assert response.status_code == 200
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 2
    assert data["invalid_rows"] == 0
    assert data["columns_found"] == [
        "expense_date",
        "amount",
        "category",
        "description",
    ]
    assert data["rows"][0]["amount"] == "35.50"
    assert data["rows"][1]["category"] == "toll"
    assert count_expenses(db_session) == 0


def test_expense_import_preview_rejects_rows_with_extra_columns(client: TestClient) -> None:
    token = register_and_login(client, "extra-columns-expenses@email.com")
    csv_content = CSV_HEADER + ",,,,valor excedente\n"

    response = post_preview(client, token, csv_content)

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


def test_expense_import_valid_multiple_rows_and_precision(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "import-expenses@email.com")
    vehicle_id = create_vehicle(client, token)

    response = post_import(client, token, valid_csv(), vehicle_id=vehicle_id)
    expenses = db_session.scalars(select(Expense).order_by(Expense.expense_date)).all()

    assert response.status_code == 200
    assert response.json()["imported"] == 2
    assert len(expenses) == 2
    assert expenses[0].vehicle_id == vehicle_id
    assert expenses[1].amount_cents == 1234


def test_expense_import_normalizes_category_and_defaults_to_other(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "categories-expenses@email.com")
    csv_content = (
        CSV_HEADER
        + "2026-09-20,10.00,combustivel,Posto\n"
        + "2026-09-21,20.00,categoria nova,Algo\n"
        + "2026-09-22,30.00,,Sem categoria\n"
    )

    response = post_import(client, token, csv_content)
    categories = [
        expense.category
        for expense in db_session.scalars(select(Expense).order_by(Expense.expense_date)).all()
    ]

    assert response.status_code == 200
    assert categories == ["fuel", "other", "other"]


def test_expense_import_accepts_missing_optional_fields(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "optional-expenses@email.com")
    csv_content = "expense_date,amount\n2026-09-20,10.00\n"

    response = post_import(client, token, csv_content)
    expense = db_session.scalar(select(Expense))

    assert response.status_code == 200
    assert response.json()["imported"] == 1
    assert expense is not None
    assert expense.vehicle_id is None
    assert expense.category == "other"
    assert expense.description is None


def test_expense_import_rejects_vehicle_from_other_user(client: TestClient) -> None:
    user_a_token = register_and_login(client, "expense-vehicle-a@email.com")
    user_b_token = register_and_login(client, "expense-vehicle-b@email.com")
    user_b_vehicle = create_vehicle(client, user_b_token)

    response = post_import(client, user_a_token, valid_csv(), vehicle_id=user_b_vehicle)

    assert response.status_code == 404


def test_expense_import_without_token_returns_401(client: TestClient) -> None:
    response = client.post(
        "/imports/expenses",
        content=valid_csv().encode("utf-8"),
        headers={"Content-Type": "text/csv"},
    )

    assert response.status_code == 401


def test_expense_import_supports_automatic_and_manual_mapping(client: TestClient) -> None:
    token = register_and_login(client, "mapping-expenses@email.com")
    auto_response = post_preview(
        client,
        token,
        "data,valor,categoria,descricao\n2026-09-20,10.00,seguro,Apolice\n",
    )
    manual_response = post_preview(
        client,
        token,
        "quando,total,tipo,obs\n2026-09-20,10.00,lavagem,Lava rapido\n",
        column_mapping={
            "expense_date": "quando",
            "amount": "total",
            "category": "tipo",
            "description": "obs",
        },
    )

    assert auto_response.status_code == 200
    assert auto_response.json()["suggested_mapping"]["expense_date"] == "data"
    assert auto_response.json()["rows"][0]["category"] == "insurance"
    assert manual_response.status_code == 200
    assert manual_response.json()["rows"][0]["category"] == "washing"


@pytest.mark.parametrize(
    ("csv_content", "field"),
    [
        ("expense_date,category\n2026-09-20,fuel\n", "amount"),
        (CSV_HEADER + "20-09-2026,10.00,fuel,Posto\n", "expense_date"),
        (CSV_HEADER + "2026-09-20,valor,fuel,Posto\n", "amount"),
        (CSV_HEADER + "2026-09-20,0,fuel,Posto\n", "amount"),
        (CSV_HEADER + "2026-09-20,=10,fuel,Posto\n", "amount"),
    ],
)
def test_expense_import_preview_returns_errors_for_invalid_rows(
    client: TestClient,
    csv_content: str,
    field: str,
) -> None:
    token = register_and_login(client, f"invalid-expense-{field}@email.com")

    response = post_preview(client, token, csv_content)

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 0
    assert response.json()["errors"][0]["field"] == field


def test_expense_import_rejects_empty_file(client: TestClient) -> None:
    token = register_and_login(client, "empty-expenses@email.com")

    response = post_preview(client, token, "")

    assert response.status_code == 400


def test_expense_import_preview_rejects_body_above_size_limit(client: TestClient) -> None:
    token = register_and_login(client, "oversized-expenses@email.com")
    csv_content = "x" * (MAX_FILE_SIZE_BYTES + 1)

    response = post_preview(client, token, csv_content)

    assert response.status_code == 413
    assert response.json()["detail"] == "CSV too large."


def test_expense_import_preview_accepts_body_at_exact_size_limit(client: TestClient) -> None:
    token = register_and_login(client, "exact-size-expenses@email.com")
    header = CSV_HEADER.rstrip("\n") + ",ignored\n"
    row_prefix = "2026-09-20,10.00,fuel,Posto,"
    suffix = "\n"
    filler_size = MAX_FILE_SIZE_BYTES - len((header + row_prefix + suffix).encode("utf-8"))
    csv_content = header + row_prefix + ("x" * filler_size) + suffix

    response = post_preview(client, token, csv_content)

    assert response.status_code == 200
    assert response.json()["valid_rows"] == 1
    assert response.json()["errors"] == []


def test_expense_import_preview_stops_when_row_limit_is_exceeded(client: TestClient) -> None:
    token = register_and_login(client, "row-limit-expenses@email.com")
    csv_content = CSV_HEADER + ("2026-09-20,10.00,fuel,Posto\n" * (MAX_ROWS + 1))

    response = post_preview(client, token, csv_content)

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


def test_expense_import_preview_limits_returned_errors(client: TestClient) -> None:
    token = register_and_login(client, "error-limit-expenses@email.com")
    csv_content = CSV_HEADER + ("invalid,valor,fuel,Posto\n" * (MAX_IMPORT_ERRORS + 10))

    response = post_preview(client, token, csv_content)

    assert response.status_code == 200
    assert response.json()["invalid_rows"] == MAX_IMPORT_ERRORS + 10
    assert len(response.json()["errors"]) == MAX_IMPORT_ERRORS


def test_expense_import_is_transactional_when_any_row_is_invalid(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "transaction-expenses@email.com")
    csv_content = CSV_HEADER + "2026-09-20,10.00,fuel,Posto\ninvalid,20.00,toll,Pedagio\n"

    response = post_import(client, token, csv_content)

    assert response.status_code == 200
    assert response.json()["imported"] == 0
    assert count_expenses(db_session) == 0


def test_expense_import_repeated_csv_skips_duplicates(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "duplicate-expenses@email.com")

    first_response = post_import(client, token, valid_csv())
    second_response = post_import(client, token, valid_csv())

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json()["duplicates_skipped"] == 2
    assert count_expenses(db_session) == 2


def test_expense_import_allows_same_date_with_different_expenses(
    client: TestClient,
    db_session: Session,
) -> None:
    token = register_and_login(client, "same-date-expenses@email.com")
    csv_content = (
        CSV_HEADER
        + "2026-09-20,10.00,fuel,Posto\n"
        + "2026-09-20,15.00,fuel,Outro posto\n"
    )

    response = post_import(client, token, csv_content)

    assert response.status_code == 200
    assert response.json()["imported"] == 2
    assert count_expenses(db_session) == 2


def test_expense_import_isolated_between_users(
    client: TestClient,
    db_session: Session,
) -> None:
    user_a_token = register_and_login(client, "expense-isolation-a@email.com")
    user_b_token = register_and_login(client, "expense-isolation-b@email.com")

    user_a_response = post_import(client, user_a_token, valid_csv())
    user_b_response = post_import(client, user_b_token, valid_csv())

    assert user_a_response.status_code == 200
    assert user_b_response.status_code == 200
    assert user_b_response.json()["imported"] == 2
    assert count_expenses(db_session) == 4
