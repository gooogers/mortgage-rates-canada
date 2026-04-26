"""Tests for LenderScraper abstract base class."""
import pytest

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper


class FakeLender(LenderScraper):
    slug = "fake"
    name = "Fake Bank"
    type = LenderType.BIG6
    source_url = "https://example.com/rates"
    affiliate_url = None

    def fetch(self) -> str:
        return "<html><body>5.69%</body></html>"

    def parse(self, html: str) -> list[Rate]:
        return [Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)]


def test_subclass_must_implement_fetch_and_parse():
    """Cannot instantiate without fetch and parse."""
    with pytest.raises(TypeError):

        class Incomplete(LenderScraper):
            slug = "x"
            name = "X"
            type = LenderType.BIG6
            source_url = "https://example.com"
            affiliate_url = None

        Incomplete()


def test_concrete_subclass_works():
    lender = FakeLender()
    html = lender.fetch()
    rates = lender.parse(html)
    assert len(rates) == 1
    assert rates[0].posted == 5.69


def test_to_lender_assembles_lender_object():
    """to_lender(rates) wraps parsed rates in a Lender model with metadata."""
    fake = FakeLender()
    rates = [Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)]
    lender = fake.to_lender(rates)
    assert lender.slug == "fake"
    assert lender.name == "Fake Bank"
    assert lender.type == LenderType.BIG6.value
    assert lender.source_url == "https://example.com/rates"
    assert lender.affiliate_url is None
    assert lender.rates == rates
    # scraped_at is set to "now"; just check it's populated
    assert lender.scraped_at is not None
