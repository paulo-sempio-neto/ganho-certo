from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Vehicle, WorkSession
from app.schemas import (
    WorkSessionImportError,
    WorkSessionImportPreview,
    WorkSessionImportResult,
    WorkSessionImportRow,
)
from app.work_sessions import money_to_cents

router = APIRouter(prefix="/imports/work-sessions", tags=["imports"])

EXPECTED_HEADER = ["date", "gross_revenue", "distance_km", "worked_minutes", "trip_count"]
REQUIRED_MAPPING_FIELDS = ["date", "gross_revenue", "distance_km", "worked_minutes"]
OPTIONAL_MAPPING_FIELDS = ["trip_count"]
MAPPING_FIELDS = REQUIRED_MAPPING_FIELDS + OPTIONAL_MAPPING_FIELDS
FIELD_ALIASES = {
    "date": ["date", "data", "trip_date", "work_date"],
    "gross_revenue": ["gross_revenue", "revenue", "earnings", "faturamento", "ganho", "ganhos"],
    "distance_km": ["distance_km", "distance", "km", "quilometragem"],
    "worked_minutes": ["worked_minutes", "minutes", "duration_minutes", "minutos"],
    "trip_count": ["trip_count", "trips", "corridas", "rides"],
}
MAX_FILE_SIZE_BYTES = 1024 * 1024
MAX_ROWS = 1000
MONEY_QUANT = Decimal("0.01")
DISTANCE_QUANT = Decimal("0.01")
DANGEROUS_PREFIXES = ("=", "+", "-", "@")


@dataclass(frozen=True)
class ParsedWorkSessionImportRow:
    row: int
    work_date: date
    gross_revenue: Decimal
    distance_km: Decimal
    worked_minutes: int
    trip_count: int
    fingerprint: str


def get_user_vehicle(vehicle_id: int, user_id: int, db: Session) -> Vehicle:
    vehicle = db.scalar(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id)
    )
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    return vehicle


def decode_csv(content: bytes) -> str:
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty.")

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="CSV too large.",
        )

    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV encoding must be UTF-8.",
        ) from exc


def is_dangerous_cell(value: str) -> bool:
    stripped = value.lstrip()
    return stripped.startswith(DANGEROUS_PREFIXES)


def parse_money(value: str) -> Decimal:
    normalized = value.strip()
    if not normalized or is_dangerous_cell(normalized):
        raise ValueError("Valor monetário inválido.")

    try:
        parsed = Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError("Valor monetário inválido.") from exc

    if parsed < 0:
        raise ValueError("Valor monetário inválido.")

    return parsed.quantize(MONEY_QUANT)


def parse_distance(value: str) -> Decimal:
    normalized = value.strip()
    if not normalized or is_dangerous_cell(normalized):
        raise ValueError("Km inválido.")

    try:
        parsed = Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError("Km inválido.") from exc

    if parsed < 0:
        raise ValueError("Km inválido.")

    return parsed.quantize(DISTANCE_QUANT)


def parse_required_int(value: str, minimum: int, message: str) -> int:
    normalized = value.strip()
    if not normalized or is_dangerous_cell(normalized):
        raise ValueError(message)

    try:
        parsed = int(normalized)
    except ValueError as exc:
        raise ValueError(message) from exc

    if str(parsed) != normalized or parsed < minimum:
        raise ValueError(message)

    return parsed


def parse_date(value: str) -> date:
    normalized = value.strip()
    if not normalized or is_dangerous_cell(normalized):
        raise ValueError("Data inválida.")

    try:
        return date.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError("Data inválida.") from exc


def get_field(raw_row: dict[str, str | None], field: str) -> str:
    value = raw_row.get(field)
    return "" if value is None else value


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


def get_mapped_field(
    raw_row: dict[str, str | None],
    mapping: dict[str, str],
    field: str,
) -> str:
    column = mapping.get(field)
    if column is None:
        return ""

    return get_field(raw_row, column)


