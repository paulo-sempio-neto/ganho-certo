"""add work session import fingerprint

Revision ID: 20260923_0008
Revises: 20260923_0007
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0008"
down_revision: str | None = "20260923_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "work_sessions",
        sa.Column("import_fingerprint", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_work_sessions_import_fingerprint"),
        "work_sessions",
        ["import_fingerprint"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_work_sessions_user_import_fingerprint",
        "work_sessions",
        ["user_id", "import_fingerprint"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_work_sessions_user_import_fingerprint",
        "work_sessions",
        type_="unique",
    )
    op.drop_index(op.f("ix_work_sessions_import_fingerprint"), table_name="work_sessions")
    op.drop_column("work_sessions", "import_fingerprint")
