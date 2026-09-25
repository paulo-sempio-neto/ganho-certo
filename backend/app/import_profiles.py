import hashlib
import json
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.expense_imports import validate_column_mapping as validate_expense_column_mapping
from app.models import CsvImportProfile, User, Vehicle
from app.pagination import PaginationParams, get_pagination_params
from app.schemas import (
    CsvImportProfileCreate,
    CsvImportProfileMatchRequest,
    CsvImportProfileMatchResponse,
    CsvImportProfilePublic,
    CsvImportProfileUpdate,
)
from app.work_session_imports import validate_column_mapping as validate_work_session_column_mapping

router = APIRouter(prefix="/import-profiles", tags=["import-profiles"])


def normalize_headers(headers: list[str]) -> list[str]:
    return [header.strip() for header in headers]


def normalize_column_mapping(mapping: dict[str, str]) -> dict[str, str]:
    return {field: column.strip() for field, column in mapping.items()}


def adapt_mapping_to_headers(mapping: dict[str, str], headers: list[str]) -> dict[str, str]:
    headers_by_normalized = {header.strip().lower(): header for header in headers}
    adapted_mapping: dict[str, str] = {}
    for field, column in mapping.items():
        adapted_mapping[field] = headers_by_normalized.get(column.strip().lower(), column)

    return adapted_mapping


def build_header_signature(headers: list[str]) -> str:
    canonical_headers = [header.strip().lower() for header in headers]
    canonical = json.dumps(canonical_headers, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def get_user_vehicle(vehicle_id: int | None, user_id: int, db: Session) -> Vehicle | None:
    if vehicle_id is None:
        return None

    vehicle = db.scalar(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id)
    )
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    return vehicle


def validate_profile_mapping(
    import_type: str,
    headers: list[str],
    mapping: dict[str, str],
) -> None:
    if import_type == "expenses":
        mapping_errors = validate_expense_column_mapping(columns=headers, mapping=mapping)
    else:
        mapping_errors = validate_work_session_column_mapping(columns=headers, mapping=mapping)

    if mapping_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[error.model_dump() for error in mapping_errors],
        )


def safe_profile_vehicle_id(profile: CsvImportProfile, user_id: int, db: Session) -> int | None:
    if profile.vehicle_id is None:
        return None

    vehicle_id = db.scalar(
        select(Vehicle.id).where(Vehicle.id == profile.vehicle_id, Vehicle.user_id == user_id)
    )
    return vehicle_id


