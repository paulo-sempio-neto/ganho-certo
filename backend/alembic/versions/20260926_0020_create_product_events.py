"""create product events

Revision ID: 20260926_0020
Revises: 20260926_0019
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0020"
down_revision: str | None = "20260926_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "product_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("dedupe_key", sa.String(length=120), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "event_type",
            "dedupe_key",
            name="uq_product_events_user_type_dedupe",
        ),
    )
    op.create_index(op.f("ix_product_events_id"), "product_events", ["id"])
    op.create_index(op.f("ix_product_events_user_id"), "product_events", ["user_id"])
    op.create_index(op.f("ix_product_events_event_type"), "product_events", ["event_type"])
    op.create_index(op.f("ix_product_events_occurred_at"), "product_events", ["occurred_at"])
    op.create_index(
        "ix_product_events_user_occurred_at",
        "product_events",
        ["user_id", "occurred_at"],
    )
    op.create_index(
        "ix_product_events_type_occurred_at",
        "product_events",
        ["event_type", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_product_events_type_occurred_at", table_name="product_events")
    op.drop_index("ix_product_events_user_occurred_at", table_name="product_events")
    op.drop_index(op.f("ix_product_events_occurred_at"), table_name="product_events")
    op.drop_index(op.f("ix_product_events_event_type"), table_name="product_events")
    op.drop_index(op.f("ix_product_events_user_id"), table_name="product_events")
    op.drop_index(op.f("ix_product_events_id"), table_name="product_events")
    op.drop_table("product_events")
