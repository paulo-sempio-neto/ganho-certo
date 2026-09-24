from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Expense, RecurringExpense, User, Vehicle, VehicleCostProfile, WorkSession
from app.schemas import (
    FinancialDailySummary,
    FinancialRecurringExpenseBreakdown,
    FinancialStructuralCosts,
    FinancialSummary,
)

router = APIRouter(tags=["financial-summary"])
CENT = Decimal("0.01")
ZERO_MONEY = Decimal("0.00")


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


def inclusive_days(start_date: date, end_date: date) -> int:
    return (end_date - start_date).days + 1


def days_in_year(year: int) -> int:
    return date(year, 12, 31).timetuple().tm_yday


def month_end(value: date) -> date:
    return date(value.year, value.month, monthrange(value.year, value.month)[1])


def has_positive_money(value: Decimal | None) -> bool:
    return value is not None and value > ZERO_MONEY


def prorate_monthly(value: Decimal | None, start_date: date, end_date: date) -> Decimal:
    if value is None:
        return ZERO_MONEY

    total = Decimal("0")
    current_date = start_date
    while current_date <= end_date:
        segment_end = min(month_end(current_date), end_date)
        total += (
            value
            * Decimal(inclusive_days(current_date, segment_end))
            / Decimal(monthrange(current_date.year, current_date.month)[1])
        )
        current_date = segment_end + timedelta(days=1)

    return total


def prorate_annual(value: Decimal | None, start_date: date, end_date: date) -> Decimal:
    if value is None:
        return ZERO_MONEY

    total = Decimal("0")
    current_date = start_date
    while current_date <= end_date:
        segment_end = min(date(current_date.year, 12, 31), end_date)
        total += (
            value
            * Decimal(inclusive_days(current_date, segment_end))
            / Decimal(days_in_year(current_date.year))
        )
        current_date = segment_end + timedelta(days=1)

    return total


def get_effective_period(
    start_date: date | None,
    end_date: date | None,
    work_sessions: list[WorkSession],
    expenses: list[Expense],
) -> tuple[date, date] | None:
    if start_date is not None and end_date is not None:
        return start_date, end_date

    summary_dates = [session.work_date for session in work_sessions]
    summary_dates.extend(expense.expense_date for expense in expenses)
    if not summary_dates:
        return None

    effective_start = start_date or min(summary_dates)
    effective_end = end_date or max(summary_dates)
    if effective_start > effective_end:
        return None

    return effective_start, effective_end


def get_vehicle_distances(work_sessions: list[WorkSession]) -> dict[int, Decimal]:
    distances: defaultdict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for session in work_sessions:
        distances[session.vehicle_id] += session.distance_km

    return dict(distances)


def get_economic_expense_cents(
    expenses: list[Expense],
    profiles_by_vehicle_id: dict[int, VehicleCostProfile],
) -> int:
    total_cents = 0

    for expense in expenses:
        profile = profiles_by_vehicle_id.get(expense.vehicle_id) if expense.vehicle_id else None
        should_skip = False

        if profile is not None:
            if (
                expense.category == "rental"
                and profile.ownership_type == "rented"
                and profile.rental_monthly is not None
            ):
                should_skip = True
            elif (
                expense.category == "financing"
                and profile.ownership_type == "financed"
                and profile.financing_monthly is not None
            ):
                should_skip = True
            elif expense.category == "insurance" and profile.insurance_monthly is not None:
                should_skip = True
            elif expense.category == "maintenance" and profile.maintenance_per_km is not None:
                should_skip = True

        if not should_skip:
            total_cents += expense.amount_cents

    return total_cents


