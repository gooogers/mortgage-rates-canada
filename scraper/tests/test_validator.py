"""Tests for rate validation."""
import pytest

from core.models import Rate, Term
from core.validator import (
    RateValidationError,
    validate_against_previous,
    validate_rate,
    validate_rates_set,
)


def test_validate_rate_accepts_normal_value():
    validate_rate(Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69))


def test_validate_rate_rejects_zero():
    with pytest.raises(RateValidationError, match="out of range"):
        validate_rate(Rate(term=Term.FIVE_YEAR_FIXED, posted=0.0))


def test_validate_rate_rejects_excessive():
    with pytest.raises(RateValidationError, match="out of range"):
        validate_rate(Rate(term=Term.FIVE_YEAR_FIXED, posted=20.0))


def test_validate_rates_set_requires_at_least_one_rate():
    with pytest.raises(RateValidationError, match="empty"):
        validate_rates_set([])


def test_validate_rates_set_rejects_duplicate_terms():
    rates = [
        Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69),
        Rate(term=Term.FIVE_YEAR_FIXED, posted=5.70),
    ]
    with pytest.raises(RateValidationError, match="duplicate"):
        validate_rates_set(rates)


def test_validate_against_previous_allows_small_change():
    prev = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)
    new = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.74)  # +0.05
    validate_against_previous(new, prev)


def test_validate_against_previous_rejects_huge_jump():
    prev = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)
    new = Rate(term=Term.FIVE_YEAR_FIXED, posted=8.50)  # +2.81 too big
    with pytest.raises(RateValidationError, match="changed"):
        validate_against_previous(new, prev)


def test_validate_against_previous_no_op_when_no_prev():
    new = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)
    validate_against_previous(new, None)
