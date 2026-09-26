from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

FuelType = Literal["gasoline", "ethanol", "flex", "diesel", "electric", "hybrid", "other"]
OwnershipType = Literal["owned", "financed", "rented"]
RecurringExpenseFrequency = Literal["weekly", "monthly", "yearly"]
FinancialGoalType = Literal["net", "projected"]
FinancialInsightType = Literal["info", "positive", "attention"]
PlanCode = Literal["free", "pro"]
CsvImportType = Literal["work_sessions", "expenses"]
FinancialHistoryGrouping = Literal["daily", "weekly", "monthly"]
FinancialHistoryTrendDirection = Literal["increased", "decreased", "unchanged"]
WorkPatternSampleClassification = Literal["insufficient", "limited", "usable"]
WorkPatternObservationType = Literal[
    "highest_estimated_result_per_hour_weekday",
    "highest_estimated_result_per_km_weekday",
    "highest_average_estimated_result_per_active_day",
    "highest_expense_burden_weekday",
    "most_frequently_worked_weekday",
]
MaintenanceCategory = Literal[
    "oil",
    "tires",
    "brakes",
    "filters",
    "alignment",
    "battery",
    "inspection",
    "transmission",
    "cooling",
    "other",
]
MaintenanceStatusType = Literal["ok", "due_soon", "due"]
ExpenseCategory = Literal[
    "fuel",
    "charging",
    "maintenance",
    "parking",
    "toll",
    "insurance",
    "rental",
    "financing",
    "washing",
    "other",
]


class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str


class AccountPlanPublic(BaseModel):
    id: int
    name: str
    code: PlanCode


class AccountPlanResponse(BaseModel):
    current_plan: AccountPlanPublic
    features: dict[str, bool]
    limits: dict[str, int]


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class PasswordForgotRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class PasswordResetRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    new_password: str = Field(min_length=6, max_length=128)


class VehicleBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    brand: str = Field(min_length=1, max_length=120)
    model: str = Field(min_length=1, max_length=120)
    year: int = Field(ge=1900, le=2100)
    fuel_type: FuelType

    model_config = ConfigDict(extra="forbid")

    @field_validator("name", "brand", "model")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field is required.")
        return normalized


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(VehicleBase):
    pass


class VehiclePublic(VehicleBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaintenancePlanBase(BaseModel):
    vehicle_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=120)
    category: MaintenanceCategory
    interval_km: Decimal | None = Field(default=None, gt=Decimal("0"))
    interval_days: int | None = Field(default=None, gt=0)
    estimated_cost: Decimal | None = Field(default=None, ge=Decimal("0"))
    active: bool = True

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field is required.")
        return normalized

    @model_validator(mode="after")
    def validate_interval(self) -> "MaintenancePlanBase":
        if self.interval_km is None and self.interval_days is None:
            raise ValueError("At least one maintenance interval is required.")

        return self


class MaintenancePlanCreate(MaintenancePlanBase):
    pass


class MaintenancePlanUpdate(MaintenancePlanBase):
    pass


