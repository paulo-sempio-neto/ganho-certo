from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.financial_summary import (
    get_financial_summary,
    round_decimal,
    validate_date_range,
    validate_user_vehicle,
)
from app.models import Expense, User
from app.schemas import FinancialInsight, FinancialInsightsResponse, FinancialSummary

router = APIRouter(tags=["financial-insights"])

ZERO = Decimal("0")
PERCENT = Decimal("0.1")

CATEGORY_LABELS = {
    "fuel": "Combustível",
    "charging": "Recarga elétrica",
    "maintenance": "Manutenção",
    "parking": "Estacionamento",
    "toll": "Pedágio",
    "insurance": "Seguro",
    "rental": "Aluguel",
    "financing": "Financiamento",
    "washing": "Lavagem",
    "other": "Outros",
}


def format_money(value: Decimal) -> str:
    return f"R$ {round_decimal(value):.2f}".replace(".", ",")


def format_percent(value: Decimal) -> str:
    rounded = value.quantize(PERCENT, rounding=ROUND_HALF_UP)
    formatted = f"{rounded:.1f}".replace(".", ",")
    if formatted.endswith(",0"):
        formatted = formatted[:-2]

    return f"{formatted}%"


def format_day(value: date) -> str:
    return value.strftime("%d/%m")


def divide_or_none(numerator: Decimal, denominator: Decimal) -> Decimal | None:
    if denominator == ZERO:
        return None

    return numerator / denominator


def make_percentage(numerator: Decimal, denominator: Decimal) -> Decimal | None:
    quotient = divide_or_none(numerator, denominator)
    if quotient is None:
        return None

    return quotient * Decimal("100")


def get_expenses_by_category(
    db: Session,
    user_id: int,
    start_date: date | None,
    end_date: date | None,
    vehicle_id: int | None,
) -> dict[str, Decimal]:
    query = select(Expense).where(Expense.user_id == user_id)
    if start_date is not None:
        query = query.where(Expense.expense_date >= start_date)
    if end_date is not None:
        query = query.where(Expense.expense_date <= end_date)
    if vehicle_id is not None:
        query = query.where(Expense.vehicle_id == vehicle_id)

    totals_cents: defaultdict[str, int] = defaultdict(int)
    for expense in db.scalars(query):
        totals_cents[expense.category] += expense.amount_cents

    return {
        category: round_decimal(Decimal(amount_cents) / Decimal("100"))
        for category, amount_cents in totals_cents.items()
    }


def add_expense_share_insight(insights: list[FinancialInsight], summary: FinancialSummary) -> None:
    expense_share = make_percentage(summary.total_expenses, summary.gross_revenue)
    if expense_share is None:
        return

    insights.append(
        FinancialInsight(
            code="expense_share",
            type="attention" if expense_share >= Decimal("50") else "info",
            title="Despesas sobre o faturamento",
            message=(
                "Suas despesas registradas representam "
                f"{format_percent(expense_share)} do faturamento."
            ),
        )
    )


def add_net_per_hour_insight(insights: list[FinancialInsight], summary: FinancialSummary) -> None:
    if summary.net_per_hour is None:
        return

    insights.append(
        FinancialInsight(
            code="net_per_hour",
            type="positive" if summary.net_per_hour > ZERO else "attention",
            title="Resultado por hora",
            message=(
                "Seu resultado médio após despesas foi de "
                f"{format_money(summary.net_per_hour)} por hora."
            ),
        )
    )


def add_net_per_km_insight(insights: list[FinancialInsight], summary: FinancialSummary) -> None:
    if summary.net_per_km is None:
        return

    insights.append(
        FinancialInsight(
            code="net_per_km",
            type="positive" if summary.net_per_km > ZERO else "attention",
            title="Resultado por km",
            message=(
                "Seu resultado médio após despesas foi de "
                f"{format_money(summary.net_per_km)} por km."
            ),
        )
    )


