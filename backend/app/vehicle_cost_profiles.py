from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
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
    profile.rental_monthly_cents = money_to_cents(payload.rental_monthly)
    profile.financing_monthly_cents = money_to_cents(payload.financing_monthly)
    profile.insurance_monthly_cents = money_to_cents(payload.insurance_monthly)
    profile.ipva_annual_cents = money_to_cents(payload.ipva_annual)
    profile.other_fixed_monthly_cents = money_to_cents(payload.other_fixed_monthly)
    profile.maintenance_per_km = payload.maintenance_per_km
    profile.tires_per_km = payload.tires_per_km
    profile.oil_per_km = payload.oil_per_km
    profile.depreciation_per_km = payload.depreciation_per_km
    profile.fuel_efficiency_km_per_liter = payload.fuel_efficiency_km_per_liter

    db.commit()
    db.refresh(profile)
    return profile
