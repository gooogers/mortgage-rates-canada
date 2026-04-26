"""Tests for core data models."""
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from core.models import Lender, LenderType, RatesData, Rate, Term


def test_term_enum_values():
    assert Term.FIVE_YEAR_FIXED.value == "5yr_fixed"
    assert Term.VARIABLE.value == "variable"
    assert Term.HELOC.value == "heloc"


def test_rate_accepts_valid_values():
    rate = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69, discounted=4.19)
    assert rate.posted == 5.69
    assert rate.discounted == 4.19


def test_rate_allows_null_discounted():
    rate = Rate(term=Term.HELOC, posted=7.20, discounted=None)
    assert rate.discounted is None


def test_rate_rejects_negative_posted():
    with pytest.raises(ValidationError):
        Rate(term=Term.FIVE_YEAR_FIXED, posted=-1.0, discounted=None)


def test_lender_minimal():
    lender = Lender(
        slug="rbc",
        name="RBC Royal Bank",
        type=LenderType.BIG6,
        source_url="https://example.com",
        affiliate_url=None,
        scraped_at=datetime(2026, 4, 25, tzinfo=timezone.utc),
        rates=[Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69, discounted=4.19)],
    )
    assert lender.slug == "rbc"
    assert len(lender.rates) == 1


def test_rates_data_serializes_to_spec_shape():
    data = RatesData(
        updated_at=datetime(2026, 4, 25, 10, 0, tzinfo=timezone.utc),
        discount_formula={"fixed": 1.50, "variable": 1.00, "heloc": None},
        lenders=[],
    )
    json_dict = data.model_dump(mode="json")
    assert json_dict["updated_at"] == "2026-04-25T10:00:00Z"
    assert json_dict["discount_formula"]["heloc"] is None
    assert json_dict["lenders"] == []
