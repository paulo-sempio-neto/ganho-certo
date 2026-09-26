from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.entitlements import CSV_IMPORT_FEATURE, has_feature_access, raise_plan_limit_reached
from app.expenses import money_to_cents, validate_user_vehicle
from app.models import Expense, User
from app.schemas import (
    ExpenseCategory,
    ExpenseImportPreview,
    ExpenseImportResult,
    ExpenseImportRow,
    WorkSessionImportError,
)
from app.work_session_imports import (
    MAX_IMPORT_ERRORS,
    MAX_ROWS,
    decode_csv,
    is_dangerous_cell,
    parse_date,
    parse_money,
    read_limited_csv_body,
)

router = APIRouter(prefix="/imports/expenses", tags=["imports"])

REQUIRED_MAPPING_FIELDS = ["expense_date", "amount"]
OPTIONAL_MAPPING_FIELDS = ["category", "description"]
MAPPING_FIELDS = REQUIRED_MAPPING_FIELDS + OPTIONAL_MAPPING_FIELDS
FIELD_ALIASES = {
    "expense_date": ["expense_date", "date", "data", "transaction_date", "transactiondate"],
    "amount": ["amount", "value", "valor", "expense", "despesa"],
    "category": ["category", "categoria", "type", "tipo"],
    "description": ["description", "descricao", "descrição", "memo", "details", "detalhes"],
}
EXPENSE_CATEGORIES: set[str] = {
    "fuel",
    "charging",
    "maintenance",
    "parking",
    "toll",
    "insurance",
    "rental",
    "financing",
    "washing",
    "other",
}
CATEGORY_ALIASES = {
    "fuel": ["fuel", "combustível", "combustivel", "gasolina", "etanol"],
    "charging": ["charging", "recarga", "energia"],
    "maintenance": ["maintenance", "manutenção", "manutencao"],
    "parking": ["parking", "estacionamento"],
    "toll": ["toll", "pedágio", "pedagio"],
    "insurance": ["insurance", "seguro"],
    "rental": ["rental", "aluguel"],
    "financing": ["financing", "financiamento"],
    "washing": ["washing", "lavagem"],
    "other": ["other", "outros", "outras"],
}
CATEGORY_BY_ALIAS = {
    alias: category
    for category, aliases in CATEGORY_ALIASES.items()
    for alias in aliases
}


@dataclass(frozen=True)
class ParsedExpenseImportRow:
    row: int
    expense_date: date
    amount: Decimal
    category: str
    description: str | None
    fingerprint: str


def enforce_csv_import_access(user: User, db: Session) -> None:
    if not has_feature_access(user, CSV_IMPORT_FEATURE, db):
        raise_plan_limit_reached("Seu plano atual nao inclui importacao CSV.")


def normalize_header(value: str) -> str:
    return value.strip().lower()


def suggest_column_mapping(columns: list[str]) -> dict[str, str]:
    normalized_columns: dict[str, list[str]] = {}
    for column in columns:
        normalized_columns.setdefault(normalize_header(column), []).append(column)

    suggested_mapping: dict[str, str] = {}
    for field, aliases in FIELD_ALIASES.items():
        matches: list[str] = []
        for alias in aliases:
            matches.extend(normalized_columns.get(alias, []))

        if len(matches) == 1:
            suggested_mapping[field] = matches[0]

    return suggested_mapping


def parse_column_mapping(column_mapping: str | None) -> dict[str, str]:
    if not column_mapping:
        return {}

    try:
        parsed = json.loads(column_mapping)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="column_mapping must be valid JSON.",
        ) from exc

    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="column_mapping must be an object.",
        )

    mapping: dict[str, str] = {}
    for field, column in parsed.items():
        if field not in MAPPING_FIELDS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid mapping field: {field}.",
            )
        if column in (None, ""):
            continue
        if not isinstance(column, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="column_mapping values must be strings.",
            )
        mapping[field] = column

    return mapping


