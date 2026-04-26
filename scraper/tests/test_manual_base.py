"""Tests for the manual-source LenderScraper variant."""
from datetime import datetime, timezone
from pathlib import Path

import pytest

from core.models import LenderType, Rate, Term
from lenders.manual_base import (
    ManualFixtureMissingError,
    ManualLenderScraper,
)


class FakeManualLender(ManualLenderScraper):
    slug = "fake-manual"
    name = "Fake Manual Lender"
    type = LenderType.BIG6
    source_url = "https://example.com/rates"
    affiliate_url = None

    def parse(self, html: str) -> list[Rate]:
        return [Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)]


def test_fetch_reads_from_manual_fixture(tmp_path: Path):
    fixture_path = tmp_path / "fake-manual.html"
    fixture_path.write_text("<html>5.69%</html>")
    lender = FakeManualLender(manual_dir=tmp_path)
    assert lender.fetch() == "<html>5.69%</html>"


def test_fetch_raises_when_fixture_missing(tmp_path: Path):
    lender = FakeManualLender(manual_dir=tmp_path)
    with pytest.raises(ManualFixtureMissingError, match="fake-manual"):
        lender.fetch()


def test_fixture_path_property(tmp_path: Path):
    lender = FakeManualLender(manual_dir=tmp_path)
    assert lender.fixture_path == tmp_path / "fake-manual.html"


def test_fixture_age_days_returns_none_when_missing(tmp_path: Path):
    lender = FakeManualLender(manual_dir=tmp_path)
    assert lender.fixture_age_days() is None


def test_fixture_age_days_when_present(tmp_path: Path):
    fixture_path = tmp_path / "fake-manual.html"
    fixture_path.write_text("x")
    lender = FakeManualLender(manual_dir=tmp_path)
    age = lender.fixture_age_days()
    assert age is not None
    assert 0 <= age < 1  # just-created file


def test_default_manual_dir_is_data_manual_under_repo(tmp_path: Path, monkeypatch):
    """When manual_dir is not provided, defaults to <scraper-root>/data/manual."""
    lender = FakeManualLender()
    # The default path string must end with data/manual
    assert lender.manual_dir.parts[-2:] == ("data", "manual")
