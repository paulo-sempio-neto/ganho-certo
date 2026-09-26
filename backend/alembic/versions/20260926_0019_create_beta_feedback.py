"""create beta feedback

Revision ID: 20260926_0019
Revises: 20260926_0018
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0019"
down_revision: str | None = "20260926_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "beta_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("message", sa.String(length=2000), nullable=False),
        sa.Column("path", sa.String(length=200), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_beta_feedback_id"), "beta_feedback", ["id"])
    op.create_index(op.f("ix_beta_feedback_user_id"), "beta_feedback", ["user_id"])
    op.create_index(op.f("ix_beta_feedback_category"), "beta_feedback", ["category"])
    op.create_index(
        "ix_beta_feedback_user_created_at",
        "beta_feedback",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_beta_feedback_category_created_at",
        "beta_feedback",
        ["category", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_beta_feedback_category_created_at", table_name="beta_feedback")
    op.drop_index("ix_beta_feedback_user_created_at", table_name="beta_feedback")
    op.drop_index(op.f("ix_beta_feedback_category"), table_name="beta_feedback")
    op.drop_index(op.f("ix_beta_feedback_user_id"), table_name="beta_feedback")
    op.drop_index(op.f("ix_beta_feedback_id"), table_name="beta_feedback")
    op.drop_table("beta_feedback")
