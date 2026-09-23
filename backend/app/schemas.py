from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, field_validator

FuelType = Literal["gasoline", "ethanol", "flex", "diesel", "electric", "hybrid", "other"]
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


class WorkSessionPublic(WorkSessionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("gross_revenue")
    def serialize_gross_revenue(self, value: Decimal) -> str:
        return f"{value:.2f}"


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
