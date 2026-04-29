"""Pydantic models for the rates data shape (matches spec Section 6)."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class Term(str, Enum):
    ONE_YEAR_FIXED = "1yr_fixed"
    TWO_YEAR_FIXED = "2yr_fixed"
    THREE_YEAR_FIXED = "3yr_fixed"
    FOUR_YEAR_FIXED = "4yr_fixed"
    FIVE_YEAR_FIXED = "5yr_fixed"
    SEVEN_YEAR_FIXED = "7yr_fixed"
    TEN_YEAR_FIXED = "10yr_fixed"
    VARIABLE = "variable"
    HELOC = "heloc"


class LenderType(str, Enum):
    BIG6 = "big6"
    MONOLINE = "monoline"
    CREDIT_UNION = "credit_union"
    OTHER = "other"


# Posted rates are non-negative and reasonably bounded; validator enforces
# tighter sanity limits at run time.
NonNegRate = Annotated[float, Field(ge=0.0, le=25.0)]


class Rate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    term: Term
    posted: NonNegRate
    discounted: NonNegRate | None = None


class Lender(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str
    type: LenderType
    source_url: str
    affiliate_url: str | None = None
    scraped_at: datetime
    rates: list[Rate]

    @field_serializer("scraped_at")
    def _serialize_scraped_at(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class RatesData(BaseModel):
    updated_at: datetime
    lenders: list[Lender]

    @field_serializer("updated_at")
    def _serialize_updated_at(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
