"""Coast Capital Savings (BC) posted mortgage rates scraper.

Coast Capital's rate page renders multiple tables under three sections:

    Featured Mortgage Rates     -> table 0 (5-yr highlights, ignored)
    Fixed Rate Mortgages        -> table 2 (special / discounted fixed)
    Variable Rate Mortgages     -> table 3 (special / discounted variable)
    Posted Rates                -> table 4 (posted fixed, "- Closed" labels)
                                   table 5 (posted variable, "- Closed")

The "discounted" tables use labels like "1-Year Fixed Rate" / "5-Year Variable
Rate" (no "- Closed" suffix) while the "posted" tables include "- Closed" in
the label. We use that suffix to discriminate, skipping rows that are Open,
High-Ratio (insured), or odd terms not in our Term enum.

Each row's second cell ("Up to 25 Year Amortization") holds the conventional
posted rate.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

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


def _classify_term(label: str) -> Term | None:
    for needle, term in TERM_LABEL_MAP:
        if needle in label:
            return term
    return None


class CoastCapitalScraper(LenderScraper):
    slug = "coast-capital"
    name = "Coast Capital Savings"
    type = LenderType.CREDIT_UNION
    source_url = "https://www.coastcapitalsavings.com/rates/mortgages"
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

        posted_fixed: dict[str, float] = {}
        discounted_fixed: dict[str, float] = {}
        posted_variable: float | None = None
        discounted_variable: float | None = None

        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            rate_text = cells[1].get_text(" ", strip=True)

            if "open" in label:
                continue
            if "high-ratio" in label or "high ratio" in label:
                continue

            rate = _extract_rate(rate_text)
            if rate is None:
                continue

            is_closed = "- closed" in label or "closed" in label.split(" - ")[-1]
            is_variable = "variable" in label

            # Variable rate handling
            if is_variable:
                if "5-year" not in label:
                    continue
                if is_closed:
                    if posted_variable is None:
                        posted_variable = rate
                else:
                    if discounted_variable is None:
                        discounted_variable = rate
                continue

            # Fixed rate handling
            if "fixed" not in label:
                continue
            term = _classify_term(label)
            if term is None:
                continue
            if is_closed:
                posted_fixed.setdefault(term.value, rate)
            else:
                discounted_fixed.setdefault(term.value, rate)

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
            posted = posted_fixed.get(term.value)
            if posted is None:
                continue
            discounted = discounted_fixed.get(term.value)
            if discounted is not None and discounted >= posted:
                discounted = None
            rates.append(Rate(term=term, posted=posted, discounted=discounted))

        if posted_variable is not None:
            disc = discounted_variable
            if disc is not None and disc >= posted_variable:
                disc = None
            rates.append(Rate(term=Term.VARIABLE, posted=posted_variable, discounted=disc))

        return rates
