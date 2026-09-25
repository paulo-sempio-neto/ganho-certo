from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Expense, User, Vehicle
from app.pagination import PaginationParams, get_pagination_params
from app.schemas import ExpenseCreate, ExpensePublic, ExpenseUpdate

router = APIRouter(prefix="/expenses", tags=["expenses"])


def money_to_cents(value: Decimal) -> int:
    return int((value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def validate_user_vehicle(vehicle_id: int | None, user_id: int, db: Session) -> None:
    if vehicle_id is None:
        return

    vehicle = db.scalar(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id)
    )
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found.")


def get_user_expense(expense_id: int, user_id: int, db: Session) -> Expense:
    expense = db.scalar(
        select(Expense).where(Expense.id == expense_id, Expense.user_id == user_id)
    )
    if expense is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found.")

    return expense


@router.post("", response_model=ExpensePublic, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Expense:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    expense = Expense(
        user_id=current_user.id,
        vehicle_id=payload.vehicle_id,
        expense_date=payload.expense_date,
        category=payload.category,
        amount_cents=money_to_cents(payload.amount),
        description=payload.description,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("", response_model=list[ExpensePublic])
def list_expenses(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination_params)],
) -> list[Expense]:
    query = (
        select(Expense)
        .where(Expense.user_id == current_user.id)
        .order_by(desc(Expense.expense_date), desc(Expense.created_at))
    )
    if pagination.limit is not None:
        query = query.limit(pagination.limit)
    if pagination.offset:
        query = query.offset(pagination.offset)

    return list(db.scalars(query).all())


@router.get("/{expense_id}", response_model=ExpensePublic)
def get_expense(
    expense_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Expense:
    return get_user_expense(expense_id=expense_id, user_id=current_user.id, db=db)


@router.put("/{expense_id}", response_model=ExpensePublic)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Expense:
    validate_user_vehicle(vehicle_id=payload.vehicle_id, user_id=current_user.id, db=db)
    expense = get_user_expense(expense_id=expense_id, user_id=current_user.id, db=db)
    expense.vehicle_id = payload.vehicle_id
    expense.expense_date = payload.expense_date
    expense.category = payload.category
    expense.amount_cents = money_to_cents(payload.amount)
    expense.description = payload.description

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    expense = get_user_expense(expense_id=expense_id, user_id=current_user.id, db=db)
    db.delete(expense)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
