"""create vehicle cost profiles table

Revision ID: 20260923_0005
Revises: 20260923_0004
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0005"
down_revision: str | None = "20260923_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vehicle_cost_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("ownership_type", sa.String(length=20), nullable=False),
        sa.Column("rental_monthly_cents", sa.Integer(), nullable=True),
        sa.Column("financing_monthly_cents", sa.Integer(), nullable=True),
        sa.Column("insurance_monthly_cents", sa.Integer(), nullable=True),
        sa.Column("ipva_annual_cents", sa.Integer(), nullable=True),
        sa.Column("other_fixed_monthly_cents", sa.Integer(), nullable=True),
        sa.Column("maintenance_per_km", sa.Numeric(12, 4), nullable=True),
        sa.Column("tires_per_km", sa.Numeric(12, 4), nullable=True),
        sa.Column("oil_per_km", sa.Numeric(12, 4), nullable=True),
        sa.Column("depreciation_per_km", sa.Numeric(12, 4), nullable=True),
        sa.Column("fuel_efficiency_km_per_liter", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("vehicle_id"),
    )
    op.create_index(op.f("ix_vehicle_cost_profiles_id"), "vehicle_cost_profiles", ["id"])
    op.create_index(
        op.f("ix_vehicle_cost_profiles_vehicle_id"),
        "vehicle_cost_profiles",
        ["vehicle_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_vehicle_cost_profiles_vehicle_id"), table_name="vehicle_cost_profiles")
    op.drop_index(op.f("ix_vehicle_cost_profiles_id"), table_name="vehicle_cost_profiles")
    op.drop_table("vehicle_cost_profiles")
