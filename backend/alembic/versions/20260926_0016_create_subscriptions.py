"""create subscriptions

Revision ID: 20260926_0016
Revises: 20260926_0015
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0016"
down_revision: str | None = "20260926_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("external_subscription_id", sa.String(length=120), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subscriptions_id"), "subscriptions", ["id"])
    op.create_index(op.f("ix_subscriptions_user_id"), "subscriptions", ["user_id"])
    op.create_index(op.f("ix_subscriptions_plan_id"), "subscriptions", ["plan_id"])
    op.create_index(op.f("ix_subscriptions_status"), "subscriptions", ["status"])
    op.create_index(op.f("ix_subscriptions_provider"), "subscriptions", ["provider"])
    op.create_index(
        op.f("ix_subscriptions_external_subscription_id"),
        "subscriptions",
        ["external_subscription_id"],
    )
    op.create_index(
        op.f("ix_subscriptions_current_period_end"),
        "subscriptions",
        ["current_period_end"],
    )
    op.create_index(
        "ix_subscriptions_user_status_period",
        "subscriptions",
        ["user_id", "status", "current_period_end"],
    )
    op.create_index(
        "ix_subscriptions_provider_external",
        "subscriptions",
        ["provider", "external_subscription_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_subscriptions_provider_external", table_name="subscriptions")
    op.drop_index("ix_subscriptions_user_status_period", table_name="subscriptions")
    op.drop_index(
        op.f("ix_subscriptions_current_period_end"),
        table_name="subscriptions",
    )
    op.drop_index(
        op.f("ix_subscriptions_external_subscription_id"),
        table_name="subscriptions",
    )
    op.drop_index(op.f("ix_subscriptions_provider"), table_name="subscriptions")
    op.drop_index(op.f("ix_subscriptions_status"), table_name="subscriptions")
    op.drop_index(op.f("ix_subscriptions_plan_id"), table_name="subscriptions")
    op.drop_index(op.f("ix_subscriptions_user_id"), table_name="subscriptions")
    op.drop_index(op.f("ix_subscriptions_id"), table_name="subscriptions")
    op.drop_table("subscriptions")
