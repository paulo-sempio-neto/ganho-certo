from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.financial_summary import (
    build_financial_summary,
    divide_or_none,
    get_financial_summary_records,
    inclusive_days,
    month_end,
    round_decimal,
    validate_date_range,
    validate_user_vehicle,
)
from app.models import Expense, RecurringExpense, User, VehicleCostProfile, WorkSession
from app.schemas import (
    FinancialHistoryComparison,
    FinancialHistoryGrouping,
    FinancialHistoryMetricComparison,
    FinancialHistoryPeriod,
    FinancialHistoryResponse,
    FinancialHistoryTrendDirection,
    FinancialHistoryTrendFact,
    FinancialSummary,
)

router = APIRouter(tags=["financial-history"])


def next_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)

    return date(value.year, value.month + 1, 1)


def get_group_periods(
    start_date: date,
    end_date: date,
    grouping: FinancialHistoryGrouping,
) -> list[tuple[date, date]]:
    periods: list[tuple[date, date]] = []
    current_start = start_date

    while current_start <= end_date:
        if grouping == "daily":
            current_end = current_start
        elif grouping == "weekly":
            current_end = min(current_start + timedelta(days=6), end_date)
        else:
            current_end = min(month_end(current_start), end_date)

        periods.append((current_start, current_end))
        current_start = current_end + timedelta(days=1)

        if grouping == "monthly" and current_start.day != 1:
            current_start = next_month(current_end)

    return periods


def filter_work_sessions(
    work_sessions: list[WorkSession],
    start_date: date,
    end_date: date,
) -> list[WorkSession]:
    return [
        work_session
        for work_session in work_sessions
        if start_date <= work_session.work_date <= end_date
    ]


def filter_expenses(expenses: list[Expense], start_date: date, end_date: date) -> list[Expense]:
    return [expense for expense in expenses if start_date <= expense.expense_date <= end_date]


def build_summary_for_period(
    *,
    start_date: date,
    end_date: date,
    work_sessions: list[WorkSession],
    expenses: list[Expense],
    recurring_expenses: list[RecurringExpense],
    cost_profiles: list[VehicleCostProfile],
) -> FinancialSummary:
    return build_financial_summary(
        start_date=start_date,
        end_date=end_date,
        work_sessions=filter_work_sessions(work_sessions, start_date, end_date),
        expenses=filter_expenses(expenses, start_date, end_date),
        recurring_expenses=recurring_expenses,
        cost_profiles=cost_profiles,
    )


def result_per_hour(summary: FinancialSummary) -> Decimal | None:
    hours = Decimal(summary.total_worked_minutes) / Decimal("60")
    return divide_or_none(summary.estimated_economic_result, hours)


def result_per_km(summary: FinancialSummary) -> Decimal | None:
    return divide_or_none(summary.estimated_economic_result, summary.total_distance_km)


def summary_to_history_period(
    *,
    period_start: date,
    period_end: date,
    summary: FinancialSummary,
) -> FinancialHistoryPeriod:
    return FinancialHistoryPeriod(
        period_start=period_start,
        period_end=period_end,
        gross_revenue=summary.gross_revenue,
        registered_expenses=summary.total_expenses,
        estimated_structural_costs=summary.estimated_structural_costs,
        recurring_projected_expenses=summary.recurring_expenses_total,
        cash_remaining=summary.estimated_net_profit,
        estimated_result=summary.estimated_economic_result,
        projected_result=summary.projected_economic_result,
        worked_minutes=summary.total_worked_minutes,
        distance_km=summary.total_distance_km,
        trip_count=summary.total_trip_count,
        revenue_per_hour=summary.gross_per_hour,
        estimated_result_per_hour=result_per_hour(summary),
        revenue_per_km=summary.gross_per_km,
        estimated_result_per_km=result_per_km(summary),
    )


def percentage_delta(current: Decimal | None, previous: Decimal | None) -> Decimal | None:
    if current is None or previous is None or previous == 0:
        return None

    return round_decimal((current - previous) / previous * Decimal("100"))


def compare_metric(
    current: Decimal | None,
    previous: Decimal | None,
) -> FinancialHistoryMetricComparison:
    absolute_delta = None
    if current is not None and previous is not None:
        absolute_delta = round_decimal(current - previous)

    return FinancialHistoryMetricComparison(
        current=current,
        previous=previous,
        absolute_delta=absolute_delta,
        percentage_delta=percentage_delta(current, previous),
    )


