"""create entitlement tables

Revision ID: 20260926_0015
Revises: 20260925_0014
Create Date: 2026-09-26
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision: str = "20260926_0015"
down_revision: str | None = "20260925_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

plans_table = sa.table(
    "plans",
    sa.column("id", sa.Integer()),
    sa.column("name", sa.String()),
    sa.column("code", sa.String()),
    sa.column("active", sa.Boolean()),
    sa.column("created_at", sa.DateTime(timezone=True)),
)
features_table = sa.table(
    "features",
    sa.column("id", sa.Integer()),
    sa.column("code", sa.String()),
    sa.column("name", sa.String()),
    sa.column("active", sa.Boolean()),
    sa.column("created_at", sa.DateTime(timezone=True)),
)
plan_features_table = sa.table(
    "plan_features",
    sa.column("plan_id", sa.Integer()),
    sa.column("feature_id", sa.Integer()),
    sa.column("enabled", sa.Boolean()),
    sa.column("limit_value", sa.Integer()),
    sa.column("created_at", sa.DateTime(timezone=True)),
)
users_table = sa.table(
    "users",
    sa.column("current_plan_id", sa.Integer()),
)


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_plans_active"), "plans", ["active"])
    op.create_index(op.f("ix_plans_code"), "plans", ["code"], unique=True)
    op.create_index(op.f("ix_plans_id"), "plans", ["id"])

    op.create_table(
        "features",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_features_active"), "features", ["active"])
    op.create_index(op.f("ix_features_code"), "features", ["code"], unique=True)
    op.create_index(op.f("ix_features_id"), "features", ["id"])

    op.create_table(
        "plan_features",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("feature_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("limit_value", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["feature_id"], ["features.id"]),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "feature_id", name="uq_plan_features_plan_feature"),
    )
    op.create_index(op.f("ix_plan_features_feature_id"), "plan_features", ["feature_id"])
    op.create_index(op.f("ix_plan_features_id"), "plan_features", ["id"])
    op.create_index(op.f("ix_plan_features_plan_id"), "plan_features", ["plan_id"])

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("current_plan_id", sa.Integer(), nullable=True))
        batch_op.create_index(op.f("ix_users_current_plan_id"), ["current_plan_id"])
        batch_op.create_foreign_key(
            "fk_users_current_plan_id_plans",
            "plans",
            ["current_plan_id"],
            ["id"],
        )

    bind = op.get_bind()
    created_at = datetime.now(UTC)
    bind.execute(
        plans_table.insert(),
        [
            {"name": "Free", "code": "free", "active": True, "created_at": created_at},
            {"name": "Pro", "code": "pro", "active": True, "created_at": created_at},
        ],
    )
    bind.execute(
        features_table.insert(),
        [
            {
                "code": "vehicle_limit",
                "name": "Limite de veiculos",
                "active": True,
                "created_at": created_at,
            },
            {
                "code": "advanced_history",
                "name": "Historico avancado",
                "active": True,
                "created_at": created_at,
            },
            {
                "code": "csv_import",
                "name": "Importacao CSV",
                "active": True,
                "created_at": created_at,
            },
            {
                "code": "financial_insights",
                "name": "Insights financeiros",
                "active": True,
                "created_at": created_at,
            },
        ],
    )

    plan_ids = dict(bind.execute(sa.select(plans_table.c.code, plans_table.c.id)).all())
    feature_ids = dict(bind.execute(sa.select(features_table.c.code, features_table.c.id)).all())
    bind.execute(
        plan_features_table.insert(),
        [
            {
                "plan_id": plan_ids["free"],
                "feature_id": feature_ids["vehicle_limit"],
                "enabled": True,
                "limit_value": 1,
                "created_at": created_at,
            },
            {
                "plan_id": plan_ids["free"],
                "feature_id": feature_ids["advanced_history"],
                "enabled": False,
                "limit_value": None,
                "created_at": created_at,
            },
            {
                "plan_id": plan_ids["free"],
                "feature_id": feature_ids["csv_import"],
                "enabled": False,
                "limit_value": None,
                "created_at": created_at,
            },
            {
                "plan_id": plan_ids["free"],
                "feature_id": feature_ids["financial_insights"],
                "enabled": True,
                "limit_value": None,
                "created_at": created_at,
            },
            {
                "plan_id": plan_ids["pro"],
                "feature_id": feature_ids["vehicle_limit"],
                "enabled": True,
                "limit_value": None,
                "created_at": created_at,
            },
            {
                "plan_id": plan_ids["pro"],
                "feature_id": feature_ids["advanced_history"],
                "enabled": True,
                "limit_value": None,
                "created_at": created_at,
            },
            {
                "plan_id": plan_ids["pro"],
                "feature_id": feature_ids["csv_import"],
                "enabled": True,
                "limit_value": None,
                "created_at": created_at,
            },
            {
                "plan_id": plan_ids["pro"],
                "feature_id": feature_ids["financial_insights"],
                "enabled": True,
                "limit_value": None,
                "created_at": created_at,
            },
        ],
    )
    bind.execute(users_table.update().values(current_plan_id=plan_ids["free"]))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("fk_users_current_plan_id_plans", type_="foreignkey")
        batch_op.drop_index(op.f("ix_users_current_plan_id"))
        batch_op.drop_column("current_plan_id")
    op.drop_index(op.f("ix_plan_features_plan_id"), table_name="plan_features")
    op.drop_index(op.f("ix_plan_features_id"), table_name="plan_features")
    op.drop_index(op.f("ix_plan_features_feature_id"), table_name="plan_features")
    op.drop_table("plan_features")
    op.drop_index(op.f("ix_features_id"), table_name="features")
    op.drop_index(op.f("ix_features_code"), table_name="features")
    op.drop_index(op.f("ix_features_active"), table_name="features")
    op.drop_table("features")
    op.drop_index(op.f("ix_plans_id"), table_name="plans")
    op.drop_index(op.f("ix_plans_code"), table_name="plans")
    op.drop_index(op.f("ix_plans_active"), table_name="plans")
    op.drop_table("plans")
