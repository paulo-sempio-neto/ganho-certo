from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Expense, User, Vehicle, WorkSession
from app.schemas import FinancialDailySummary, FinancialSummary

router = APIRouter(tags=["financial-summary"])
CENT = Decimal("0.01")


def cents_to_decimal(value: int) -> Decimal:
    return (Decimal(value) / Decimal("100")).quantize(CENT)


def round_decimal(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def divide_or_none(numerator: Decimal, denominator: Decimal) -> Decimal | None:
    if denominator == 0:
        return None

    return round_decimal(numerator / denominator)


def validate_date_range(start_date: date | None, end_date: date | None) -> None:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="start_date must be before or equal to end_date.",
        )


def validate_user_vehicle(vehicle_id: int | None, user_id: int, db: Session) -> None:
    if vehicle_id is None:
        return

    vehicle = db.scalar(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id)
    )
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")


@router.get("/financial-summary", response_model=FinancialSummary)
def get_financial_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    vehicle_id: Annotated[int | None, Query(gt=0)] = None,
) -> FinancialSummary:
    validate_date_range(start_date=start_date, end_date=end_date)
    validate_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)

    work_session_query = select(WorkSession).where(WorkSession.user_id == current_user.id)
    expense_query = select(Expense).where(Expense.user_id == current_user.id)

    if start_date is not None:
        work_session_query = work_session_query.where(WorkSession.work_date >= start_date)
        expense_query = expense_query.where(Expense.expense_date >= start_date)

    if end_date is not None:
        work_session_query = work_session_query.where(WorkSession.work_date <= end_date)
        expense_query = expense_query.where(Expense.expense_date <= end_date)

    if vehicle_id is not None:
        work_session_query = work_session_query.where(WorkSession.vehicle_id == vehicle_id)
        expense_query = expense_query.where(Expense.vehicle_id == vehicle_id)

    work_sessions = list(db.scalars(work_session_query).all())
    expenses = list(db.scalars(expense_query).all())

    gross_revenue_cents = sum(session.gross_revenue_cents for session in work_sessions)
    expense_cents = sum(expense.amount_cents for expense in expenses)
    gross_revenue = cents_to_decimal(gross_revenue_cents)
    total_expenses = cents_to_decimal(expense_cents)
    estimated_net_profit = round_decimal(gross_revenue - total_expenses)
    total_distance_km = round_decimal(
        sum((session.distance_km for session in work_sessions), Decimal("0"))
    )
    total_worked_minutes = sum(session.worked_minutes for session in work_sessions)
    total_trip_count = sum(session.trip_count for session in work_sessions)

    hours = Decimal(total_worked_minutes) / Decimal("60")
    daily_values: defaultdict[date, dict[str, int]] = defaultdict(
        lambda: {"gross_revenue_cents": 0, "expense_cents": 0}
    )

    for session in work_sessions:
        daily_values[session.work_date]["gross_revenue_cents"] += session.gross_revenue_cents

    for expense in expenses:
        daily_values[expense.expense_date]["expense_cents"] += expense.amount_cents

    daily = []
    for summary_date in sorted(daily_values):
        daily_gross = cents_to_decimal(daily_values[summary_date]["gross_revenue_cents"])
        daily_expenses = cents_to_decimal(daily_values[summary_date]["expense_cents"])
        daily.append(
            FinancialDailySummary(
                date=summary_date,
                gross_revenue=daily_gross,
                expenses=daily_expenses,
                estimated_net_profit=round_decimal(daily_gross - daily_expenses),
            )
        )

    return FinancialSummary(
        gross_revenue=gross_revenue,
        total_expenses=total_expenses,
        estimated_net_profit=estimated_net_profit,
        total_distance_km=total_distance_km,
        total_worked_minutes=total_worked_minutes,
        total_trip_count=total_trip_count,
        gross_per_hour=divide_or_none(gross_revenue, hours),
        net_per_hour=divide_or_none(estimated_net_profit, hours),
        gross_per_km=divide_or_none(gross_revenue, total_distance_km),
        net_per_km=divide_or_none(estimated_net_profit, total_distance_km),
        expense_per_km=divide_or_none(total_expenses, total_distance_km),
        average_ticket=divide_or_none(gross_revenue, Decimal(total_trip_count)),
        daily=daily,
    )
