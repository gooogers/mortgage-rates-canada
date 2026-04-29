"""Tests for the orchestration runner."""
from datetime import datetime, timezone

from core.models import LenderType, Rate, RatesData, Term
from core.runner import build_rates_data
from lenders.base import LenderScraper


class StubLender(LenderScraper):
    slug = "stub"
    name = "Stub Lender"
    type = LenderType.BIG6
    source_url = "https://example.com"
    affiliate_url = None

    def fetch(self) -> str:
        return "<html/>"

    def parse(self, html: str) -> list[Rate]:
        return [
            Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69, discounted=4.19),
            Rate(term=Term.VARIABLE, posted=6.20, discounted=5.20),
        ]


class FailingLender(LenderScraper):
    slug = "failing"
    name = "Failing Lender"
    type = LenderType.BIG6
    source_url = "https://example.com"
    affiliate_url = None

    def fetch(self) -> str:
        raise RuntimeError("network down")

    def parse(self, html: str) -> list[Rate]:
        raise NotImplementedError


def test_build_rates_data_assembles_lenders():
    data = build_rates_data([StubLender()])
    assert isinstance(data, RatesData)
    assert len(data.lenders) == 1
    rates = data.lenders[0].rates
    fixed = next(
        r for r in rates
        if (r.term if isinstance(r.term, str) else r.term.value) == "5yr_fixed"
    )
    assert fixed.discounted == 4.19
    var = next(
        r for r in rates
        if (r.term if isinstance(r.term, str) else r.term.value) == "variable"
    )
    assert var.discounted == 5.20


def test_build_rates_data_skips_failed_lenders_with_no_previous():
    data = build_rates_data([StubLender(), FailingLender()])
    slugs = [lender.slug for lender in data.lenders]
    assert slugs == ["stub"]


def test_build_rates_data_retains_previous_for_failed_lender():
    previous = RatesData(
        updated_at=datetime(2026, 4, 24, tzinfo=timezone.utc),
        lenders=[
            StubLender().to_lender([
                Rate(term=Term.FIVE_YEAR_FIXED, posted=5.50, discounted=4.00),
            ]),
            FailingLender().to_lender([
                Rate(term=Term.FIVE_YEAR_FIXED, posted=5.99, discounted=4.49),
            ]),
        ],
    )
    data = build_rates_data(
        [StubLender(), FailingLender()],
        previous=previous,
    )
    slugs = sorted(l.slug for l in data.lenders)
    assert slugs == ["failing", "stub"]
    failing = next(l for l in data.lenders if l.slug == "failing")
    assert failing.rates[0].posted == 5.99


def test_build_rates_data_sets_updated_at():
    before = datetime.now(timezone.utc)
    data = build_rates_data([StubLender()])
    after = datetime.now(timezone.utc)
    if isinstance(data.updated_at, str):
        parsed = datetime.fromisoformat(data.updated_at.replace("Z", "+00:00"))
    else:
        parsed = data.updated_at
    assert before.replace(microsecond=0) <= parsed <= after.replace(microsecond=0) + datetime.now().resolution
