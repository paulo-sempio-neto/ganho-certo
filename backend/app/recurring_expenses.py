from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.expenses import money_to_cents, validate_user_vehicle
from app.models import RecurringExpense, User
from app.schemas import RecurringExpenseCreate, RecurringExpensePublic, RecurringExpenseUpdate

router = APIRouter(prefix="/recurring-expenses", tags=["recurring-expenses"])


def get_user_recurring_expense(
    recurring_expense_id: int,
    user_id: int,
    db: Session,
) -> RecurringExpense:
    recurring_expense = db.scalar(
        select(RecurringExpense).where(
            RecurringExpense.id == recurring_expense_id,
            RecurringExpense.user_id == user_id,
        )
    )
    if recurring_expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring expense not found.",
        )

    return recurring_expense


@router.post("", response_model=RecurringExpensePublic, status_code=status.HTTP_201_CREATED)
def create_recurring_expense(
    payload: RecurringExpenseCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RecurringExpense:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    recurring_expense = RecurringExpense(
        user_id=current_user.id,
        vehicle_id=payload.vehicle_id,
        category=payload.category,
        amount_cents=money_to_cents(payload.amount),
        frequency=payload.frequency,
        start_date=payload.start_date,
        end_date=payload.end_date,
        description=payload.description,
        active=payload.active,
    )
    db.add(recurring_expense)
    db.commit()
    db.refresh(recurring_expense)
    return recurring_expense


@router.get("", response_model=list[RecurringExpensePublic])
def list_recurring_expenses(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[RecurringExpense]:
    return list(
        db.scalars(
            select(RecurringExpense)
            .where(RecurringExpense.user_id == current_user.id)
            .order_by(desc(RecurringExpense.start_date), desc(RecurringExpense.created_at))
        ).all()
    )


@router.get("/{recurring_expense_id}", response_model=RecurringExpensePublic)
def get_recurring_expense(
    recurring_expense_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RecurringExpense:
    return get_user_recurring_expense(
        recurring_expense_id=recurring_expense_id,
        user_id=current_user.id,
        db=db,
    )


@router.put("/{recurring_expense_id}", response_model=RecurringExpensePublic)
def update_recurring_expense(
    recurring_expense_id: int,
    payload: RecurringExpenseUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RecurringExpense:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    recurring_expense = get_user_recurring_expense(
        recurring_expense_id=recurring_expense_id,
        user_id=current_user.id,
        db=db,
    )
    recurring_expense.vehicle_id = payload.vehicle_id
    recurring_expense.category = payload.category
    recurring_expense.amount_cents = money_to_cents(payload.amount)
    recurring_expense.frequency = payload.frequency
    recurring_expense.start_date = payload.start_date
    recurring_expense.end_date = payload.end_date
    recurring_expense.description = payload.description
    recurring_expense.active = payload.active

    db.commit()
    db.refresh(recurring_expense)
    return recurring_expense


@router.delete("/{recurring_expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_expense(
    recurring_expense_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    recurring_expense = get_user_recurring_expense(
        recurring_expense_id=recurring_expense_id,
        user_id=current_user.id,
        db=db,
    )
    db.delete(recurring_expense)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