def compare_summaries(
    *,
    current_start: date,
    current_end: date,
    previous_start: date,
    previous_end: date,
    current_summary: FinancialSummary,
    previous_summary: FinancialSummary,
) -> FinancialHistoryComparison:
    return FinancialHistoryComparison(
        current_period_start=current_start,
        current_period_end=current_end,
        previous_period_start=previous_start,
        previous_period_end=previous_end,
        gross_revenue=compare_metric(
            current_summary.gross_revenue,
            previous_summary.gross_revenue,
        ),
        registered_expenses=compare_metric(
            current_summary.total_expenses,
            previous_summary.total_expenses,
        ),
        estimated_result=compare_metric(
            current_summary.estimated_economic_result,
            previous_summary.estimated_economic_result,
        ),
        projected_result=compare_metric(
            current_summary.projected_economic_result,
            previous_summary.projected_economic_result,
        ),
        worked_minutes=compare_metric(
            Decimal(current_summary.total_worked_minutes),
            Decimal(previous_summary.total_worked_minutes),
        ),
        distance_km=compare_metric(
            current_summary.total_distance_km,
            previous_summary.total_distance_km,
        ),
        estimated_result_per_hour=compare_metric(
            result_per_hour(current_summary),
            result_per_hour(previous_summary),
        ),
        estimated_result_per_km=compare_metric(
            result_per_km(current_summary),
            result_per_km(previous_summary),
        ),
    )


def trend_direction(delta: Decimal) -> FinancialHistoryTrendDirection:
    if delta > 0:
        return "increased"

    if delta < 0:
        return "decreased"

    return "unchanged"


def comparison_to_trend_fact(
    metric: str,
    comparison: FinancialHistoryMetricComparison,
) -> FinancialHistoryTrendFact | None:
    if (
        comparison.current is None
        or comparison.previous is None
        or comparison.absolute_delta is None
    ):
        return None

    return FinancialHistoryTrendFact(
        metric=metric,
        direction=trend_direction(comparison.absolute_delta),
        current=comparison.current,
        previous=comparison.previous,
        absolute_delta=comparison.absolute_delta,
        percentage_delta=comparison.percentage_delta,
    )


def build_trend_facts(comparison: FinancialHistoryComparison) -> list[FinancialHistoryTrendFact]:
    facts: list[FinancialHistoryTrendFact] = []
    for metric, metric_comparison in [
        ("estimated_result", comparison.estimated_result),
        ("estimated_result_per_hour", comparison.estimated_result_per_hour),
        ("estimated_result_per_km", comparison.estimated_result_per_km),
        ("registered_expenses", comparison.registered_expenses),
        ("worked_minutes", comparison.worked_minutes),
    ]:
        fact = comparison_to_trend_fact(metric, metric_comparison)
        if fact is not None:
            facts.append(fact)

    return facts


@router.get("/financial-history", response_model=FinancialHistoryResponse)
def get_financial_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    start_date: Annotated[date, Query()],
    end_date: Annotated[date, Query()],
    grouping: Annotated[FinancialHistoryGrouping, Query()] = "daily",
    vehicle_id: Annotated[int | None, Query(gt=0)] = None,
) -> FinancialHistoryResponse:
    validate_date_range(start_date=start_date, end_date=end_date)
    validate_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)

    current_period_days = inclusive_days(start_date, end_date)
    previous_start = start_date - timedelta(days=current_period_days)
    previous_end = start_date - timedelta(days=1)
    work_sessions, expenses, recurring_expenses, cost_profiles = get_financial_summary_records(
        user_id=current_user.id,
        db=db,
        start_date=previous_start,
        end_date=end_date,
        vehicle_id=vehicle_id,
    )

    periods = [
        summary_to_history_period(
            period_start=period_start,
            period_end=period_end,
            summary=build_summary_for_period(
                start_date=period_start,
                end_date=period_end,
                work_sessions=work_sessions,
                expenses=expenses,
                recurring_expenses=recurring_expenses,
                cost_profiles=cost_profiles,
            ),
        )
        for period_start, period_end in get_group_periods(start_date, end_date, grouping)
    ]
    current_summary = build_summary_for_period(
        start_date=start_date,
        end_date=end_date,
        work_sessions=work_sessions,
        expenses=expenses,
        recurring_expenses=recurring_expenses,
        cost_profiles=cost_profiles,
    )
    previous_summary = build_summary_for_period(
        start_date=previous_start,
        end_date=previous_end,
        work_sessions=work_sessions,
        expenses=expenses,
        recurring_expenses=recurring_expenses,
        cost_profiles=cost_profiles,
    )
    comparison = compare_summaries(
        current_start=start_date,
        current_end=end_date,
        previous_start=previous_start,
        previous_end=previous_end,
        current_summary=current_summary,
        previous_summary=previous_summary,
    )

    return FinancialHistoryResponse(
        start_date=start_date,
        end_date=end_date,
        vehicle_id=vehicle_id,
        grouping=grouping,
        periods=periods,
        comparison=comparison,
        trend_facts=build_trend_facts(comparison),
    )
