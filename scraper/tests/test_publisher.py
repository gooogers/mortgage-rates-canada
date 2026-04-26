"""Tests for the JSON publisher."""
import json
from datetime import datetime, timezone
from pathlib import Path

from core.models import LenderType, Rate, RatesData, Term
from core.publisher import load_previous_rates, write_rates_json
from lenders.base import LenderScraper


class FakeLender(LenderScraper):
    slug = "fake"
    name = "Fake"
    type = LenderType.BIG6
    source_url = "https://example.com"
    affiliate_url = None

    def fetch(self) -> str:
        return ""

    def parse(self, html: str) -> list[Rate]:
        return []


def _sample_data() -> RatesData:
    rates = [Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69, discounted=4.19)]
    lender = FakeLender().to_lender(rates)
    return RatesData(
        updated_at=datetime(2026, 4, 25, 10, 0, tzinfo=timezone.utc),
        discount_formula={"fixed": 1.50, "variable": 1.00, "heloc": None},
        lenders=[lender],
    )


def test_write_rates_json_creates_file_with_spec_shape(tmp_path: Path):
    output = tmp_path / "rates.json"
    write_rates_json(_sample_data(), output)
    assert output.exists()
    parsed = json.loads(output.read_text())
    assert parsed["updated_at"] == "2026-04-25T10:00:00Z"
    assert parsed["discount_formula"] == {"fixed": 1.50, "variable": 1.00, "heloc": None}
    assert parsed["lenders"][0]["slug"] == "fake"
    assert parsed["lenders"][0]["rates"][0]["posted"] == 5.69


def test_write_rates_json_creates_parent_dirs(tmp_path: Path):
    output = tmp_path / "data" / "nested" / "rates.json"
    write_rates_json(_sample_data(), output)
    assert output.exists()


def test_load_previous_rates_returns_none_when_missing(tmp_path: Path):
    assert load_previous_rates(tmp_path / "missing.json") is None


def test_load_previous_rates_roundtrips(tmp_path: Path):
    output = tmp_path / "rates.json"
    original = _sample_data()
    write_rates_json(original, output)
    loaded = load_previous_rates(output)
    assert loaded is not None
    assert loaded.lenders[0].slug == "fake"
    assert loaded.lenders[0].rates[0].posted == 5.69
