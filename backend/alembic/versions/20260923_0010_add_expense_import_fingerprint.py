"""add expense import fingerprint

Revision ID: 20260923_0010
Revises: 20260923_0009
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0010"
down_revision: str | None = "20260923_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("import_fingerprint", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_expenses_import_fingerprint"), "expenses", ["import_fingerprint"])
    op.create_unique_constraint(
        "uq_expenses_user_import_fingerprint",
        "expenses",
        ["user_id", "import_fingerprint"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_expenses_user_import_fingerprint", "expenses", type_="unique")
    op.drop_index(op.f("ix_expenses_import_fingerprint"), table_name="expenses")
    op.drop_column("expenses", "import_fingerprint")
