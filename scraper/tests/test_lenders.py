"""Per-lender parser tests against captured HTML fixtures.

Adding a lender = add an entry to LENDER_CASES below.
"""
from pathlib import Path

import pytest

from core.models import Term
from lenders.bmo import BMOScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.td import TDScraper

FIXTURES = Path(__file__).parent / "fixtures"


LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(ScotiabankScraper, "scotiabank.html", id="scotiabank"),
]


@pytest.mark.parametrize("scraper_cls,fixture_name", LENDER_CASES)
def test_parse_extracts_required_terms(scraper_cls, fixture_name):
    """Every Big 6 lender publishes 1/3/5-year fixed and a variable rate."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    terms = {r.term if isinstance(r.term, str) else r.term.value for r in rates}
    required = {
        Term.ONE_YEAR_FIXED.value,
        Term.THREE_YEAR_FIXED.value,
        Term.FIVE_YEAR_FIXED.value,
        Term.VARIABLE.value,
    }
    missing = required - terms
    assert not missing, f"{scraper_cls.__name__} missing terms: {missing}"


@pytest.mark.parametrize("scraper_cls,fixture_name", LENDER_CASES)
def test_parse_rates_are_in_sane_range(scraper_cls, fixture_name):
    """Posted rates should be in 1%-15%."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    for r in rates:
        assert 1.0 <= r.posted <= 15.0, f"{r.term} posted={r.posted} out of range"


@pytest.mark.parametrize("scraper_cls,fixture_name", LENDER_CASES)
def test_parse_no_duplicate_terms(scraper_cls, fixture_name):
    """Each term appears at most once per lender."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    terms = [r.term if isinstance(r.term, str) else r.term.value for r in rates]
    assert len(terms) == len(set(terms)), f"{scraper_cls.__name__} returned duplicates"
