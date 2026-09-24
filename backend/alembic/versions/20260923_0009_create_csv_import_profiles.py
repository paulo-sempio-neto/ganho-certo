"""create csv import profiles table

Revision ID: 20260923_0009
Revises: 20260923_0008
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0009"
down_revision: str | None = "20260923_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "csv_import_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("import_type", sa.String(length=30), nullable=False),
        sa.Column("header_signature", sa.String(length=64), nullable=False),
        sa.Column("column_mapping", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_csv_import_profiles_id"), "csv_import_profiles", ["id"])
    op.create_index(op.f("ix_csv_import_profiles_user_id"), "csv_import_profiles", ["user_id"])
    op.create_index(
        op.f("ix_csv_import_profiles_vehicle_id"),
        "csv_import_profiles",
        ["vehicle_id"],
    )
    op.create_index(
        op.f("ix_csv_import_profiles_import_type"),
        "csv_import_profiles",
        ["import_type"],
    )
    op.create_index(
        op.f("ix_csv_import_profiles_header_signature"),
        "csv_import_profiles",
        ["header_signature"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_csv_import_profiles_header_signature"), table_name="csv_import_profiles")
    op.drop_index(op.f("ix_csv_import_profiles_import_type"), table_name="csv_import_profiles")
    op.drop_index(op.f("ix_csv_import_profiles_vehicle_id"), table_name="csv_import_profiles")
    op.drop_index(op.f("ix_csv_import_profiles_user_id"), table_name="csv_import_profiles")
    op.drop_index(op.f("ix_csv_import_profiles_id"), table_name="csv_import_profiles")
    op.drop_table("csv_import_profiles")
