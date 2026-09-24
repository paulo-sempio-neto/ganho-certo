"""create recurring expenses table

Revision ID: 20260923_0006
Revises: 20260923_0005
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0006"
down_revision: str | None = "20260923_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recurring_expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("frequency", sa.String(length=20), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recurring_expenses_id"), "recurring_expenses", ["id"])
    op.create_index(
        op.f("ix_recurring_expenses_start_date"),
        "recurring_expenses",
        ["start_date"],
    )
    op.create_index(
        op.f("ix_recurring_expenses_user_id"),
        "recurring_expenses",
        ["user_id"],
    )
    op.create_index(
        op.f("ix_recurring_expenses_vehicle_id"),
        "recurring_expenses",
        ["vehicle_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_recurring_expenses_vehicle_id"), table_name="recurring_expenses")
    op.drop_index(op.f("ix_recurring_expenses_user_id"), table_name="recurring_expenses")
    op.drop_index(op.f("ix_recurring_expenses_start_date"), table_name="recurring_expenses")
    op.drop_index(op.f("ix_recurring_expenses_id"), table_name="recurring_expenses")
    op.drop_table("recurring_expenses")
