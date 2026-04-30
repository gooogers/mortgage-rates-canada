"""Meridian Credit Union (Ontario) posted mortgage rates scraper.

Meridian's rate page renders three relevant tables (in document order):

    1. "Special offers"  — discounted fixed rates. Rows include both standard
       and "High Ratio" (insured) variants. We only use the standard rows.
    2. "Posted rates"    — fixed posted rates. Rows include "N-Year Closed",
       "N-Year Open", and "6-Month Convertible". We only use Closed rows.
    3. (Untitled variable table) — variable rates. First row is "5-Year Closed"
       which we treat as the posted variable rate. The "5-Year Closed High
       Ratio" row is insured-only and the "5-Year Open" row is open-term;
       both are skipped.

Rate cells look like "4.79%" or "3.89% (Prime - 0.56%)" — we extract the
first decimal in the cell.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

from core.models import LenderType, Rate, Term
from lenders._playwright import render_page
from lenders.base import LenderScraper

# Map term labels (lowercased, normalized) to Term enum. Keys are matched as
# substrings of the row label; "high ratio" is filtered upstream.
TERM_LABEL_MAP: list[tuple[str, Term]] = [
    ("10-year", Term.TEN_YEAR_FIXED),  # match before "1-year"
    ("7-year",  Term.SEVEN_YEAR_FIXED),
    ("5-year",  Term.FIVE_YEAR_FIXED),
    ("4-year",  Term.FOUR_YEAR_FIXED),
    ("3-year",  Term.THREE_YEAR_FIXED),
    ("2-year",  Term.TWO_YEAR_FIXED),
    ("1-year",  Term.ONE_YEAR_FIXED),
]

_RATE_RE = re.compile(r"\b([1-9]\.\d{2,3})\b")


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _extract_rate(text: str) -> float | None:
    m = _RATE_RE.search(text)
    if not m:
        return None
    try:
        v = float(m.group(1))
    except ValueError:
        return None
    return v if 1.0 <= v <= 15.0 else None


def _classify_label(label: str) -> Term | None:
    """Match a fixed-term label to a Term, skipping open/convertible/high-ratio rows."""
    norm = _normalize(label)
    if "open" in norm or "convertible" in norm or "high ratio" in norm:
        return None
    for needle, term in TERM_LABEL_MAP:
        if needle in norm:
            return term
    return None


def _find_table_by_header(soup: BeautifulSoup, header_text: str) -> Tag | None:
    """Return the first table whose first <th> text contains `header_text`."""
    target = header_text.lower()
    for table in soup.find_all("table"):
        first_th = table.find("th")
        if first_th and target in first_th.get_text(" ", strip=True).lower():
            return table
    return None


class MeridianScraper(LenderScraper):
    slug = "meridian"
    name = "Meridian Credit Union"
    type = LenderType.CREDIT_UNION
    source_url = "https://www.meridiancu.ca/personal/rates-and-fees/mortgage-and-borrowing-rates"
    affiliate_url = None
    provinces = ["ON"]

    # Rates are rendered into <table> elements after JS init.
    WAIT_FOR_SELECTOR = "table"
    RENDER_TIMEOUT_MS = 60_000

    def fetch(self) -> str:
        return render_page(
            self.source_url,
            wait_for_selector=self.WAIT_FOR_SELECTOR,
            timeout_ms=self.RENDER_TIMEOUT_MS,
        )

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")

        posted_by_term: dict[str, float] = {}
        discounted_by_term: dict[str, float] = {}

        # Posted fixed rates (Closed terms only).
        posted_tbl = _find_table_by_header(soup, "Posted rates")
        if posted_tbl is not None:
            for row in posted_tbl.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if len(cells) < 2:
                    continue
                label = cells[0].get_text(" ", strip=True)
                if "closed" not in label.lower():
                    continue
                term = _classify_label(label)
                if term is None:
                    continue
                rate = _extract_rate(cells[1].get_text(" ", strip=True))
                if rate is not None:
                    posted_by_term.setdefault(term.value, rate)

        # Special offers → discounted fixed rates (skip High Ratio).
        special_tbl = _find_table_by_header(soup, "Special offers")
        if special_tbl is not None:
            for row in special_tbl.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if len(cells) < 2:
                    continue
                label = cells[0].get_text(" ", strip=True)
                term = _classify_label(label)
                if term is None:
                    continue
                rate = _extract_rate(cells[1].get_text(" ", strip=True))
                if rate is not None:
                    discounted_by_term.setdefault(term.value, rate)

        # Variable rate: find the conventional 5yr variable row. Variable rate
        # cells contain "(Prime ± spread)", which disambiguates them from the
        # special-offers table where the same label "5-Year Closed" appears.
        variable_rate: float | None = None
        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            label = cells[0].get_text(" ", strip=True).lower()
            if "5-year closed" not in label:
                continue
            if "open" in label or "high ratio" in label:
                continue
            rate_cell = cells[1].get_text(" ", strip=True)
            if "prime" not in rate_cell.lower():
                continue
            variable_rate = _extract_rate(rate_cell)
            if variable_rate is not None:
                break

        rates: list[Rate] = []
        for term in (
            Term.ONE_YEAR_FIXED,
            Term.TWO_YEAR_FIXED,
            Term.THREE_YEAR_FIXED,
            Term.FOUR_YEAR_FIXED,
            Term.FIVE_YEAR_FIXED,
            Term.SEVEN_YEAR_FIXED,
            Term.TEN_YEAR_FIXED,
        ):
            posted = posted_by_term.get(term.value)
            if posted is None:
                continue
            rates.append(Rate(
                term=term,
                posted=posted,
                discounted=discounted_by_term.get(term.value),
            ))

        if variable_rate is not None:
            rates.append(Rate(term=Term.VARIABLE, posted=variable_rate))

        return rates