def add_top_expense_category_insight(
    insights: list[FinancialInsight],
    expenses_by_category: dict[str, Decimal],
) -> None:
    positive_expenses = {
        category: amount for category, amount in expenses_by_category.items() if amount > ZERO
    }
    if not positive_expenses:
        return

    top_category, top_amount = max(positive_expenses.items(), key=lambda item: item[1])
    label = CATEGORY_LABELS.get(top_category, top_category)
    insights.append(
        FinancialInsight(
            code="top_expense_category",
            type="info",
            title="Maior categoria de despesa",
            message=(
                f"{label} foi sua maior despesa registrada no período, "
                f"totalizando {format_money(top_amount)}."
            ),
        )
    )


def add_best_day_insight(insights: list[FinancialInsight], summary: FinancialSummary) -> None:
    if not summary.daily:
        return

    best_day = max(summary.daily, key=lambda item: item.estimated_net_profit)
    insights.append(
        FinancialInsight(
            code="best_day",
            type="positive" if best_day.estimated_net_profit > ZERO else "info",
            title="Melhor dia do período",
            message=(
                f"Seu melhor resultado diário foi em {format_day(best_day.date)}, "
                f"com {format_money(best_day.estimated_net_profit)} após despesas registradas."
            ),
        )
    )


def previous_equivalent_period(start_date: date, end_date: date) -> tuple[date, date]:
    period_days = (end_date - start_date).days + 1
    previous_end = start_date - timedelta(days=1)
    previous_start = previous_end - timedelta(days=period_days - 1)
    return previous_start, previous_end


def add_comparison_insight(
    insights: list[FinancialInsight],
    code: str,
    title: str,
    label: str,
    current_value: Decimal | None,
    previous_value: Decimal | None,
) -> None:
    if current_value is None or previous_value is None or previous_value == ZERO:
        return

    change = current_value - previous_value
    if change == ZERO:
        return

    percentage = make_percentage(abs(change), abs(previous_value))
    if percentage is None:
        return

    direction = "aumentou" if change > ZERO else "caiu"
    insights.append(
        FinancialInsight(
            code=code,
            type="positive" if change > ZERO else "attention",
            title=title,
            message=(
                f"Seu {label} {direction} {format_percent(percentage)} "
                "em relação ao período anterior."
            ),
        )
    )


def add_previous_period_comparisons(
    insights: list[FinancialInsight],
    current_summary: FinancialSummary,
    previous_summary: FinancialSummary,
) -> None:
    add_comparison_insight(
        insights=insights,
        code="gross_revenue_change",
        title="Variação do faturamento",
        label="faturamento",
        current_value=current_summary.gross_revenue,
        previous_value=previous_summary.gross_revenue,
    )
    add_comparison_insight(
        insights=insights,
        code="net_result_change",
        title="Variação do resultado após despesas",
        label="resultado após despesas",
        current_value=current_summary.estimated_net_profit,
        previous_value=previous_summary.estimated_net_profit,
    )
    add_comparison_insight(
        insights=insights,
        code="net_per_hour_change",
        title="Variação do resultado por hora",
        label="resultado por hora",
        current_value=current_summary.net_per_hour,
        previous_value=previous_summary.net_per_hour,
    )


@router.get("/financial-insights", response_model=FinancialInsightsResponse)
def get_financial_insights(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    vehicle_id: Annotated[int | None, Query(gt=0)] = None,
) -> FinancialInsightsResponse:
    validate_date_range(start_date=start_date, end_date=end_date)
    validate_user_vehicle(vehicle_id=vehicle_id, user_id=current_user.id, db=db)

    summary = get_financial_summary(
        current_user=current_user,
        db=db,
        start_date=start_date,
        end_date=end_date,
        vehicle_id=vehicle_id,
    )
    insights: list[FinancialInsight] = []

    add_expense_share_insight(insights, summary)
    add_net_per_hour_insight(insights, summary)
    add_net_per_km_insight(insights, summary)
    add_top_expense_category_insight(
        insights=insights,
        expenses_by_category=get_expenses_by_category(
            db=db,
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            vehicle_id=vehicle_id,
        ),
    )
    add_best_day_insight(insights, summary)

    if start_date is not None and end_date is not None:
        previous_start, previous_end = previous_equivalent_period(start_date, end_date)
        previous_summary = get_financial_summary(
            current_user=current_user,
            db=db,
            start_date=previous_start,
            end_date=previous_end,
            vehicle_id=vehicle_id,
        )
        add_previous_period_comparisons(insights, summary, previous_summary)

    return FinancialInsightsResponse(insights=insights)
