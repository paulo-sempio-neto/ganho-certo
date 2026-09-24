"""add active financial goal unique indexes

Revision ID: 20260924_0012
Revises: 20260923_0011
Create Date: 2026-09-24
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_0012"
down_revision: str | None = "20260923_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _partial_index_kwargs(
    postgresql_where_sql: str,
    sqlite_where_sql: str,
) -> dict[str, Any]:
    dialect_name = op.get_bind().dialect.name
    if dialect_name == "postgresql":
        return {"postgresql_where": sa.text(postgresql_where_sql)}
    if dialect_name == "sqlite":
        return {"sqlite_where": sa.text(sqlite_where_sql)}

    return {}


def upgrade() -> None:
    op.create_index(
        "uq_financial_goals_active_vehicle",
        "financial_goals",
        ["user_id", "goal_type", "vehicle_id"],
        unique=True,
        **_partial_index_kwargs(
            "active IS TRUE AND vehicle_id IS NOT NULL",
            "active = 1 AND vehicle_id IS NOT NULL",
        ),
    )
    op.create_index(
        "uq_financial_goals_active_without_vehicle",
        "financial_goals",
        ["user_id", "goal_type"],
        unique=True,
        **_partial_index_kwargs(
            "active IS TRUE AND vehicle_id IS NULL",
            "active = 1 AND vehicle_id IS NULL",
        ),
    )


def downgrade() -> None:
    op.drop_index("uq_financial_goals_active_without_vehicle", table_name="financial_goals")
    op.drop_index("uq_financial_goals_active_vehicle", table_name="financial_goals")
