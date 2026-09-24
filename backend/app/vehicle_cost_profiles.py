from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, VehicleCostProfile
from app.schemas import VehicleCostProfilePublic, VehicleCostProfileUpdate
from app.vehicles import get_user_vehicle

router = APIRouter(prefix="/vehicles", tags=["vehicle-cost-profiles"])


def money_to_cents(value: Decimal | None) -> int | None:
    if value is None:
        return None

    return int((value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def get_profile(vehicle_id: int, db: Session) -> VehicleCostProfile | None:
    return db.scalar(select(VehicleCostProfile).where(VehicleCostProfile.vehicle_id == vehicle_id))


def normalized_rental_monthly(payload: VehicleCostProfileUpdate) -> Decimal | None:
    if payload.ownership_type != "rented":
        return None

    return payload.rental_monthly


def normalized_financing_monthly(payload: VehicleCostProfileUpdate) -> Decimal | None:
    if payload.ownership_type != "financed":
        return None

    return payload.financing_monthly


@router.get("/{vehicle_id}/cost-profile", response_model=VehicleCostProfilePublic)
def get_vehicle_cost_profile(
    vehicle_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VehicleCostProfile:
    vehicle = get_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    profile = get_profile(vehicle_id=vehicle.id, db=db)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle cost profile not found.",
        )

    return profile


@router.put("/{vehicle_id}/cost-profile", response_model=VehicleCostProfilePublic)
def upsert_vehicle_cost_profile(
    vehicle_id: int,
    payload: VehicleCostProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> VehicleCostProfile:
    vehicle = get_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    profile = get_profile(vehicle_id=vehicle.id, db=db)

    if profile is None:
        profile = VehicleCostProfile(vehicle_id=vehicle.id, ownership_type=payload.ownership_type)
        db.add(profile)

    profile.ownership_type = payload.ownership_type
    profile.rental_monthly_cents = money_to_cents(normalized_rental_monthly(payload))
    profile.financing_monthly_cents = money_to_cents(normalized_financing_monthly(payload))
    profile.insurance_monthly_cents = money_to_cents(payload.insurance_monthly)
    profile.ipva_annual_cents = money_to_cents(payload.ipva_annual)
    profile.other_fixed_monthly_cents = money_to_cents(payload.other_fixed_monthly)
    profile.maintenance_per_km = payload.maintenance_per_km
    profile.tires_per_km = payload.tires_per_km
    profile.oil_per_km = payload.oil_per_km
    profile.depreciation_per_km = payload.depreciation_per_km
    profile.fuel_efficiency_km_per_liter = payload.fuel_efficiency_km_per_liter

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vehicle cost profile was updated concurrently. Please retry.",
        ) from exc

    db.refresh(profile)
    return profile