def validate_column_mapping(
    columns: list[str],
    mapping: dict[str, str],
) -> list[WorkSessionImportError]:
    errors: list[WorkSessionImportError] = []
    columns_set = set(columns)

    for field in REQUIRED_MAPPING_FIELDS:
        if not mapping.get(field):
            errors.append(
                WorkSessionImportError(
                    row=1,
                    field=field,
                    message="Mapeamento obrigatório não informado.",
                )
            )

    for field, column in mapping.items():
        if column not in columns_set:
            errors.append(
                WorkSessionImportError(
                    row=1,
                    field=field,
                    message="Coluna mapeada não encontrada no CSV.",
                )
            )

    used_columns: dict[str, str] = {}
    for field, column in mapping.items():
        previous_field = used_columns.get(column)
        if previous_field is not None:
            errors.append(
                WorkSessionImportError(
                    row=1,
                    field=field,
                    message="A mesma coluna não pode ser usada para mais de um campo.",
                )
            )
            errors.append(
                WorkSessionImportError(
                    row=1,
                    field=previous_field,
                    message="A mesma coluna não pode ser usada para mais de um campo.",
                )
            )
        used_columns[column] = field

    return errors


def get_field(raw_row: dict[str, str | None], mapping: dict[str, str], field: str) -> str:
    column = mapping.get(field)
    if column is None:
        return ""

    value = raw_row.get(column)
    return "" if value is None else value


