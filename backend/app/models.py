from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_version: Mapped[int] = mapped_column(Integer(), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    password_reset_tokens: Mapped[list[PasswordResetToken]] = relationship(back_populates="user")
    vehicles: Mapped[list[Vehicle]] = relationship(back_populates="user")
    work_sessions: Mapped[list[WorkSession]] = relationship(back_populates="user")
    expenses: Mapped[list[Expense]] = relationship(back_populates="user")
    recurring_expenses: Mapped[list[RecurringExpense]] = relationship(back_populates="user")
    financial_goals: Mapped[list[FinancialGoal]] = relationship(back_populates="user")
    import_profiles: Mapped[list[CsvImportProfile]] = relationship(back_populates="user")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    user: Mapped[User] = relationship(back_populates="password_reset_tokens")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    brand: Mapped[str] = mapped_column(String(120), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    year: Mapped[int] = mapped_column(nullable=False)
    fuel_type: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    user: Mapped[User] = relationship(back_populates="vehicles")
    work_sessions: Mapped[list[WorkSession]] = relationship(back_populates="vehicle")
    expenses: Mapped[list[Expense]] = relationship(back_populates="vehicle")
    recurring_expenses: Mapped[list[RecurringExpense]] = relationship(back_populates="vehicle")
    financial_goals: Mapped[list[FinancialGoal]] = relationship(back_populates="vehicle")
    import_profiles: Mapped[list[CsvImportProfile]] = relationship(back_populates="vehicle")
    maintenance_plans: Mapped[list[MaintenancePlan]] = relationship(back_populates="vehicle")
    cost_profile: Mapped[VehicleCostProfile | None] = relationship(
        back_populates="vehicle",
        uselist=False,
    )


class VehicleCostProfile(Base):
    __tablename__ = "vehicle_cost_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    ownership_type: Mapped[str] = mapped_column(String(20), nullable=False)
    rental_monthly_cents: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    financing_monthly_cents: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    insurance_monthly_cents: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    ipva_annual_cents: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    other_fixed_monthly_cents: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    maintenance_per_km: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    tires_per_km: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    oil_per_km: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    depreciation_per_km: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    fuel_efficiency_km_per_liter: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    vehicle: Mapped[Vehicle] = relationship(back_populates="cost_profile")

    @staticmethod
    def _cents_to_money(value: int | None) -> Decimal | None:
        if value is None:
            return None

        return Decimal(value) / Decimal("100")

    @property
    def rental_monthly(self) -> Decimal | None:
        return self._cents_to_money(self.rental_monthly_cents)

    @property
    def financing_monthly(self) -> Decimal | None:
        return self._cents_to_money(self.financing_monthly_cents)

    @property
    def insurance_monthly(self) -> Decimal | None:
        return self._cents_to_money(self.insurance_monthly_cents)

    @property
    def ipva_annual(self) -> Decimal | None:
        return self._cents_to_money(self.ipva_annual_cents)

    @property
    def other_fixed_monthly(self) -> Decimal | None:
        return self._cents_to_money(self.other_fixed_monthly_cents)


class WorkSession(Base):
    __tablename__ = "work_sessions"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "import_fingerprint",
            name="uq_work_sessions_user_import_fingerprint",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    work_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    gross_revenue_cents: Mapped[int] = mapped_column(Integer(), nullable=False)
    distance_km: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    worked_minutes: Mapped[int] = mapped_column(nullable=False)
    trip_count: Mapped[int] = mapped_column(nullable=False)
    import_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    user: Mapped[User] = relationship(back_populates="work_sessions")
    vehicle: Mapped[Vehicle] = relationship(back_populates="work_sessions")

    @property
    def gross_revenue(self) -> Decimal:
        return Decimal(self.gross_revenue_cents) / Decimal("100")


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "import_fingerprint",
            name="uq_expenses_user_import_fingerprint",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id"),
        nullable=True,
        index=True,
    )
    expense_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer(), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    import_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    user: Mapped[User] = relationship(back_populates="expenses")
    vehicle: Mapped[Vehicle | None] = relationship(back_populates="expenses")

    @property
    def amount(self) -> Decimal:
        return Decimal(self.amount_cents) / Decimal("100")


class FinancialGoal(Base):
    __tablename__ = "financial_goals"
    __table_args__ = (
        Index(
            "uq_financial_goals_active_vehicle",
            "user_id",
            "goal_type",
            "vehicle_id",
            unique=True,
            postgresql_where=text("active IS TRUE AND vehicle_id IS NOT NULL"),
            sqlite_where=text("active = 1 AND vehicle_id IS NOT NULL"),
        ),
        Index(
            "uq_financial_goals_active_without_vehicle",
            "user_id",
            "goal_type",
            unique=True,
            postgresql_where=text("active IS TRUE AND vehicle_id IS NULL"),
            sqlite_where=text("active = 1 AND vehicle_id IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id"),
        nullable=True,
        index=True,
    )
    goal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_amount_cents: Mapped[int] = mapped_column(Integer(), nullable=False)
    start_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean(), default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    user: Mapped[User] = relationship(back_populates="financial_goals")
    vehicle: Mapped[Vehicle | None] = relationship(back_populates="financial_goals")

    @property
    def target_amount(self) -> Decimal:
        return Decimal(self.target_amount_cents) / Decimal("100")


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id"),
        nullable=True,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer(), nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    start_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    end_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean(), default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    user: Mapped[User] = relationship(back_populates="recurring_expenses")
    vehicle: Mapped[Vehicle | None] = relationship(back_populates="recurring_expenses")

    @property
    def amount(self) -> Decimal:
        return Decimal(self.amount_cents) / Decimal("100")


class CsvImportProfile(Base):
    __tablename__ = "csv_import_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    import_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    header_signature: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    column_mapping: Mapped[dict[str, str]] = mapped_column(JSON(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    user: Mapped[User] = relationship(back_populates="import_profiles")
    vehicle: Mapped[Vehicle | None] = relationship(back_populates="import_profiles")


class MaintenancePlan(Base):
    __tablename__ = "maintenance_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    interval_km: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    interval_days: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    estimated_cost_cents: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean(), default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    vehicle: Mapped[Vehicle] = relationship(back_populates="maintenance_plans")
    records: Mapped[list[MaintenanceRecord]] = relationship(
        back_populates="maintenance_plan",
        cascade="all, delete-orphan",
    )

    @property
    def estimated_cost(self) -> Decimal | None:
        if self.estimated_cost_cents is None:
            return None

        return Decimal(self.estimated_cost_cents) / Decimal("100")


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    maintenance_plan_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_plans.id"),
        nullable=False,
        index=True,
    )
    service_date: Mapped[date] = mapped_column(Date(), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    maintenance_plan: Mapped[MaintenancePlan] = relationship(back_populates="records")
