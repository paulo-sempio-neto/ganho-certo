"""create financial goals table

Revision ID: 20260923_0007
Revises: 20260923_0006
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0007"
down_revision: str | None = "20260923_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "financial_goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("goal_type", sa.String(length=20), nullable=False),
        sa.Column("target_amount_cents", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_financial_goals_id"), "financial_goals", ["id"])
    op.create_index(op.f("ix_financial_goals_user_id"), "financial_goals", ["user_id"])
    op.create_index(op.f("ix_financial_goals_vehicle_id"), "financial_goals", ["vehicle_id"])
    op.create_index(op.f("ix_financial_goals_start_date"), "financial_goals", ["start_date"])
    op.create_index(op.f("ix_financial_goals_end_date"), "financial_goals", ["end_date"])


def downgrade() -> None:
    op.drop_index(op.f("ix_financial_goals_end_date"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_start_date"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_vehicle_id"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_user_id"), table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_id"), table_name="financial_goals")
    op.drop_table("financial_goals")
