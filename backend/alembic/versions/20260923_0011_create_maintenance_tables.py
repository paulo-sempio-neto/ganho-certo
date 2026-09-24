"""create maintenance tables

Revision ID: 20260923_0011
Revises: 20260923_0010
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0011"
down_revision: str | None = "20260923_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "maintenance_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("interval_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("interval_days", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_cents", sa.Integer(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_maintenance_plans_id"), "maintenance_plans", ["id"])
    op.create_index(
        op.f("ix_maintenance_plans_vehicle_id"),
        "maintenance_plans",
        ["vehicle_id"],
    )

    op.create_table(
        "maintenance_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("maintenance_plan_id", sa.Integer(), nullable=False),
        sa.Column("service_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["maintenance_plan_id"], ["maintenance_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_maintenance_records_id"), "maintenance_records", ["id"])
    op.create_index(
        op.f("ix_maintenance_records_maintenance_plan_id"),
        "maintenance_records",
        ["maintenance_plan_id"],
    )
    op.create_index(
        op.f("ix_maintenance_records_service_date"),
        "maintenance_records",
        ["service_date"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_maintenance_records_service_date"), table_name="maintenance_records")
    op.drop_index(
        op.f("ix_maintenance_records_maintenance_plan_id"),
        table_name="maintenance_records",
    )
    op.drop_index(op.f("ix_maintenance_records_id"), table_name="maintenance_records")
    op.drop_table("maintenance_records")
    op.drop_index(op.f("ix_maintenance_plans_vehicle_id"), table_name="maintenance_plans")
    op.drop_index(op.f("ix_maintenance_plans_id"), table_name="maintenance_plans")
    op.drop_table("maintenance_plans")
