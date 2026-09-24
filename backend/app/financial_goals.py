from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import Select, desc, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.expenses import money_to_cents, validate_user_vehicle
from app.financial_summary import (
    divide_or_none,
    get_financial_summary,
    inclusive_days,
    round_decimal,
)
from app.models import FinancialGoal, User
from app.schemas import (
    FinancialGoalCreate,
    FinancialGoalProgress,
    FinancialGoalPublic,
    FinancialGoalUpdate,
)

router = APIRouter(prefix="/financial-goals", tags=["financial-goals"])
ZERO_MONEY = Decimal("0.00")
ONE_HUNDRED = Decimal("100")


def get_user_goal(goal_id: int, user_id: int, db: Session) -> FinancialGoal:
    goal = db.scalar(
        select(FinancialGoal).where(
            FinancialGoal.id == goal_id,
            FinancialGoal.user_id == user_id,
        )
    )
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial goal not found.",
        )

    return goal


def active_goal_query(
    user_id: int,
    goal_type: str,
    vehicle_id: int | None,
) -> Select[tuple[FinancialGoal]]:
    query = select(FinancialGoal).where(
        FinancialGoal.user_id == user_id,
        FinancialGoal.goal_type == goal_type,
        FinancialGoal.active.is_(True),
    )
    if vehicle_id is None:
        return query.where(FinancialGoal.vehicle_id.is_(None))

    return query.where(FinancialGoal.vehicle_id == vehicle_id)


def ensure_single_active_goal(
    user_id: int,
    goal_type: str,
    vehicle_id: int | None,
    db: Session,
    current_goal_id: int | None = None,
) -> None:
    existing_goal = db.scalar(active_goal_query(user_id, goal_type, vehicle_id))
    if existing_goal is not None and existing_goal.id != current_goal_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active goal already exists for this vehicle and goal type.",
        )


def goal_to_progress_end(goal: FinancialGoal, today: date) -> date | None:
    if today < goal.start_date:
        return None

    return min(today, goal.end_date)


def get_days_elapsed(goal: FinancialGoal, today: date) -> int:
    if today < goal.start_date:
        return 0

    if today > goal.end_date:
        return inclusive_days(goal.start_date, goal.end_date)

    return inclusive_days(goal.start_date, today)


def get_current_amount(
    goal: FinancialGoal,
    current_user: User,
    db: Session,
    today: date,
) -> tuple[Decimal, int]:
    progress_end = goal_to_progress_end(goal, today)
    if progress_end is None:
        return ZERO_MONEY, 0

    summary = get_financial_summary(
        current_user=current_user,
        db=db,
        start_date=goal.start_date,
        end_date=progress_end,
        vehicle_id=goal.vehicle_id,
    )
    current_amount = (
        summary.estimated_net_profit
        if goal.goal_type == "net"
        else summary.projected_economic_result
    )
    return current_amount, summary.total_worked_minutes


