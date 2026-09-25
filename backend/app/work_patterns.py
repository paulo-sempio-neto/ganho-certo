from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.financial_history import result_per_hour, result_per_km
from app.financial_summary import (
    ZERO_MONEY,
    build_financial_summary,
    divide_or_none,
    get_financial_summary_records,
    round_decimal,
    validate_date_range,
    validate_user_vehicle,
)
from app.models import Expense, RecurringExpense, User, VehicleCostProfile, WorkSession
from app.schemas import (
    FinancialSummary,
    WorkPatternObservation,
    WorkPatternOverallSummary,
    WorkPatternSampleClassification,
    WorkPatternsResponse,
    WorkPatternWeekdayPerformance,
)

router = APIRouter(tags=["work-patterns"])

WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


def daterange(start_date: date, end_date: date) -> list[date]:
    total_days = (end_date - start_date).days + 1
    return [start_date + timedelta(days=offset) for offset in range(total_days)]


def classify_sample(active_days: int) -> WorkPatternSampleClassification:
    """Classify sample size: 0-1 insufficient, 2-3 limited, 4+ usable."""
    if active_days <= 1:
        return "insufficient"

    if active_days <= 3:
        return "limited"

    return "usable"


def group_work_sessions_by_date(work_sessions: list[WorkSession]) -> dict[date, list[WorkSession]]:
    grouped: defaultdict[date, list[WorkSession]] = defaultdict(list)
    for work_session in work_sessions:
        grouped[work_session.work_date].append(work_session)

    return dict(grouped)


def group_expenses_by_date(expenses: list[Expense]) -> dict[date, list[Expense]]:
    grouped: defaultdict[date, list[Expense]] = defaultdict(list)
    for expense in expenses:
        grouped[expense.expense_date].append(expense)

    return dict(grouped)


def count_active_days(work_sessions: list[WorkSession]) -> int:
    return len({work_session.work_date for work_session in work_sessions})


def summary_to_overall(summary: FinancialSummary, active_days: int) -> WorkPatternOverallSummary:
    return WorkPatternOverallSummary(
        active_days=active_days,
        total_worked_minutes=summary.total_worked_minutes,
        total_distance_km=summary.total_distance_km,
        total_trip_count=summary.total_trip_count,
        gross_revenue=summary.gross_revenue,
        registered_expenses=summary.total_expenses,
        estimated_result=summary.estimated_economic_result,
        estimated_result_per_hour=result_per_hour(summary),
        estimated_result_per_km=result_per_km(summary),
    )


def empty_weekday_totals() -> dict[str, Decimal | int]:
    return {
        "active_days": 0,
        "total_worked_minutes": 0,
        "total_distance_km": ZERO_MONEY,
        "total_trip_count": 0,
        "gross_revenue": ZERO_MONEY,
        "registered_expenses": ZERO_MONEY,
        "estimated_result": ZERO_MONEY,
    }


def add_daily_summary(
    totals: dict[str, Decimal | int],
    summary: FinancialSummary,
    is_active_day: bool,
) -> None:
    if is_active_day:
        totals["active_days"] = int(totals["active_days"]) + 1

    totals["total_worked_minutes"] = (
        int(totals["total_worked_minutes"]) + summary.total_worked_minutes
    )
    totals["total_trip_count"] = int(totals["total_trip_count"]) + summary.total_trip_count
    totals["total_distance_km"] = round_decimal(
        Decimal(totals["total_distance_km"]) + summary.total_distance_km
    )
    totals["gross_revenue"] = round_decimal(
        Decimal(totals["gross_revenue"]) + summary.gross_revenue
    )
    totals["registered_expenses"] = round_decimal(
        Decimal(totals["registered_expenses"]) + summary.total_expenses
    )
    totals["estimated_result"] = round_decimal(
        Decimal(totals["estimated_result"]) + summary.estimated_economic_result
    )


def totals_to_weekday_performance(
    weekday: str,
    totals: dict[str, Decimal | int],
) -> WorkPatternWeekdayPerformance:
    active_days = int(totals["active_days"])
    total_worked_minutes = int(totals["total_worked_minutes"])
    total_distance_km = Decimal(totals["total_distance_km"])
    gross_revenue = Decimal(totals["gross_revenue"])
    registered_expenses = Decimal(totals["registered_expenses"])
    estimated_result = Decimal(totals["estimated_result"])
    hours = Decimal(total_worked_minutes) / Decimal("60")

    return WorkPatternWeekdayPerformance(
        weekday=weekday,
        active_days=active_days,
        sample_classification=classify_sample(active_days),
        total_worked_minutes=total_worked_minutes,
        total_distance_km=total_distance_km,
        total_trip_count=int(totals["total_trip_count"]),
        gross_revenue=gross_revenue,
        registered_expenses=registered_expenses,
        estimated_result=estimated_result,
        average_gross_revenue_per_active_day=divide_or_none(
            gross_revenue,
            Decimal(active_days),
        ),
        average_estimated_result_per_active_day=divide_or_none(
            estimated_result,
            Decimal(active_days),
        ),
        gross_revenue_per_hour=divide_or_none(gross_revenue, hours),
        estimated_result_per_hour=divide_or_none(estimated_result, hours),
        gross_revenue_per_km=divide_or_none(gross_revenue, total_distance_km),
        estimated_result_per_km=divide_or_none(estimated_result, total_distance_km),
        expense_ratio=divide_or_none(registered_expenses, gross_revenue),
    )