class MaintenancePlanPublic(MaintenancePlanBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("interval_km")
    def serialize_interval_km(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"

    @field_serializer("estimated_cost")
    def serialize_estimated_cost(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class MaintenanceRecordCreate(BaseModel):
    service_date: date
    notes: str | None = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")

    @field_validator("service_date")
    @classmethod
    def validate_service_date(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("service_date cannot be in the future.")

        return value

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class MaintenanceRecordPublic(MaintenanceRecordCreate):
    id: int
    maintenance_plan_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaintenancePlanStatus(BaseModel):
    status: MaintenanceStatusType
    km_since_last_service: Decimal | None
    km_remaining: Decimal | None
    days_since_last_service: int | None
    days_remaining: int | None
    estimated_cost: Decimal | None
    recommended_reserve_per_km: Decimal | None

    @field_serializer("km_since_last_service", "km_remaining")
    def serialize_distance(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"

    @field_serializer("estimated_cost")
    def serialize_status_money(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"

    @field_serializer("recommended_reserve_per_km")
    def serialize_reserve_per_km(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.4f}"


class VehicleCostProfileBase(BaseModel):
    ownership_type: OwnershipType
    rental_monthly: Decimal | None = Field(default=None, ge=Decimal("0"))
    financing_monthly: Decimal | None = Field(default=None, ge=Decimal("0"))
    insurance_monthly: Decimal | None = Field(default=None, ge=Decimal("0"))
    ipva_annual: Decimal | None = Field(default=None, ge=Decimal("0"))
    other_fixed_monthly: Decimal | None = Field(default=None, ge=Decimal("0"))
    maintenance_per_km: Decimal | None = Field(default=None, ge=Decimal("0"))
    tires_per_km: Decimal | None = Field(default=None, ge=Decimal("0"))
    oil_per_km: Decimal | None = Field(default=None, ge=Decimal("0"))
    depreciation_per_km: Decimal | None = Field(default=None, ge=Decimal("0"))
    fuel_efficiency_km_per_liter: Decimal | None = Field(default=None, ge=Decimal("0"))

    model_config = ConfigDict(extra="forbid")


class VehicleCostProfileUpdate(VehicleCostProfileBase):
    pass


class VehicleCostProfilePublic(VehicleCostProfileBase):
    id: int
    vehicle_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer(
        "rental_monthly",
        "financing_monthly",
        "insurance_monthly",
        "ipva_annual",
        "other_fixed_monthly",
    )
    def serialize_money(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"

    @field_serializer(
        "maintenance_per_km",
        "tires_per_km",
        "oil_per_km",
        "depreciation_per_km",
    )
    def serialize_per_km(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.4f}"

    @field_serializer("fuel_efficiency_km_per_liter")
    def serialize_fuel_efficiency(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class WorkSessionBase(BaseModel):
    vehicle_id: int = Field(gt=0)
    work_date: date
    gross_revenue: Decimal = Field(ge=Decimal("0"))
    distance_km: Decimal = Field(ge=Decimal("0"))
    worked_minutes: int = Field(gt=0)
    trip_count: int = Field(ge=0)

    model_config = ConfigDict(extra="forbid")


class WorkSessionCreate(WorkSessionBase):
    pass


class WorkSessionUpdate(WorkSessionBase):
    pass


class QuickStartDayCreate(WorkSessionBase):
    expense_amount: Decimal | None = Field(default=None, gt=Decimal("0"))
    expense_category: Literal["fuel", "charging"] = "fuel"


class WorkSessionPublic(WorkSessionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("gross_revenue")
    def serialize_gross_revenue(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WorkSessionImportRow(BaseModel):
    row: int
    date: date
    gross_revenue: Decimal
    distance_km: Decimal
    worked_minutes: int
    trip_count: int

    @field_serializer("gross_revenue")
    def serialize_gross_revenue(self, value: Decimal) -> str:
        return f"{value:.2f}"

    @field_serializer("distance_km")
    def serialize_distance_km(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WorkSessionImportError(BaseModel):
    row: int
    field: str
    message: str


class WorkSessionImportPreview(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    columns_found: list[str] = Field(default_factory=list)
    suggested_mapping: dict[str, str] = Field(default_factory=dict)
    column_mapping: dict[str, str] = Field(default_factory=dict)
    rows: list[WorkSessionImportRow]
    errors: list[WorkSessionImportError]


class WorkSessionImportResult(BaseModel):
    imported: int
    duplicates_skipped: int
    failed: int
    errors: list[WorkSessionImportError] = Field(default_factory=list)


class ExpenseImportRow(BaseModel):
    row: int
    expense_date: date
    amount: Decimal
    category: ExpenseCategory
    description: str | None

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class ExpenseImportPreview(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    columns_found: list[str] = Field(default_factory=list)
    suggested_mapping: dict[str, str] = Field(default_factory=dict)
    column_mapping: dict[str, str] = Field(default_factory=dict)
    rows: list[ExpenseImportRow]
    errors: list[WorkSessionImportError]


class ExpenseImportResult(BaseModel):
    imported: int
    duplicates_skipped: int
    failed: int
    errors: list[WorkSessionImportError] = Field(default_factory=list)


class CsvImportProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    import_type: CsvImportType
    headers: list[str] = Field(min_length=1)
    column_mapping: dict[str, str] = Field(min_length=1)
    vehicle_id: int | None = Field(default=None, gt=0)

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Field is required.")
        return normalized


class CsvImportProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    import_type: CsvImportType | None = None
    headers: list[str] | None = Field(default=None, min_length=1)
    column_mapping: dict[str, str] | None = Field(default=None, min_length=1)
    vehicle_id: int | None = Field(default=None, gt=0)

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        if not normalized:
            raise ValueError("Field is required.")
        return normalized


class CsvImportProfilePublic(BaseModel):
    id: int
    name: str
    import_type: CsvImportType
    header_signature: str
    column_mapping: dict[str, str]
    vehicle_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CsvImportProfileMatchRequest(BaseModel):
    import_type: CsvImportType
    headers: list[str] = Field(min_length=1)

    model_config = ConfigDict(extra="forbid")


class CsvImportProfileMatchResponse(BaseModel):
    profile: CsvImportProfilePublic | None
    column_mapping: dict[str, str] | None = None
    vehicle_id: int | None = None


class ExpenseBase(BaseModel):
    vehicle_id: int | None = Field(default=None, gt=0)
    expense_date: date
    category: ExpenseCategory
    amount: Decimal = Field(gt=Decimal("0"))
    description: str | None = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(ExpenseBase):
    pass


class ExpensePublic(ExpenseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class RecurringExpenseBase(BaseModel):
    vehicle_id: int | None = Field(default=None, gt=0)
    category: ExpenseCategory
    amount: Decimal = Field(gt=Decimal("0"))
    frequency: RecurringExpenseFrequency
    start_date: date
    end_date: date | None = None
    description: str | None = Field(default=None, max_length=255)
    active: bool = True

    model_config = ConfigDict(extra="forbid")

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_date_range(self) -> "RecurringExpenseBase":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")

        return self


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseUpdate(RecurringExpenseBase):
    pass


class RecurringExpensePublic(RecurringExpenseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class FinancialGoalBase(BaseModel):
    vehicle_id: int | None = Field(default=None, gt=0)
    goal_type: FinancialGoalType
    target_amount: Decimal = Field(gt=Decimal("0"))
    start_date: date
    end_date: date
    active: bool = True

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_date_range(self) -> "FinancialGoalBase":
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date.")

        return self


class FinancialGoalCreate(FinancialGoalBase):
    pass


class FinancialGoalUpdate(FinancialGoalBase):
    pass


class FinancialGoalPublic(FinancialGoalBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("target_amount")
    def serialize_target_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class FinancialGoalProgress(BaseModel):
    target_amount: Decimal
    current_amount: Decimal
    remaining_amount: Decimal
    progress_percentage: Decimal
    days_total: int
    days_elapsed: int
    days_remaining: int
    required_daily_amount: Decimal
    projected_completion_amount: Decimal
    on_track: bool
    average_net_per_hour: Decimal | None = None
    average_projected_per_hour: Decimal | None = None
    estimated_hours_remaining: Decimal | None = None

    @field_serializer(
        "target_amount",
        "current_amount",
        "remaining_amount",
        "progress_percentage",
        "required_daily_amount",
        "projected_completion_amount",
        "average_net_per_hour",
        "average_projected_per_hour",
        "estimated_hours_remaining",
    )
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class FinancialInsight(BaseModel):
    code: str
    type: FinancialInsightType
    title: str
    message: str


class FinancialInsightsResponse(BaseModel):
    insights: list[FinancialInsight]


class FinancialDailySummary(BaseModel):
    date: date
    gross_revenue: Decimal
    expenses: Decimal
    estimated_net_profit: Decimal

    @field_serializer("gross_revenue", "expenses", "estimated_net_profit")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class FinancialStructuralCosts(BaseModel):
    ownership: Decimal
    insurance: Decimal
    ipva: Decimal
    other_fixed: Decimal
    maintenance: Decimal
    tires: Decimal
    oil: Decimal
    depreciation: Decimal

    @field_serializer(
        "ownership",
        "insurance",
        "ipva",
        "other_fixed",
        "maintenance",
        "tires",
        "oil",
        "depreciation",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class FinancialRecurringExpenseBreakdown(BaseModel):
    category: str
    amount: Decimal

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class FinancialSummary(BaseModel):
    gross_revenue: Decimal
    total_expenses: Decimal
    estimated_net_profit: Decimal
    estimated_structural_costs: Decimal
    estimated_economic_costs: Decimal
    estimated_economic_result: Decimal
    recurring_expenses_total: Decimal
    recurring_expenses_breakdown: list[FinancialRecurringExpenseBreakdown]
    projected_economic_costs: Decimal
    projected_economic_result: Decimal
    structural_costs: FinancialStructuralCosts
    total_distance_km: Decimal
    total_worked_minutes: int
    total_trip_count: int
    gross_per_hour: Decimal | None
    net_per_hour: Decimal | None
    gross_per_km: Decimal | None
    net_per_km: Decimal | None
    expense_per_km: Decimal | None
    average_ticket: Decimal | None
    daily: list[FinancialDailySummary]

    @field_serializer(
        "gross_revenue",
        "total_expenses",
        "estimated_net_profit",
        "estimated_structural_costs",
        "estimated_economic_costs",
        "estimated_economic_result",
        "recurring_expenses_total",
        "projected_economic_costs",
        "projected_economic_result",
        "total_distance_km",
        "gross_per_hour",
        "net_per_hour",
        "gross_per_km",
        "net_per_km",
        "expense_per_km",
        "average_ticket",
    )
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class FinancialHistoryPeriod(BaseModel):
    period_start: date
    period_end: date
    gross_revenue: Decimal
    registered_expenses: Decimal
    estimated_structural_costs: Decimal
    recurring_projected_expenses: Decimal
    cash_remaining: Decimal
    estimated_result: Decimal
    projected_result: Decimal
    worked_minutes: int
    distance_km: Decimal
    trip_count: int
    revenue_per_hour: Decimal | None
    estimated_result_per_hour: Decimal | None
    revenue_per_km: Decimal | None
    estimated_result_per_km: Decimal | None

    @field_serializer(
        "gross_revenue",
        "registered_expenses",
        "estimated_structural_costs",
        "recurring_projected_expenses",
        "cash_remaining",
        "estimated_result",
        "projected_result",
        "distance_km",
        "revenue_per_hour",
        "estimated_result_per_hour",
        "revenue_per_km",
        "estimated_result_per_km",
    )
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class FinancialHistoryMetricComparison(BaseModel):
    current: Decimal | None
    previous: Decimal | None
    absolute_delta: Decimal | None
    percentage_delta: Decimal | None

    @field_serializer("current", "previous", "absolute_delta", "percentage_delta")
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class FinancialHistoryComparison(BaseModel):
    current_period_start: date
    current_period_end: date
    previous_period_start: date
    previous_period_end: date
    gross_revenue: FinancialHistoryMetricComparison
    registered_expenses: FinancialHistoryMetricComparison
    estimated_result: FinancialHistoryMetricComparison
    projected_result: FinancialHistoryMetricComparison
    worked_minutes: FinancialHistoryMetricComparison
    distance_km: FinancialHistoryMetricComparison
    estimated_result_per_hour: FinancialHistoryMetricComparison
    estimated_result_per_km: FinancialHistoryMetricComparison


class FinancialHistoryTrendFact(BaseModel):
    metric: str
    direction: FinancialHistoryTrendDirection
    current: Decimal
    previous: Decimal
    absolute_delta: Decimal
    percentage_delta: Decimal | None

    @field_serializer("current", "previous", "absolute_delta", "percentage_delta")
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class FinancialHistoryResponse(BaseModel):
    start_date: date
    end_date: date
    vehicle_id: int | None
    grouping: FinancialHistoryGrouping
    periods: list[FinancialHistoryPeriod]
    comparison: FinancialHistoryComparison
    trend_facts: list[FinancialHistoryTrendFact]


class WorkPatternOverallSummary(BaseModel):
    active_days: int
    total_worked_minutes: int
    total_distance_km: Decimal
    total_trip_count: int
    gross_revenue: Decimal
    registered_expenses: Decimal
    estimated_result: Decimal
    estimated_result_per_hour: Decimal | None
    estimated_result_per_km: Decimal | None

    @field_serializer(
        "total_distance_km",
        "gross_revenue",
        "registered_expenses",
        "estimated_result",
        "estimated_result_per_hour",
        "estimated_result_per_km",
    )
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"


class WorkPatternWeekdayPerformance(BaseModel):
    weekday: str
    active_days: int
    sample_classification: WorkPatternSampleClassification
    total_worked_minutes: int
    total_distance_km: Decimal
    total_trip_count: int
    gross_revenue: Decimal
    registered_expenses: Decimal
    estimated_result: Decimal
    average_gross_revenue_per_active_day: Decimal | None
    average_estimated_result_per_active_day: Decimal | None
    gross_revenue_per_hour: Decimal | None
    estimated_result_per_hour: Decimal | None
    gross_revenue_per_km: Decimal | None
    estimated_result_per_km: Decimal | None
    expense_ratio: Decimal | None

    @field_serializer(
        "total_distance_km",
        "gross_revenue",
        "registered_expenses",
        "estimated_result",
        "average_gross_revenue_per_active_day",
        "average_estimated_result_per_active_day",
        "gross_revenue_per_hour",
        "estimated_result_per_hour",
        "gross_revenue_per_km",
        "estimated_result_per_km",
    )
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.2f}"

    @field_serializer("expense_ratio")
    def serialize_ratio(self, value: Decimal | None) -> str | None:
        if value is None:
            return None

        return f"{value:.4f}"


class WorkPatternObservation(BaseModel):
    type: WorkPatternObservationType
    metric: str
    weekday: str
    value: Decimal
    message: str

    @field_serializer("value")
    def serialize_value(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WorkPatternsResponse(BaseModel):
    start_date: date
    end_date: date
    vehicle_id: int | None
    overall: WorkPatternOverallSummary
    weekdays: list[WorkPatternWeekdayPerformance]
    observations: list[WorkPatternObservation]
