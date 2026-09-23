"""create expenses table

Revision ID: 20260923_0004
Revises: 20260923_0003
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0004"
down_revision: str | None = "20260923_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_expenses_expense_date"), "expenses", ["expense_date"], unique=False)
    op.create_index(op.f("ix_expenses_id"), "expenses", ["id"], unique=False)
    op.create_index(op.f("ix_expenses_user_id"), "expenses", ["user_id"], unique=False)
    op.create_index(op.f("ix_expenses_vehicle_id"), "expenses", ["vehicle_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_expenses_vehicle_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_user_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_id"), table_name="expenses")
    op.drop_index(op.f("ix_expenses_expense_date"), table_name="expenses")
    op.drop_table("expenses")
