"""extend beta feedback

Revision ID: 20260926_0021
Revises: 20260926_0020
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0021"
down_revision: str | None = "20260926_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "beta_feedback",
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
    )
    op.add_column(
        "beta_feedback",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
    )
    op.add_column(
        "beta_feedback",
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_beta_feedback_priority"), "beta_feedback", ["priority"])
    op.create_index(op.f("ix_beta_feedback_status"), "beta_feedback", ["status"])
    op.alter_column("beta_feedback", "priority", server_default=None)
    op.alter_column("beta_feedback", "status", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_beta_feedback_status"), table_name="beta_feedback")
    op.drop_index(op.f("ix_beta_feedback_priority"), table_name="beta_feedback")
    op.drop_column("beta_feedback", "resolved_at")
    op.drop_column("beta_feedback", "status")
    op.drop_column("beta_feedback", "priority")
