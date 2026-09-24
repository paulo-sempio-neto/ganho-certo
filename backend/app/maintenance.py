from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.expenses import money_to_cents, validate_user_vehicle
from app.financial_summary import divide_or_none, round_decimal
from app.models import MaintenancePlan, MaintenanceRecord, User, Vehicle, WorkSession
from app.schemas import (
    MaintenancePlanCreate,
    MaintenancePlanPublic,
    MaintenancePlanStatus,
    MaintenancePlanUpdate,
    MaintenanceRecordCreate,
    MaintenanceRecordPublic,
)

router = APIRouter(prefix="/maintenance-plans", tags=["maintenance-plans"])
ZERO_DECIMAL = Decimal("0.00")
RESERVE_PER_KM_QUANT = Decimal("0.0001")


def get_user_maintenance_plan(plan_id: int, user_id: int, db: Session) -> MaintenancePlan:
    plan = db.scalar(
        select(MaintenancePlan)
        .join(Vehicle)
        .where(MaintenancePlan.id == plan_id, Vehicle.user_id == user_id)
    )
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance plan not found.",
        )

    return plan


def latest_record(plan_id: int, db: Session) -> MaintenanceRecord | None:
    return db.scalar(
        select(MaintenanceRecord)
        .where(MaintenanceRecord.maintenance_plan_id == plan_id)
        .order_by(desc(MaintenanceRecord.service_date), desc(MaintenanceRecord.created_at))
    )


def get_km_since_last_service(
    plan: MaintenancePlan,
    last_record: MaintenanceRecord | None,
    db: Session,
) -> Decimal | None:
    if plan.interval_km is None:
        return None

    if last_record is None:
        query = select(func.coalesce(func.sum(WorkSession.distance_km), ZERO_DECIMAL)).where(
            WorkSession.vehicle_id == plan.vehicle_id,
            WorkSession.work_date >= plan.created_at.date(),
        )
    else:
        query = select(func.coalesce(func.sum(WorkSession.distance_km), ZERO_DECIMAL)).where(
            WorkSession.vehicle_id == plan.vehicle_id,
            WorkSession.work_date > last_record.service_date,
        )

    return Decimal(db.scalar(query) or ZERO_DECIMAL)


def get_days_since_last_service(
    plan: MaintenancePlan,
    last_record: MaintenanceRecord | None,
    today: date,
) -> int | None:
    if plan.interval_days is None:
        return None

    start_date = last_record.service_date if last_record is not None else plan.created_at.date()
    return max((today - start_date).days, 0)


def get_plan_status(
    plan: MaintenancePlan,
    db: Session,
    today: date | None = None,
) -> MaintenancePlanStatus:
    current_date = today or date.today()
    last_record = latest_record(plan.id, db)
    km_since_last_service = get_km_since_last_service(plan=plan, last_record=last_record, db=db)
    days_since_last_service = get_days_since_last_service(
        plan=plan,
        last_record=last_record,
        today=current_date,
    )

    km_remaining = None
    days_remaining = None
    due = False
    due_soon = False

    if plan.interval_km is not None and km_since_last_service is not None:
        km_remaining = max(plan.interval_km - km_since_last_service, ZERO_DECIMAL)
        due = due or km_since_last_service >= plan.interval_km
        due_soon = due_soon or km_remaining <= (plan.interval_km * Decimal("0.15"))

    if plan.interval_days is not None and days_since_last_service is not None:
        days_remaining = max(plan.interval_days - days_since_last_service, 0)
        due = due or days_since_last_service >= plan.interval_days
        due_soon = due_soon or days_remaining <= 14

    # Deterministic status rule: due wins over due_soon, due_soon wins over ok.
    if due:
        status_value = "due"
    elif due_soon:
        status_value = "due_soon"
    else:
        status_value = "ok"

    recommended_reserve_per_km = None
    if plan.estimated_cost is not None and plan.interval_km is not None:
        reserve = divide_or_none(plan.estimated_cost, plan.interval_km)
        if reserve is not None:
            recommended_reserve_per_km = (plan.estimated_cost / plan.interval_km).quantize(
                RESERVE_PER_KM_QUANT,
                rounding=ROUND_HALF_UP,
            )

    return MaintenancePlanStatus(
        status=status_value,
        km_since_last_service=round_decimal(km_since_last_service)
        if km_since_last_service is not None
        else None,
        km_remaining=round_decimal(km_remaining) if km_remaining is not None else None,
        days_since_last_service=days_since_last_service,
        days_remaining=days_remaining,
        estimated_cost=plan.estimated_cost,
        recommended_reserve_per_km=recommended_reserve_per_km,
    )


