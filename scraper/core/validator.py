"""Sanity checks on scraped rates per spec Section 7 ("Reliability safeguards")."""
from __future__ import annotations

from core.models import Rate

MIN_RATE = 0.01
MAX_RATE = 15.0
MAX_DELTA = 2.0  # max allowed change vs previous run, in percentage points


class RateValidationError(ValueError):
    """Raised when a rate fails sanity validation."""


def validate_rate(rate: Rate) -> None:
    """A single rate must be within sane absolute bounds."""
    if not (MIN_RATE <= rate.posted <= MAX_RATE):
        raise RateValidationError(
            f"{rate.term} posted={rate.posted}% out of range "
            f"[{MIN_RATE}, {MAX_RATE}]"
        )


def validate_rates_set(rates: list[Rate]) -> None:
    """A set of rates from one lender must be non-empty and have unique terms."""
    if not rates:
        raise RateValidationError("rates set is empty")
    terms_seen = set()
    for rate in rates:
        validate_rate(rate)
        term_value = rate.term if isinstance(rate.term, str) else rate.term.value
        if term_value in terms_seen:
            raise RateValidationError(f"duplicate term: {term_value}")
        terms_seen.add(term_value)


def validate_against_previous(new: Rate, previous: Rate | None) -> None:
    """A new rate must not jump more than MAX_DELTA from the previous run."""
    if previous is None:
        return
    delta = abs(new.posted - previous.posted)
    if delta > MAX_DELTA:
        raise RateValidationError(
            f"{new.term} changed by {delta:.2f}% "
            f"(prev={previous.posted}, new={new.posted}, max={MAX_DELTA})"
        )
