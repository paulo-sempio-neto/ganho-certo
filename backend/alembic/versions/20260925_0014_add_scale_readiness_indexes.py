"""add scale readiness indexes

Revision ID: 20260925_0014
Revises: 20260925_0013
Create Date: 2026-09-25
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260925_0014"
down_revision: str | None = "20260925_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_work_sessions_user_work_date_created_at",
        "work_sessions",
        ["user_id", "work_date", "created_at"],
    )
    op.create_index(
        "ix_work_sessions_vehicle_work_date",
        "work_sessions",
        ["vehicle_id", "work_date"],
    )
    op.create_index(
        "ix_expenses_user_expense_date_created_at",
        "expenses",
        ["user_id", "expense_date", "created_at"],
    )
    op.create_index(
        "ix_expenses_vehicle_expense_date",
        "expenses",
        ["vehicle_id", "expense_date"],
    )
    op.create_index(
        "ix_recurring_expenses_user_active_start_date_created_at",
        "recurring_expenses",
        ["user_id", "active", "start_date", "created_at"],
    )
    op.create_index(
        "ix_financial_goals_user_start_date_created_at",
        "financial_goals",
        ["user_id", "start_date", "created_at"],
    )
    op.create_index(
        "ix_csv_import_profiles_user_updated_created",
        "csv_import_profiles",
        ["user_id", "updated_at", "created_at"],
    )
    op.create_index(
        "ix_csv_import_profiles_user_type_header_updated",
        "csv_import_profiles",
        ["user_id", "import_type", "header_signature", "updated_at"],
    )
    op.create_index(
        "ix_maintenance_plans_vehicle_created_at",
        "maintenance_plans",
        ["vehicle_id", "created_at"],
    )
    op.create_index(
        "ix_maintenance_records_plan_service_date_created_at",
        "maintenance_records",
        ["maintenance_plan_id", "service_date", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_maintenance_records_plan_service_date_created_at",
        table_name="maintenance_records",
    )
    op.drop_index("ix_maintenance_plans_vehicle_created_at", table_name="maintenance_plans")
    op.drop_index(
        "ix_csv_import_profiles_user_type_header_updated",
        table_name="csv_import_profiles",
    )
    op.drop_index(
        "ix_csv_import_profiles_user_updated_created",
        table_name="csv_import_profiles",
    )
    op.drop_index(
        "ix_financial_goals_user_start_date_created_at",
        table_name="financial_goals",
    )
    op.drop_index(
        "ix_recurring_expenses_user_active_start_date_created_at",
        table_name="recurring_expenses",
    )
    op.drop_index("ix_expenses_vehicle_expense_date", table_name="expenses")
    op.drop_index("ix_expenses_user_expense_date_created_at", table_name="expenses")
    op.drop_index("ix_work_sessions_vehicle_work_date", table_name="work_sessions")
    op.drop_index(
        "ix_work_sessions_user_work_date_created_at",
        table_name="work_sessions",
    )
