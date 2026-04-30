"""Vancity (BC) posted mortgage rates scraper.

Vancity's rate page renders four tables. Three of them carry rate rows that
we care about:

    Table contents                              | Row label distinguishes
    --------------------------------------------+-----------------------------
    "Fixed-term fixed-rate" (table 1 in fixture)| "(special offer)"   = special
                                                | "fixed-term residential" = posted
    "Variable rate" (table 3 in fixture)        | "5-year variable rate fixed-term"

Open-term and high-ratio-insured rows are skipped. Rate cells look like
"4.19 % ¤" (note the space before %).
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

from core.models import LenderType, Rate, Term
from lenders._playwright import render_page
from lenders.base import LenderScraper

TERM_LABEL_MAP: list[tuple[str, Term]] = [
    ("10-year", Term.TEN_YEAR_FIXED),
    ("7-year",  Term.SEVEN_YEAR_FIXED),
    ("5-year",  Term.FIVE_YEAR_FIXED),
    ("4-year",  Term.FOUR_YEAR_FIXED),
    ("3-year",  Term.THREE_YEAR_FIXED),
    ("2-year",  Term.TWO_YEAR_FIXED),
    ("1-year",  Term.ONE_YEAR_FIXED),
]

_RATE_RE = re.compile(r"\b([1-9]\.\d{2,3})\b")


def _normalize(text: str) -> str:
    # Collapse whitespace and replace non-breaking hyphens.
    return re.sub(r"\s+", " ", text.replace("‑", "-").lower()).strip()


def _extract_rate(text: str) -> float | None:
    m = _RATE_RE.search(text)
    if not m:
        return None
    try:
        v = float(m.group(1))
    except ValueError:
        return None
    return v if 1.0 <= v <= 15.0 else None


def _classify_term(label: str) -> Term | None:
    for needle, term in TERM_LABEL_MAP:
        if needle in label:
            return term
    return None


class VancityScraper(LenderScraper):
    slug = "vancity"
    name = "Vancity"
    type = LenderType.CREDIT_UNION
    source_url = "https://www.vancity.com/rates/mortgages"
    affiliate_url = None
    provinces = ["BC"]

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

        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            rate_text = cells[1].get_text(" ", strip=True)

            if "open-term" in label or "open term" in label:
                continue
            if "insured" in label:
                continue  # high-ratio insured table — separate product

            # Variable: only the closed 5-year variable.
            if "variable rate fixed-term" in label and "5-year" in label:
                rate = _extract_rate(rate_text)
                if rate is not None and variable_rate is None:
                    variable_rate = rate
                continue

            term = _classify_term(label)
            if term is None:
                continue

            rate = _extract_rate(rate_text)
            if rate is None:
                continue

            if "(special offer)" in label:
                discounted_by_term.setdefault(term.value, rate)
            elif "fixed-term residential" in label:
                posted_by_term.setdefault(term.value, rate)

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
            if discounted is not None and discounted >= posted:
                discounted = None
            rates.append(Rate(term=term, posted=posted, discounted=discounted))

        if variable_rate is not None:
            rates.append(Rate(term=Term.VARIABLE, posted=variable_rate))

        return rates
