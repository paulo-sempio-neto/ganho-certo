from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Vehicle, WorkSession
from app.schemas import WorkSessionCreate, WorkSessionPublic, WorkSessionUpdate

router = APIRouter(prefix="/work-sessions", tags=["work-sessions"])


def money_to_cents(value: Decimal) -> int:
    return int((value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def get_user_vehicle(vehicle_id: int, user_id: int, db: Session) -> Vehicle:
    vehicle = db.scalar(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id)
    )
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")

    return vehicle


def get_user_work_session(session_id: int, user_id: int, db: Session) -> WorkSession:
    work_session = db.scalar(
        select(WorkSession).where(WorkSession.id == session_id, WorkSession.user_id == user_id)
    )
    if work_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work session not found.",
        )

    return work_session


@router.post("", response_model=WorkSessionPublic, status_code=status.HTTP_201_CREATED)
def create_work_session(
    payload: WorkSessionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkSession:
    get_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    work_session = WorkSession(
        user_id=current_user.id,
        vehicle_id=payload.vehicle_id,
        work_date=payload.work_date,
        gross_revenue_cents=money_to_cents(payload.gross_revenue),
        distance_km=payload.distance_km,
        worked_minutes=payload.worked_minutes,
        trip_count=payload.trip_count,
    )
    db.add(work_session)
    db.commit()
    db.refresh(work_session)
    return work_session


@router.get("", response_model=list[WorkSessionPublic])
def list_work_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[WorkSession]:
    return list(
        db.scalars(
            select(WorkSession)
            .where(WorkSession.user_id == current_user.id)
            .order_by(desc(WorkSession.work_date), desc(WorkSession.created_at))
        ).all()
    )


@router.get("/{session_id}", response_model=WorkSessionPublic)
def get_work_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkSession:
    return get_user_work_session(session_id=session_id, user_id=current_user.id, db=db)


@router.put("/{session_id}", response_model=WorkSessionPublic)
def update_work_session(
    session_id: int,
    payload: WorkSessionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WorkSession:
    get_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    work_session = get_user_work_session(session_id=session_id, user_id=current_user.id, db=db)
    work_session.vehicle_id = payload.vehicle_id
    work_session.work_date = payload.work_date
    work_session.gross_revenue_cents = money_to_cents(payload.gross_revenue)
    work_session.distance_km = payload.distance_km
    work_session.worked_minutes = payload.worked_minutes
    work_session.trip_count = payload.trip_count

    db.commit()
    db.refresh(work_session)
    return work_session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    work_session = get_user_work_session(session_id=session_id, user_id=current_user.id, db=db)
    db.delete(work_session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
