"""Per-lender parser tests against captured HTML fixtures.

Adding a lender = add an entry to LENDER_CASES below. Set requires_variable=False
for lenders whose rate page does not publish a variable mortgage rate (e.g.
Servus's `/rates` page only lists fixed-rate products).
"""
from pathlib import Path

import pytest

from core.models import Term
from lenders.alterna import AlternaScraper
from lenders.atb import ATBScraper
from lenders.bmo import BMOScraper
from lenders.cibc import CIBCScraper
from lenders.coast_capital import CoastCapitalScraper
from lenders.meridian import MeridianScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.servus import ServusScraper
from lenders.tangerine import TangerineScraper
from lenders.td import TDScraper
from lenders.vancity import VancityScraper

FIXTURES = Path(__file__).parent / "fixtures"


LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", True, id="rbc"),
    pytest.param(TDScraper, "td.html", True, id="td"),
    pytest.param(NationalScraper, "national.html", True, id="national"),
    pytest.param(BMOScraper, "bmo.html", True, id="bmo"),
    pytest.param(ScotiabankScraper, "scotiabank.html", True, id="scotiabank"),
    pytest.param(CIBCScraper, "cibc.html", True, id="cibc"),
    pytest.param(TangerineScraper, "tangerine.html", True, id="tangerine"),
    pytest.param(MeridianScraper, "meridian.html", True, id="meridian"),
    pytest.param(AlternaScraper, "alterna.html", True, id="alterna"),
    pytest.param(VancityScraper, "vancity.html", True, id="vancity"),
    pytest.param(CoastCapitalScraper, "coast-capital.html", True, id="coast-capital"),
    # Servus's /rates page only publishes fixed-rate mortgage products.
    pytest.param(ServusScraper, "servus.html", False, id="servus"),
    pytest.param(ATBScraper, "atb.html", True, id="atb"),
]


@pytest.mark.parametrize("scraper_cls,fixture_name,requires_variable", LENDER_CASES)
def test_parse_extracts_required_terms(scraper_cls, fixture_name, requires_variable):
    """Every lender publishes 1/3/5-year fixed (and usually variable)."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    terms = {r.term if isinstance(r.term, str) else r.term.value for r in rates}
    required = {
        Term.ONE_YEAR_FIXED.value,
        Term.THREE_YEAR_FIXED.value,
        Term.FIVE_YEAR_FIXED.value,
    }
    if requires_variable:
        required.add(Term.VARIABLE.value)
    missing = required - terms
    assert not missing, f"{scraper_cls.__name__} missing terms: {missing}"


@pytest.mark.parametrize("scraper_cls,fixture_name,requires_variable", LENDER_CASES)
def test_parse_rates_are_in_sane_range(scraper_cls, fixture_name, requires_variable):
    """Posted rates should be in 1%-15%."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    for r in rates:
        assert 1.0 <= r.posted <= 15.0, f"{r.term} posted={r.posted} out of range"


@pytest.mark.parametrize("scraper_cls,fixture_name,requires_variable", LENDER_CASES)
def test_parse_no_duplicate_terms(scraper_cls, fixture_name, requires_variable):
    """Each term appears at most once per lender."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    terms = [r.term if isinstance(r.term, str) else r.term.value for r in rates]
    assert len(terms) == len(set(terms)), f"{scraper_cls.__name__} returned duplicates"
