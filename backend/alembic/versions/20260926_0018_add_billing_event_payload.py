"""add billing event payload

Revision ID: 20260926_0018
Revises: 20260926_0017
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0018"
down_revision: str | None = "20260926_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("billing_events", sa.Column("raw_payload", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("billing_events", "raw_payload")