@router.post("", response_model=MaintenancePlanPublic, status_code=status.HTTP_201_CREATED)
def create_maintenance_plan(
    payload: MaintenancePlanCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MaintenancePlan:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    plan = MaintenancePlan(
        vehicle_id=payload.vehicle_id,
        name=payload.name,
        category=payload.category,
        interval_km=payload.interval_km,
        interval_days=payload.interval_days,
        estimated_cost_cents=money_to_cents(payload.estimated_cost)
        if payload.estimated_cost is not None
        else None,
        active=payload.active,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("", response_model=list[MaintenancePlanPublic])
def list_maintenance_plans(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[MaintenancePlan]:
    return list(
        db.scalars(
            select(MaintenancePlan)
            .join(Vehicle)
            .where(Vehicle.user_id == current_user.id)
            .order_by(desc(MaintenancePlan.created_at))
        ).all()
    )


@router.get("/{plan_id}", response_model=MaintenancePlanPublic)
def get_maintenance_plan(
    plan_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MaintenancePlan:
    return get_user_maintenance_plan(plan_id=plan_id, user_id=current_user.id, db=db)


@router.put("/{plan_id}", response_model=MaintenancePlanPublic)
def update_maintenance_plan(
    plan_id: int,
    payload: MaintenancePlanUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MaintenancePlan:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    plan = get_user_maintenance_plan(plan_id=plan_id, user_id=current_user.id, db=db)
    plan.vehicle_id = payload.vehicle_id
    plan.name = payload.name
    plan.category = payload.category
    plan.interval_km = payload.interval_km
    plan.interval_days = payload.interval_days
    plan.estimated_cost_cents = (
        money_to_cents(payload.estimated_cost) if payload.estimated_cost is not None else None
    )
    plan.active = payload.active

    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_maintenance_plan(
    plan_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    plan = get_user_maintenance_plan(plan_id=plan_id, user_id=current_user.id, db=db)
    db.delete(plan)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{plan_id}/records",
    response_model=MaintenanceRecordPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_maintenance_record(
    plan_id: int,
    payload: MaintenanceRecordCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MaintenanceRecord:
    get_user_maintenance_plan(plan_id=plan_id, user_id=current_user.id, db=db)
    record = MaintenanceRecord(
        maintenance_plan_id=plan_id,
        service_date=payload.service_date,
        notes=payload.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{plan_id}/records", response_model=list[MaintenanceRecordPublic])
def list_maintenance_records(
    plan_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[MaintenanceRecord]:
    get_user_maintenance_plan(plan_id=plan_id, user_id=current_user.id, db=db)
    return list(
        db.scalars(
            select(MaintenanceRecord)
            .where(MaintenanceRecord.maintenance_plan_id == plan_id)
            .order_by(desc(MaintenanceRecord.service_date), desc(MaintenanceRecord.created_at))
        ).all()
    )


@router.get("/{plan_id}/status", response_model=MaintenancePlanStatus)
def get_maintenance_plan_status(
    plan_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MaintenancePlanStatus:
    plan = get_user_maintenance_plan(plan_id=plan_id, user_id=current_user.id, db=db)
    return get_plan_status(plan=plan, db=db)
