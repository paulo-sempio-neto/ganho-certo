"""create work sessions table

Revision ID: 20260923_0003
Revises: 20260923_0002
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0003"
down_revision: str | None = "20260923_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "work_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("gross_revenue_cents", sa.Integer(), nullable=False),
        sa.Column("distance_km", sa.Numeric(10, 2), nullable=False),
        sa.Column("worked_minutes", sa.Integer(), nullable=False),
        sa.Column("trip_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_work_sessions_id"), "work_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_work_sessions_user_id"), "work_sessions", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_work_sessions_vehicle_id"),
        "work_sessions",
        ["vehicle_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_work_sessions_work_date"),
        "work_sessions",
        ["work_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_work_sessions_work_date"), table_name="work_sessions")
    op.drop_index(op.f("ix_work_sessions_vehicle_id"), table_name="work_sessions")
    op.drop_index(op.f("ix_work_sessions_user_id"), table_name="work_sessions")
    op.drop_index(op.f("ix_work_sessions_id"), table_name="work_sessions")
    op.drop_table("work_sessions")