def weekday_label(weekday: str) -> str:
    return weekday.replace("_", " ").title()


def build_highest_observation(
    *,
    observation_type: str,
    metric: str,
    message_metric: str,
    weekdays: list[WorkPatternWeekdayPerformance],
) -> WorkPatternObservation | None:
    candidates = [
        weekday
        for weekday in weekdays
        if weekday.sample_classification != "insufficient"
        and getattr(weekday, metric) is not None
    ]
    if not candidates:
        return None

    selected = max(
        candidates,
        key=lambda weekday: (
            getattr(weekday, metric),
            -WEEKDAYS.index(weekday.weekday),
        ),
    )
    value = getattr(selected, metric)
    if not isinstance(value, Decimal):
        return None

    return WorkPatternObservation(
        type=observation_type,
        metric=metric,
        weekday=selected.weekday,
        value=value,
        message=f"{weekday_label(selected.weekday)} has the highest {message_metric}.",
    )


def build_most_frequently_worked_observation(
    weekdays: list[WorkPatternWeekdayPerformance],
) -> WorkPatternObservation | None:
    candidates = [
        weekday
        for weekday in weekdays
        if weekday.sample_classification != "insufficient"
    ]
    if not candidates:
        return None

    selected = max(
        candidates,
        key=lambda weekday: (
            weekday.active_days,
            -WEEKDAYS.index(weekday.weekday),
        ),
    )

    return WorkPatternObservation(
        type="most_frequently_worked_weekday",
        metric="active_days",
        weekday=selected.weekday,
        value=Decimal(selected.active_days),
        message=f"{weekday_label(selected.weekday)} is the most frequently worked weekday.",
    )


def build_observations(
    weekdays: list[WorkPatternWeekdayPerformance],
) -> list[WorkPatternObservation]:
    observations = [
        build_highest_observation(
            observation_type="highest_estimated_result_per_hour_weekday",
            metric="estimated_result_per_hour",
            message_metric="estimated result per hour",
            weekdays=weekdays,
        ),
        build_highest_observation(
            observation_type="highest_estimated_result_per_km_weekday",
            metric="estimated_result_per_km",
            message_metric="estimated result per km",
            weekdays=weekdays,
        ),
        build_highest_observation(
            observation_type="highest_average_estimated_result_per_active_day",
            metric="average_estimated_result_per_active_day",
            message_metric="average estimated result per active day",
            weekdays=weekdays,
        ),
        build_highest_observation(
            observation_type="highest_expense_burden_weekday",
            metric="expense_ratio",
            message_metric="expense ratio",
            weekdays=weekdays,
        ),
        build_most_frequently_worked_observation(weekdays),
    ]

    return [observation for observation in observations if observation is not None]


def build_weekday_performance(
    *,
    start_date: date,
    end_date: date,
    work_sessions: list[WorkSession],
    expenses: list[Expense],
    recurring_expenses: list[RecurringExpense],
    cost_profiles: list[VehicleCostProfile],
) -> list[WorkPatternWeekdayPerformance]:
    work_sessions_by_date = group_work_sessions_by_date(work_sessions)
    expenses_by_date = group_expenses_by_date(expenses)
    totals_by_weekday = {weekday: empty_weekday_totals() for weekday in WEEKDAYS}

    for current_date in daterange(start_date, end_date):
        daily_work_sessions = work_sessions_by_date.get(current_date, [])
        daily_expenses = expenses_by_date.get(current_date, [])
        if not daily_work_sessions and not daily_expenses:
            continue

        weekday = WEEKDAYS[current_date.weekday()]
        daily_summary = build_financial_summary(
            start_date=current_date,
            end_date=current_date,
            work_sessions=daily_work_sessions,
            expenses=daily_expenses,
            recurring_expenses=recurring_expenses,
            cost_profiles=cost_profiles,
        )
        add_daily_summary(
            totals=totals_by_weekday[weekday],
            summary=daily_summary,
            is_active_day=bool(daily_work_sessions),
        )

    return [
        totals_to_weekday_performance(weekday, totals_by_weekday[weekday])
        for weekday in WEEKDAYS
    ]


@router.get("/work-patterns", response_model=WorkPatternsResponse)
def get_work_patterns(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    start_date: Annotated[date, Query()],
    end_date: Annotated[date, Query()],
    vehicle_id: Annotated[int | None, Query(gt=0)] = None,
) -> WorkPatternsResponse:
    validate_date_range(start_date=start_date, end_date=end_date)
    validate_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)

    work_sessions, expenses, recurring_expenses, cost_profiles = get_financial_summary_records(
        user_id=current_user.id,
        db=db,
        start_date=start_date,
        end_date=end_date,
        vehicle_id=vehicle_id,
    )
    overall_summary = build_financial_summary(
        start_date=start_date,
        end_date=end_date,
        work_sessions=work_sessions,
        expenses=expenses,
        recurring_expenses=recurring_expenses,
        cost_profiles=cost_profiles,
    )
    weekdays = build_weekday_performance(
        start_date=start_date,
        end_date=end_date,
        work_sessions=work_sessions,
        expenses=expenses,
        recurring_expenses=recurring_expenses,
        cost_profiles=cost_profiles,
    )

    return WorkPatternsResponse(
        start_date=start_date,
        end_date=end_date,
        vehicle_id=vehicle_id,
        overall=summary_to_overall(
            summary=overall_summary,
            active_days=count_active_days(work_sessions),
        ),
        weekdays=weekdays,
        observations=build_observations(weekdays),
    )
