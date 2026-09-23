from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Vehicle
from app.schemas import VehicleCreate, VehiclePublic, VehicleUpdate

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def get_user_vehicle(vehicle_id: int, user_id: int, db: Session) -> Vehicle:
    vehicle = db.scalar(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id)
    )
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    return vehicle


@router.post("", response_model=VehiclePublic, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: VehicleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Vehicle:
    vehicle = Vehicle(
        user_id=current_user.id,
        name=payload.name,
        brand=payload.brand,
        model=payload.model,
        year=payload.year,
        fuel_type=payload.fuel_type,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.get("", response_model=list[VehiclePublic])
def list_vehicles(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Vehicle]:
    return list(db.scalars(select(Vehicle).where(Vehicle.user_id == current_user.id)).all())


@router.get("/{vehicle_id}", response_model=VehiclePublic)
def get_vehicle(
    vehicle_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Vehicle:
    return get_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)


@router.put("/{vehicle_id}", response_model=VehiclePublic)
def update_vehicle(
    vehicle_id: int,
    payload: VehicleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Vehicle:
    vehicle = get_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    vehicle.name = payload.name
    vehicle.brand = payload.brand
    vehicle.model = payload.model
    vehicle.year = payload.year
    vehicle.fuel_type = payload.fuel_type

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    vehicle = get_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)
    db.delete(vehicle)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
