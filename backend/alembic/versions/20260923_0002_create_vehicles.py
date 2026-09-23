"""create vehicles table

Revision ID: 20260923_0002
Revises: 20260923_0001
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0002"
down_revision: str | None = "20260923_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("brand", sa.String(length=120), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("fuel_type", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vehicles_id"), "vehicles", ["id"], unique=False)
    op.create_index(op.f("ix_vehicles_user_id"), "vehicles", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_vehicles_user_id"), table_name="vehicles")
    op.drop_index(op.f("ix_vehicles_id"), table_name="vehicles")
    op.drop_table("vehicles")