def get_structural_costs(
    profiles: list[VehicleCostProfile],
    vehicle_distances: dict[int, Decimal],
    effective_period: tuple[date, date] | None,
) -> FinancialStructuralCosts:
    ownership = ZERO_MONEY
    insurance = ZERO_MONEY
    ipva = ZERO_MONEY
    other_fixed = ZERO_MONEY
    maintenance = ZERO_MONEY
    tires = ZERO_MONEY
    oil = ZERO_MONEY
    depreciation = ZERO_MONEY

    for profile in profiles:
        distance_km = vehicle_distances.get(profile.vehicle_id, Decimal("0"))

        if effective_period is not None:
            effective_start, effective_end = effective_period
            if profile.ownership_type == "rented":
                ownership += prorate_monthly(profile.rental_monthly, effective_start, effective_end)
            elif profile.ownership_type == "financed":
                ownership += prorate_monthly(
                    profile.financing_monthly,
                    effective_start,
                    effective_end,
                )

            insurance += prorate_monthly(profile.insurance_monthly, effective_start, effective_end)
            ipva += prorate_annual(profile.ipva_annual, effective_start, effective_end)
            other_fixed += prorate_monthly(
                profile.other_fixed_monthly,
                effective_start,
                effective_end,
            )

        if profile.maintenance_per_km is not None:
            maintenance += profile.maintenance_per_km * distance_km
        if profile.tires_per_km is not None:
            tires += profile.tires_per_km * distance_km
        if profile.oil_per_km is not None:
            oil += profile.oil_per_km * distance_km
        if profile.depreciation_per_km is not None:
            depreciation += profile.depreciation_per_km * distance_km

    return FinancialStructuralCosts(
        ownership=round_decimal(ownership),
        insurance=round_decimal(insurance),
        ipva=round_decimal(ipva),
        other_fixed=round_decimal(other_fixed),
        maintenance=round_decimal(maintenance),
        tires=round_decimal(tires),
        oil=round_decimal(oil),
        depreciation=round_decimal(depreciation),
    )


def structural_costs_total(costs: FinancialStructuralCosts) -> Decimal:
    return round_decimal(
        costs.ownership
        + costs.insurance
        + costs.ipva
        + costs.other_fixed
        + costs.maintenance
        + costs.tires
        + costs.oil
        + costs.depreciation
    )


def add_months(anchor_date: date, months: int) -> date:
    month_index = anchor_date.month - 1 + months
    year = anchor_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(anchor_date.day, monthrange(year, month)[1])
    return date(year, month, day)


def yearly_occurrence(anchor_date: date, year: int) -> date:
    day = min(anchor_date.day, monthrange(year, anchor_date.month)[1])
    return date(year, anchor_date.month, day)