def make_fingerprint(
    vehicle_id: int,
    work_date: date,
    gross_revenue: Decimal,
    distance_km: Decimal,
    worked_minutes: int,
    trip_count: int,
) -> str:
    canonical = "|".join(
        [
            str(vehicle_id),
            work_date.isoformat(),
            f"{gross_revenue:.2f}",
            f"{distance_km:.2f}",
            str(worked_minutes),
            str(trip_count),
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def csv_row_to_preview_row(row: ParsedWorkSessionImportRow) -> WorkSessionImportRow:
    return WorkSessionImportRow(
        row=row.row,
        date=row.work_date,
        gross_revenue=row.gross_revenue,
        distance_km=row.distance_km,
        worked_minutes=row.worked_minutes,
        trip_count=row.trip_count,
    )


def parse_csv_content(
    content: bytes,
    vehicle_id: int,
    column_mapping: str | None = None,
) -> tuple[WorkSessionImportPreview, list[ParsedWorkSessionImportRow]]:
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
            WorkSessionImportPreview(
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

    parsed_rows: list[ParsedWorkSessionImportRow] = []
    preview_rows: list[WorkSessionImportRow] = []
    errors: list[WorkSessionImportError] = []
    total_rows = 0

    for row_number, raw_row in enumerate(reader, start=2):
        if raw_row is None or all(not (value or "").strip() for value in raw_row.values()):
            continue

        total_rows += 1
        if total_rows > MAX_ROWS:
            errors.append(
                WorkSessionImportError(
                    row=row_number,
                    field="file",
                    message="Limite de linhas excedido.",
                )
            )
            continue

        row_errors: list[WorkSessionImportError] = []

        try:
            work_date = parse_date(get_mapped_field(raw_row, effective_mapping, "date"))
        except ValueError as exc:
            row_errors.append(
                WorkSessionImportError(row=row_number, field="date", message=str(exc))
            )
            work_date = date.min

        try:
            gross_revenue = parse_money(
                get_mapped_field(raw_row, effective_mapping, "gross_revenue")
            )
        except ValueError as exc:
            row_errors.append(
                WorkSessionImportError(row=row_number, field="gross_revenue", message=str(exc))
            )
            gross_revenue = Decimal("0.00")

        try:
            distance_km = parse_distance(
                get_mapped_field(raw_row, effective_mapping, "distance_km")
            )
        except ValueError as exc:
            row_errors.append(
                WorkSessionImportError(row=row_number, field="distance_km", message=str(exc))
            )
            distance_km = Decimal("0.00")

        try:
            worked_minutes = parse_required_int(
                value=get_mapped_field(raw_row, effective_mapping, "worked_minutes"),
                minimum=1,
                message="Minutos inválidos.",
            )
        except ValueError as exc:
            row_errors.append(
                WorkSessionImportError(row=row_number, field="worked_minutes", message=str(exc))
            )
            worked_minutes = 0

        trip_count = 0
        if "trip_count" in effective_mapping:
            try:
                trip_count = parse_required_int(
                    value=get_mapped_field(raw_row, effective_mapping, "trip_count"),
                    minimum=0,
                    message="Corridas inválidas.",
                )
            except ValueError as exc:
                row_errors.append(
                    WorkSessionImportError(row=row_number, field="trip_count", message=str(exc))
                )
                trip_count = 0

        if row_errors:
            errors.extend(row_errors)
            continue

        parsed_row = ParsedWorkSessionImportRow(
            row=row_number,
            work_date=work_date,
            gross_revenue=gross_revenue,
            distance_km=distance_km,
            worked_minutes=worked_minutes,
            trip_count=trip_count,
            fingerprint=make_fingerprint(
                vehicle_id=vehicle_id,
                work_date=work_date,
                gross_revenue=gross_revenue,
                distance_km=distance_km,
                worked_minutes=worked_minutes,
                trip_count=trip_count,
            ),
        )
        parsed_rows.append(parsed_row)
        preview_rows.append(csv_row_to_preview_row(parsed_row))

    if total_rows == 0 and not errors:
        errors.append(
            WorkSessionImportError(
                row=1,
                field="file",
                message="CSV sem linhas para importar.",
            )
        )

    preview = WorkSessionImportPreview(
        total_rows=total_rows,
        valid_rows=len(parsed_rows),
        invalid_rows=len({error.row for error in errors}),
        columns_found=columns,
        suggested_mapping=suggested_mapping,
        column_mapping=effective_mapping,
        rows=preview_rows,
        errors=errors,
    )
    return preview, parsed_rows


@router.post("/preview", response_model=WorkSessionImportPreview)
def preview_work_session_import(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    vehicle_id: Annotated[int, Query(gt=0)],
    column_mapping: Annotated[str | None, Query()] = None,
    csv_content: Annotated[bytes, Body(media_type="text/csv")] = b"",
) -> WorkSessionImportPreview:
    get_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    preview, _ = parse_csv_content(
        content=csv_content,
        vehicle_id=vehicle_id,
        column_mapping=column_mapping,
    )
    return preview


@router.post("", response_model=WorkSessionImportResult)
def import_work_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    vehicle_id: Annotated[int, Query(gt=0)],
    column_mapping: Annotated[str | None, Query()] = None,
    csv_content: Annotated[bytes, Body(media_type="text/csv")] = b"",
) -> WorkSessionImportResult:
    get_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    preview, parsed_rows = parse_csv_content(
        content=csv_content,
        vehicle_id=vehicle_id,
        column_mapping=column_mapping,
    )
    if preview.errors:
        return WorkSessionImportResult(
            imported=0,
            duplicates_skipped=0,
            failed=preview.invalid_rows,
            errors=preview.errors,
        )

    existing_fingerprints = set(
        db.scalars(
            select(WorkSession.import_fingerprint).where(
                WorkSession.user_id == current_user.id,
                WorkSession.import_fingerprint.is_not(None),
            )
        ).all()
    )
    batch_fingerprints: set[str] = set()
    work_sessions: list[WorkSession] = []
    duplicates_skipped = 0

    for row in parsed_rows:
        if row.fingerprint in existing_fingerprints or row.fingerprint in batch_fingerprints:
            duplicates_skipped += 1
            continue

        batch_fingerprints.add(row.fingerprint)
        work_sessions.append(
            WorkSession(
                user_id=current_user.id,
                vehicle_id=vehicle_id,
                work_date=row.work_date,
                gross_revenue_cents=money_to_cents(row.gross_revenue),
                distance_km=row.distance_km,
                worked_minutes=row.worked_minutes,
                trip_count=row.trip_count,
                import_fingerprint=row.fingerprint,
            )
        )

    try:
        db.add_all(work_sessions)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Importação duplicada detectada.",
        ) from exc

    return WorkSessionImportResult(
        imported=len(work_sessions),
        duplicates_skipped=duplicates_skipped,
        failed=0,
    )