def profile_to_public(
    profile: CsvImportProfile,
    user_id: int,
    db: Session,
    valid_vehicle_ids: set[int] | None = None,
) -> CsvImportProfilePublic:
    if valid_vehicle_ids is None:
        vehicle_id = safe_profile_vehicle_id(profile=profile, user_id=user_id, db=db)
    else:
        vehicle_id = profile.vehicle_id if profile.vehicle_id in valid_vehicle_ids else None
    return CsvImportProfilePublic(
        id=profile.id,
        name=profile.name,
        import_type=profile.import_type,
        header_signature=profile.header_signature,
        column_mapping=profile.column_mapping,
        vehicle_id=vehicle_id,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


def get_user_profile(profile_id: int, user_id: int, db: Session) -> CsvImportProfile:
    profile = db.scalar(
        select(CsvImportProfile).where(
            CsvImportProfile.id == profile_id,
            CsvImportProfile.user_id == user_id,
        )
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import profile not found.",
        )

    return profile


@router.post("", response_model=CsvImportProfilePublic, status_code=status.HTTP_201_CREATED)
def create_import_profile(
    payload: CsvImportProfileCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CsvImportProfilePublic:
    get_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    headers = normalize_headers(payload.headers)
    column_mapping = normalize_column_mapping(payload.column_mapping)
    validate_profile_mapping(
        import_type=payload.import_type,
        headers=headers,
        mapping=column_mapping,
    )

    profile = CsvImportProfile(
        user_id=current_user.id,
        vehicle_id=payload.vehicle_id,
        name=payload.name,
        import_type=payload.import_type,
        header_signature=build_header_signature(headers),
        column_mapping=column_mapping,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile_to_public(profile=profile, user_id=current_user.id, db=db)


@router.get("", response_model=list[CsvImportProfilePublic])
def list_import_profiles(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination_params)],
) -> list[CsvImportProfilePublic]:
    query = (
        select(CsvImportProfile)
        .where(CsvImportProfile.user_id == current_user.id)
        .order_by(desc(CsvImportProfile.updated_at), desc(CsvImportProfile.created_at))
    )
    if pagination.limit is not None:
        query = query.limit(pagination.limit)
    if pagination.offset:
        query = query.offset(pagination.offset)

    profiles = db.scalars(query).all()
    profile_vehicle_ids = {
        profile.vehicle_id for profile in profiles if profile.vehicle_id is not None
    }
    valid_vehicle_ids = (
        set(
            db.scalars(
                select(Vehicle.id).where(
                    Vehicle.user_id == current_user.id,
                    Vehicle.id.in_(profile_vehicle_ids),
                )
            ).all()
        )
        if profile_vehicle_ids
        else set()
    )

    return [
        profile_to_public(
            profile=profile,
            user_id=current_user.id,
            db=db,
            valid_vehicle_ids=valid_vehicle_ids,
        )
        for profile in profiles
    ]


@router.post("/match", response_model=CsvImportProfileMatchResponse)
def match_import_profile(
    payload: CsvImportProfileMatchRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CsvImportProfileMatchResponse:
    header_signature = build_header_signature(normalize_headers(payload.headers))
    profile = db.scalar(
        select(CsvImportProfile)
        .where(
            CsvImportProfile.user_id == current_user.id,
            CsvImportProfile.import_type == payload.import_type,
            CsvImportProfile.header_signature == header_signature,
        )
        .order_by(desc(CsvImportProfile.updated_at), desc(CsvImportProfile.created_at))
    )
    if profile is None:
        return CsvImportProfileMatchResponse(profile=None)

    public_profile = profile_to_public(profile=profile, user_id=current_user.id, db=db)
    adapted_mapping = adapt_mapping_to_headers(
        mapping=public_profile.column_mapping,
        headers=payload.headers,
    )
    return CsvImportProfileMatchResponse(
        profile=public_profile,
        column_mapping=adapted_mapping,
        vehicle_id=public_profile.vehicle_id,
    )


@router.put("/{profile_id}", response_model=CsvImportProfilePublic)
def update_import_profile(
    profile_id: int,
    payload: CsvImportProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CsvImportProfilePublic:
    profile = get_user_profile(profile_id=profile_id, user_id=current_user.id, db=db)

    update_data = payload.model_dump(exclude_unset=True)
    if "vehicle_id" in update_data:
        get_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
        profile.vehicle_id = payload.vehicle_id
    if payload.name is not None:
        profile.name = payload.name
    if payload.import_type is not None and payload.headers is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="headers are required when updating import_type.",
        )
    if payload.import_type is not None:
        profile.import_type = payload.import_type
    if payload.headers is not None:
        headers = normalize_headers(payload.headers)
        mapping = (
            normalize_column_mapping(payload.column_mapping)
            if payload.column_mapping is not None
            else profile.column_mapping
        )
        import_type = (
            payload.import_type if payload.import_type is not None else profile.import_type
        )
        validate_profile_mapping(import_type=import_type, headers=headers, mapping=mapping)
        profile.header_signature = build_header_signature(headers)
    if payload.column_mapping is not None:
        if payload.headers is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="headers are required when updating column_mapping.",
            )
        profile.column_mapping = normalize_column_mapping(payload.column_mapping)
    profile.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(profile)

    return profile_to_public(profile=profile, user_id=current_user.id, db=db)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_import_profile(
    profile_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    profile = get_user_profile(profile_id=profile_id, user_id=current_user.id, db=db)
    db.delete(profile)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
