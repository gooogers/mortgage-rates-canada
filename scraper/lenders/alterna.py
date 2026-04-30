"""Alterna Savings (Ontario) posted mortgage rates scraper.

Alterna's rate page renders multiple two-column tables. Each table's first
row is a header `[<section title>, <column heading>]`. The relevant tables:

    Section title                        | Column heading | Meaning
    -------------------------------------+----------------+----------
    Fixed Rate Mortgages - Closed ...    | Rates          | Discounted fixed
    Fixed Rate Mortgages - Closed ...    | Posted Rates   | Posted fixed
    Variable Rate Mortgages - Closed ... | Rates          | Variable

Rows in those tables look like ['1-Year Fixed Closed 2', '5.69% APR: 5.87%'].
Rows for Open / 6-Month terms are present but skipped.

The Variable table has no "Posted Rates" sibling — the posted variable is
just the listed rate.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

from core.models import LenderType, Rate, Term
from lenders._playwright import render_page
from lenders.base import LenderScraper

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
# Alterna sometimes inserts a stray space in rate cells (e.g. "6 .79%"). The
# fallback pattern below catches that case.
_RATE_RE_FALLBACK = re.compile(r"\b([1-9])\s*\.\s*(\d{2,3})\b")


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _extract_rate(text: str) -> float | None:
    m = _RATE_RE.search(text)
    if m:
        try:
            v = float(m.group(1))
        except ValueError:
            return None
    else:
        m2 = _RATE_RE_FALLBACK.search(text)
        if not m2:
            return None
        try:
            v = float(f"{m2.group(1)}.{m2.group(2)}")
        except ValueError:
            return None
    return v if 1.0 <= v <= 15.0 else None


def _classify_fixed_label(label: str) -> Term | None:
    norm = _normalize(label)
    if "open" in norm or "high ratio" in norm:
        return None
    if "fixed" not in norm or "closed" not in norm:
        return None
    for needle, term in TERM_LABEL_MAP:
        if needle in norm:
            return term
    return None


def _table_matches(table: Tag, section_keyword: str, column_keyword: str) -> bool:
    """True if the table's first row mentions both `section_keyword` and `column_keyword`."""
    first_row = table.find("tr")
    if not first_row:
        return False
    cells = first_row.find_all(["td", "th"])
    if len(cells) < 2:
        return False
    section = _normalize(cells[0].get_text(" ", strip=True))
    column = _normalize(cells[1].get_text(" ", strip=True))
    return section_keyword in section and column == column_keyword


def _parse_fixed_table(table: Tag) -> dict[str, float]:
    out: dict[str, float] = {}
    for row in table.find_all("tr")[1:]:  # skip header row
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        term = _classify_fixed_label(cells[0].get_text(" ", strip=True))
        if term is None:
            continue
        rate = _extract_rate(cells[1].get_text(" ", strip=True))
        if rate is not None:
            out.setdefault(term.value, rate)
    return out


class AlternaScraper(LenderScraper):
    slug = "alterna"
    name = "Alterna Savings"
    type = LenderType.CREDIT_UNION
    source_url = "https://www.alterna.ca/en/rates/mortgages"
    affiliate_url = None
    provinces = ["ON"]

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
        variable_rate: float | None = None

        for table in soup.find_all("table"):
            # Posted Fixed Closed
            if _table_matches(table, "fixed rate mortgages - closed", "posted rates"):
                posted_by_term.update(_parse_fixed_table(table))
                continue
            # Discounted Fixed Closed (header column "Rates")
            if _table_matches(table, "fixed rate mortgages - closed", "rates"):
                discounted_by_term.update(_parse_fixed_table(table))
                continue
            # Variable Closed — take the 5-Year row
            if _table_matches(table, "variable rate mortgages - closed", "rates"):
                for row in table.find_all("tr")[1:]:
                    cells = row.find_all(["td", "th"])
                    if len(cells) < 2:
                        continue
                    label = _normalize(cells[0].get_text(" ", strip=True))
                    if "5-year" not in label or "high ratio" in label or "open" in label:
                        continue
                    rate = _extract_rate(cells[1].get_text(" ", strip=True))
                    if rate is not None:
                        variable_rate = rate
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
            discounted = discounted_by_term.get(term.value)
            # Only count it as "discounted" if it's actually below posted.
            if discounted is not None and discounted >= posted:
                discounted = None
            rates.append(Rate(term=term, posted=posted, discounted=discounted))

        if variable_rate is not None:
            rates.append(Rate(term=Term.VARIABLE, posted=variable_rate))

        return rates
