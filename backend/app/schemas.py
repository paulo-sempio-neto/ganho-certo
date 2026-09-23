from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

FuelType = Literal["gasoline", "ethanol", "flex", "diesel", "electric", "hybrid", "other"]


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