def get_goal_progress(
    goal: FinancialGoal,
    current_user: User,
    db: Session,
) -> FinancialGoalProgress:
    today = date.today()
    target_amount = goal.target_amount
    current_amount, total_worked_minutes = get_current_amount(goal, current_user, db, today)
    remaining_amount = max(target_amount - current_amount, ZERO_MONEY)
    days_total = inclusive_days(goal.start_date, goal.end_date)
    days_elapsed = get_days_elapsed(goal, today)
    days_remaining = max(days_total - days_elapsed, 0)

    if remaining_amount == ZERO_MONEY:
        required_daily_amount = ZERO_MONEY
    elif days_remaining > 0:
        required_daily_amount = (
            divide_or_none(remaining_amount, Decimal(days_remaining)) or ZERO_MONEY
        )
    else:
        required_daily_amount = remaining_amount

    progress_percentage = divide_or_none(current_amount * ONE_HUNDRED, target_amount) or ZERO_MONEY
    temporal_percentage = (
        divide_or_none(Decimal(days_elapsed) * ONE_HUNDRED, Decimal(days_total)) or ZERO_MONEY
    )
    projected_completion_amount = (
        ZERO_MONEY
        if days_elapsed == 0
        else round_decimal((current_amount / Decimal(days_elapsed)) * Decimal(days_total))
    )
    on_track = remaining_amount == ZERO_MONEY or progress_percentage >= temporal_percentage

    average_per_hour = None
    if total_worked_minutes > 0:
        hours = Decimal(total_worked_minutes) / Decimal("60")
        average_per_hour = divide_or_none(current_amount, hours)
        if average_per_hour is not None and average_per_hour <= ZERO_MONEY:
            average_per_hour = None

    if remaining_amount == ZERO_MONEY:
        estimated_hours_remaining = ZERO_MONEY
    elif average_per_hour is None:
        estimated_hours_remaining = None
    else:
        estimated_hours_remaining = divide_or_none(remaining_amount, average_per_hour)

    return FinancialGoalProgress(
        target_amount=target_amount,
        current_amount=round_decimal(current_amount),
        remaining_amount=round_decimal(remaining_amount),
        progress_percentage=round_decimal(progress_percentage),
        days_total=days_total,
        days_elapsed=days_elapsed,
        days_remaining=days_remaining,
        required_daily_amount=round_decimal(required_daily_amount),
        projected_completion_amount=round_decimal(projected_completion_amount),
        on_track=on_track,
        average_net_per_hour=average_per_hour if goal.goal_type == "net" else None,
        average_projected_per_hour=average_per_hour if goal.goal_type == "projected" else None,
        estimated_hours_remaining=estimated_hours_remaining,
    )


@router.post("", response_model=FinancialGoalPublic, status_code=status.HTTP_201_CREATED)
def create_financial_goal(
    payload: FinancialGoalCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FinancialGoal:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    if payload.active:
        ensure_single_active_goal(current_user.id, payload.goal_type, payload.vehicle_id, db)

    goal = FinancialGoal(
        user_id=current_user.id,
        vehicle_id=payload.vehicle_id,
        goal_type=payload.goal_type,
        target_amount_cents=money_to_cents(payload.target_amount),
        start_date=payload.start_date,
        end_date=payload.end_date,
        active=payload.active,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("", response_model=list[FinancialGoalPublic])
def list_financial_goals(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[FinancialGoal]:
    return list(
        db.scalars(
            select(FinancialGoal)
            .where(FinancialGoal.user_id == current_user.id)
            .order_by(desc(FinancialGoal.start_date), desc(FinancialGoal.created_at))
        ).all()
    )


@router.get("/{goal_id}", response_model=FinancialGoalPublic)
def get_financial_goal(
    goal_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FinancialGoal:
    return get_user_goal(goal_id=goal_id, user_id=current_user.id, db=db)


@router.put("/{goal_id}", response_model=FinancialGoalPublic)
def update_financial_goal(
    goal_id: int,
    payload: FinancialGoalUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FinancialGoal:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    goal = get_user_goal(goal_id=goal_id, user_id=current_user.id, db=db)
    if payload.active:
        ensure_single_active_goal(
            current_user.id,
            payload.goal_type,
            payload.vehicle_id,
            db,
            current_goal_id=goal.id,
        )

    goal.vehicle_id = payload.vehicle_id
    goal.goal_type = payload.goal_type
    goal.target_amount_cents = money_to_cents(payload.target_amount)
    goal.start_date = payload.start_date
    goal.end_date = payload.end_date
    goal.active = payload.active

    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_financial_goal(
    goal_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    goal = get_user_goal(goal_id=goal_id, user_id=current_user.id, db=db)
    db.delete(goal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{goal_id}/progress", response_model=FinancialGoalProgress)
def get_financial_goal_progress(
    goal_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FinancialGoalProgress:
    goal = get_user_goal(goal_id=goal_id, user_id=current_user.id, db=db)
    return get_goal_progress(goal=goal, current_user=current_user, db=db)