def get_recurring_occurrences(
    recurring_expense: RecurringExpense,
    period_start: date,
    period_end: date,
) -> list[date]:
    effective_start = max(period_start, recurring_expense.start_date)
    effective_end = period_end
    if recurring_expense.end_date is not None:
        effective_end = min(effective_end, recurring_expense.end_date)

    if effective_start > effective_end:
        return []

    occurrences: list[date] = []

    if recurring_expense.frequency == "weekly":
        days_after_start = (effective_start - recurring_expense.start_date).days
        first_offset = 0 if days_after_start <= 0 else ((days_after_start + 6) // 7) * 7
        current_date = recurring_expense.start_date + timedelta(days=first_offset)
        while current_date <= effective_end:
            occurrences.append(current_date)
            current_date += timedelta(days=7)
        return occurrences

    if recurring_expense.frequency == "monthly":
        month_offset = (
            (effective_start.year - recurring_expense.start_date.year) * 12
            + effective_start.month
            - recurring_expense.start_date.month
        )
        month_offset = max(month_offset, 0)
        current_date = add_months(recurring_expense.start_date, month_offset)
        while current_date < effective_start:
            month_offset += 1
            current_date = add_months(recurring_expense.start_date, month_offset)
        while current_date <= effective_end:
            occurrences.append(current_date)
            month_offset += 1
            current_date = add_months(recurring_expense.start_date, month_offset)
        return occurrences

    year = max(effective_start.year, recurring_expense.start_date.year)
    current_date = yearly_occurrence(recurring_expense.start_date, year)
    while current_date < recurring_expense.start_date or current_date < effective_start:
        year += 1
        current_date = yearly_occurrence(recurring_expense.start_date, year)
    while current_date <= effective_end:
        occurrences.append(current_date)
        year += 1
        current_date = yearly_occurrence(recurring_expense.start_date, year)

    return occurrences


def should_skip_recurring_expense_for_profile(
    recurring_expense: RecurringExpense,
    profiles_by_vehicle_id: dict[int, VehicleCostProfile],
) -> bool:
    if recurring_expense.vehicle_id is None:
        return False

    profile = profiles_by_vehicle_id.get(recurring_expense.vehicle_id)
    if profile is None:
        return False

    if (
        recurring_expense.category == "rental"
        and profile.ownership_type == "rented"
        and has_positive_money(profile.rental_monthly)
    ):
        return True

    if (
        recurring_expense.category == "financing"
        and profile.ownership_type == "financed"
        and has_positive_money(profile.financing_monthly)
    ):
        return True

    if recurring_expense.category == "insurance" and has_positive_money(profile.insurance_monthly):
        return True

    return (
        recurring_expense.category == "maintenance"
        and profile.maintenance_per_km is not None
        and profile.maintenance_per_km > ZERO_MONEY
    )


def get_recurring_expense_breakdown(
    recurring_expenses: list[RecurringExpense],
    expenses: list[Expense],
    profiles_by_vehicle_id: dict[int, VehicleCostProfile],
    effective_period: tuple[date, date] | None,
) -> list[FinancialRecurringExpenseBreakdown]:
    if effective_period is None:
        return []

    period_start, period_end = effective_period
    real_expense_keys = {
        (expense.category, expense.vehicle_id, expense.expense_date, expense.amount_cents)
        for expense in expenses
    }
    totals_by_category: defaultdict[str, int] = defaultdict(int)

    for recurring_expense in recurring_expenses:
        if should_skip_recurring_expense_for_profile(
            recurring_expense=recurring_expense,
            profiles_by_vehicle_id=profiles_by_vehicle_id,
        ):
            continue

        for occurrence_date in get_recurring_occurrences(
            recurring_expense=recurring_expense,
            period_start=period_start,
            period_end=period_end,
        ):
            key = (
                recurring_expense.category,
                recurring_expense.vehicle_id,
                occurrence_date,
                recurring_expense.amount_cents,
            )
            if key in real_expense_keys:
                continue

            totals_by_category[recurring_expense.category] += recurring_expense.amount_cents

    return [
        FinancialRecurringExpenseBreakdown(
            category=category,
            amount=cents_to_decimal(amount_cents),
        )
        for category, amount_cents in sorted(totals_by_category.items())
    ]


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
    recurring_expense_query = select(RecurringExpense).where(
        RecurringExpense.user_id == current_user.id,
        RecurringExpense.active.is_(True),
    )

    if start_date is not None:
        work_session_query = work_session_query.where(WorkSession.work_date >= start_date)
        expense_query = expense_query.where(Expense.expense_date >= start_date)

    if end_date is not None:
        work_session_query = work_session_query.where(WorkSession.work_date <= end_date)
        expense_query = expense_query.where(Expense.expense_date <= end_date)

    if vehicle_id is not None:
        work_session_query = work_session_query.where(WorkSession.vehicle_id == vehicle_id)
        expense_query = expense_query.where(Expense.vehicle_id == vehicle_id)
        recurring_expense_query = recurring_expense_query.where(
            RecurringExpense.vehicle_id == vehicle_id
        )

    work_sessions = list(db.scalars(work_session_query).all())
    expenses = list(db.scalars(expense_query).all())
    recurring_expenses = list(db.scalars(recurring_expense_query).all())
    profile_query = (
        select(VehicleCostProfile).join(Vehicle).where(Vehicle.user_id == current_user.id)
    )
    if vehicle_id is not None:
        profile_query = profile_query.where(VehicleCostProfile.vehicle_id == vehicle_id)

    cost_profiles = list(db.scalars(profile_query).all())
    profiles_by_vehicle_id = {profile.vehicle_id: profile for profile in cost_profiles}

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
    structural_costs = get_structural_costs(
        profiles=cost_profiles,
        vehicle_distances=get_vehicle_distances(work_sessions),
        effective_period=get_effective_period(
            start_date=start_date,
            end_date=end_date,
            work_sessions=work_sessions,
            expenses=expenses,
        ),
    )
    estimated_structural_costs = structural_costs_total(structural_costs)
    economic_expenses = cents_to_decimal(
        get_economic_expense_cents(expenses, profiles_by_vehicle_id)
    )
    estimated_economic_costs = round_decimal(economic_expenses + estimated_structural_costs)
    estimated_economic_result = round_decimal(gross_revenue - estimated_economic_costs)
    recurring_expenses_breakdown = get_recurring_expense_breakdown(
        recurring_expenses=recurring_expenses,
        expenses=expenses,
        profiles_by_vehicle_id=profiles_by_vehicle_id,
        effective_period=get_effective_period(
            start_date=start_date,
            end_date=end_date,
            work_sessions=work_sessions,
            expenses=expenses,
        ),
    )
    recurring_expenses_total = round_decimal(
        sum((item.amount for item in recurring_expenses_breakdown), ZERO_MONEY)
    )
    projected_economic_costs = round_decimal(
        estimated_economic_costs + recurring_expenses_total
    )
    projected_economic_result = round_decimal(gross_revenue - projected_economic_costs)

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
        estimated_structural_costs=estimated_structural_costs,
        estimated_economic_costs=estimated_economic_costs,
        estimated_economic_result=estimated_economic_result,
        recurring_expenses_total=recurring_expenses_total,
        recurring_expenses_breakdown=recurring_expenses_breakdown,
        projected_economic_costs=projected_economic_costs,
        projected_economic_result=projected_economic_result,
        structural_costs=structural_costs,
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
