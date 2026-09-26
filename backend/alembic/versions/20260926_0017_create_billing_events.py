"""create billing events

Revision ID: 20260926_0017
Revises: 20260926_0016
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0017"
down_revision: str | None = "20260926_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "billing_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("external_event_id", sa.String(length=160), nullable=False),
        sa.Column("payload_hash", sa.String(length=128), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "external_event_id",
            name="uq_billing_events_provider_external_event",
        ),
    )
    op.create_index(op.f("ix_billing_events_id"), "billing_events", ["id"])
    op.create_index(op.f("ix_billing_events_user_id"), "billing_events", ["user_id"])
    op.create_index(op.f("ix_billing_events_provider"), "billing_events", ["provider"])
    op.create_index(op.f("ix_billing_events_event_type"), "billing_events", ["event_type"])
    op.create_index(
        op.f("ix_billing_events_external_event_id"),
        "billing_events",
        ["external_event_id"],
    )
    op.create_index(
        "ix_billing_events_user_created_at",
        "billing_events",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_billing_events_provider_event_type",
        "billing_events",
        ["provider", "event_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_billing_events_provider_event_type", table_name="billing_events")
    op.drop_index("ix_billing_events_user_created_at", table_name="billing_events")
    op.drop_index(op.f("ix_billing_events_external_event_id"), table_name="billing_events")
    op.drop_index(op.f("ix_billing_events_event_type"), table_name="billing_events")
    op.drop_index(op.f("ix_billing_events_provider"), table_name="billing_events")
    op.drop_index(op.f("ix_billing_events_user_id"), table_name="billing_events")
    op.drop_index(op.f("ix_billing_events_id"), table_name="billing_events")
    op.drop_table("billing_events")