def normalize_category(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized or is_dangerous_cell(normalized):
        return "other"

    return CATEGORY_BY_ALIAS.get(normalized, "other")


def normalize_description(value: str) -> str | None:
    normalized = " ".join(value.strip().split())
    if not normalized:
        return None

    if is_dangerous_cell(normalized):
        return normalized[1:].strip() or None

    return normalized


def validate_amount(value: str) -> Decimal:
    amount = parse_money(value)
    if amount <= 0:
        raise ValueError("Valor inválido.")

    return amount


def make_fingerprint(
    user_id: int,
    vehicle_id: int | None,
    expense_date: date,
    category: str,
    amount: Decimal,
    description: str | None,
) -> str:
    normalized_description = " ".join((description or "").split()).lower()
    canonical = "|".join(
        [
            str(user_id),
            str(vehicle_id) if vehicle_id is not None else "",
            expense_date.isoformat(),
            category,
            f"{amount:.2f}",
            normalized_description,
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def csv_row_to_preview_row(row: ParsedExpenseImportRow) -> ExpenseImportRow:
    return ExpenseImportRow(
        row=row.row,
        expense_date=row.expense_date,
        amount=row.amount,
        category=cast(ExpenseCategory, row.category),
        description=row.description,
    )


def parse_csv_content(
    content: bytes,
    user_id: int,
    vehicle_id: int | None,
    column_mapping: str | None = None,
) -> tuple[ExpenseImportPreview, list[ParsedExpenseImportRow]]:
    decoded = decode_csv(content)
    stream = io.StringIO(decoded, newline="")
    reader = csv.DictReader(stream)
    columns = list(reader.fieldnames or [])
    suggested_mapping = suggest_column_mapping(columns)
    explicit_mapping = parse_column_mapping(column_mapping)
    effective_mapping = explicit_mapping or suggested_mapping

    mapping_errors = validate_column_mapping(columns=columns, mapping=effective_mapping)
    if not columns:
        mapping_errors.append(
            WorkSessionImportError(row=1, field="header", message="Cabeçalho inválido.")
        )

    if mapping_errors:
        return (
            ExpenseImportPreview(
                total_rows=0,
                valid_rows=0,
                invalid_rows=len({error.row for error in mapping_errors}),
                columns_found=columns,
                suggested_mapping=suggested_mapping,
                column_mapping=effective_mapping,
                rows=[],
                errors=mapping_errors,
            ),
            [],
        )

    parsed_rows: list[ParsedExpenseImportRow] = []
    preview_rows: list[ExpenseImportRow] = []
    errors: list[WorkSessionImportError] = []
    invalid_row_numbers: set[int] = set()
    total_rows = 0

    def add_error(error: WorkSessionImportError) -> None:
        invalid_row_numbers.add(error.row)
        if len(errors) < MAX_IMPORT_ERRORS:
            errors.append(error)

    for row_number, raw_row in enumerate(reader, start=2):
        if raw_row is None:
            continue

        if None in raw_row:
            total_rows += 1
            add_error(
                WorkSessionImportError(
                    row=row_number,
                    field="file",
                    message="Linha CSV possui mais colunas do que o cabeçalho.",
                )
            )
            continue

        if all(not (value or "").strip() for value in raw_row.values()):
            continue

        total_rows += 1
        if total_rows > MAX_ROWS:
            add_error(
                WorkSessionImportError(
                    row=row_number,
                    field="file",
                    message="Limite de linhas excedido.",
                )
            )
            break

        row_errors: list[WorkSessionImportError] = []

        try:
            expense_date = parse_date(get_field(raw_row, effective_mapping, "expense_date"))
        except ValueError as exc:
            row_errors.append(
                WorkSessionImportError(row=row_number, field="expense_date", message=str(exc))
            )
            expense_date = date.min

        try:
            amount = validate_amount(get_field(raw_row, effective_mapping, "amount"))
        except ValueError as exc:
            row_errors.append(
                WorkSessionImportError(row=row_number, field="amount", message=str(exc))
            )
            amount = Decimal("0.00")

        category = normalize_category(get_field(raw_row, effective_mapping, "category"))
        description = normalize_description(get_field(raw_row, effective_mapping, "description"))
        if description is not None and len(description) > 255:
            row_errors.append(
                WorkSessionImportError(
                    row=row_number,
                    field="description",
                    message="Descrição deve ter no máximo 255 caracteres.",
                )
            )

        if row_errors:
            for error in row_errors:
                add_error(error)
            continue

        parsed_row = ParsedExpenseImportRow(
            row=row_number,
            expense_date=expense_date,
            amount=amount,
            category=category,
            description=description,
            fingerprint=make_fingerprint(
                user_id=user_id,
                vehicle_id=vehicle_id,
                expense_date=expense_date,
                category=category,
                amount=amount,
                description=description,
            ),
        )
        parsed_rows.append(parsed_row)
        preview_rows.append(csv_row_to_preview_row(parsed_row))

    if total_rows == 0 and not errors:
        add_error(
            WorkSessionImportError(
                row=1,
                field="file",
                message="CSV sem linhas para importar.",
            )
        )

    preview = ExpenseImportPreview(
        total_rows=total_rows,
        valid_rows=len(parsed_rows),
        invalid_rows=len(invalid_row_numbers),
        columns_found=columns,
        suggested_mapping=suggested_mapping,
        column_mapping=effective_mapping,
        rows=preview_rows,
        errors=errors,
    )
    return preview, parsed_rows


@router.post("/preview", response_model=ExpenseImportPreview)
async def preview_expense_import(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
    vehicle_id: Annotated[int | None, Query(gt=0)] = None,
    column_mapping: Annotated[str | None, Query()] = None,
) -> ExpenseImportPreview:
    enforce_csv_import_access(current_user, db)
    validate_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    csv_content = await read_limited_csv_body(request)
    preview, _ = parse_csv_content(
        content=csv_content,
        user_id=current_user.id,
        vehicle_id=vehicle_id,
        column_mapping=column_mapping,
    )
    return preview


@router.post("", response_model=ExpenseImportResult)
async def import_expenses(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    request: Request,
    vehicle_id: Annotated[int | None, Query(gt=0)] = None,
    column_mapping: Annotated[str | None, Query()] = None,
) -> ExpenseImportResult:
    enforce_csv_import_access(current_user, db)
    validate_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    csv_content = await read_limited_csv_body(request)
    preview, parsed_rows = parse_csv_content(
        content=csv_content,
        user_id=current_user.id,
        vehicle_id=vehicle_id,
        column_mapping=column_mapping,
    )
    if preview.errors:
        return ExpenseImportResult(
            imported=0,
            duplicates_skipped=0,
            failed=preview.invalid_rows,
            errors=preview.errors,
        )

    parsed_fingerprints = {row.fingerprint for row in parsed_rows}
    existing_fingerprints = (
        set(
            db.scalars(
                select(Expense.import_fingerprint).where(
                    Expense.user_id == current_user.id,
                    Expense.import_fingerprint.in_(parsed_fingerprints),
                )
            ).all()
        )
        if parsed_fingerprints
        else set()
    )
    batch_fingerprints: set[str] = set()
    expenses: list[Expense] = []
    duplicates_skipped = 0

    for row in parsed_rows:
        if row.fingerprint in existing_fingerprints or row.fingerprint in batch_fingerprints:
            duplicates_skipped += 1
            continue

        batch_fingerprints.add(row.fingerprint)
        expenses.append(
            Expense(
                user_id=current_user.id,
                vehicle_id=vehicle_id,
                expense_date=row.expense_date,
                category=row.category,
                amount_cents=money_to_cents(row.amount),
                description=row.description,
                import_fingerprint=row.fingerprint,
            )
        )

    try:
        db.add_all(expenses)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Importação duplicada detectada.",
        ) from exc

    return ExpenseImportResult(
        imported=len(expenses),
        duplicates_skipped=duplicates_skipped,
        failed=0,
    )
