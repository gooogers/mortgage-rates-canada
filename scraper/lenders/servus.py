"""Servus Credit Union (Alberta) posted mortgage rates scraper.

Servus's `/rates` page does not use HTML tables for mortgages — it uses
nested div blocks under a `.ratesTable` container, with three columns per row:

    [term label] [Rate %] [Special Rate %]

The container holds product groups under `.typeGroup` > `.productHeading`.
We only consume rows under "Fixed Rate Closed Mortgage". Open and No-Frills
groups are skipped (No Frills is a 5-year-only basic product whose rates
duplicate the Closed 5-year row anyway).

Servus does not publish a variable mortgage rate on this page, so the parser
never emits one. (The test suite reflects this in its required-terms set.)
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders._playwright import render_page
from lenders.base import LenderScraper

TERM_LABEL_MAP: list[tuple[str, Term]] = [
    ("10 year", Term.TEN_YEAR_FIXED),
    ("7 year",  Term.SEVEN_YEAR_FIXED),
    ("5 year",  Term.FIVE_YEAR_FIXED),
    ("4 year",  Term.FOUR_YEAR_FIXED),
    ("3 year",  Term.THREE_YEAR_FIXED),
    ("2 year",  Term.TWO_YEAR_FIXED),
    ("1 year",  Term.ONE_YEAR_FIXED),
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


class ServusScraper(LenderScraper):
    slug = "servus"
    name = "Servus Credit Union"
    type = LenderType.CREDIT_UNION
    source_url = "https://servus.ca/rates"
    affiliate_url = None
    provinces = ["AB"]

    # The /rates page renders the entire mortgages section client-side, so
    # wait for the productHeading element labelled with "Mortgage" to appear.
    WAIT_FOR_SELECTOR = ".ratesTable .productHeading"
    RENDER_TIMEOUT_MS = 60_000

    def fetch(self) -> str:
        return render_page(
            self.source_url,
            wait_for_selector=self.WAIT_FOR_SELECTOR,
            timeout_ms=self.RENDER_TIMEOUT_MS,
        )

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")

        # Locate the Mortgages section by walking from the h2 to its
        # `.ratesTable` sibling/descendant.
        mortgage_h2 = None
        for h2 in soup.find_all("h2"):
            if h2.get_text(strip=True).lower() == "mortgages":
                mortgage_h2 = h2
                break
        if mortgage_h2 is None:
            return []

        rates_table = mortgage_h2.find_next(class_="ratesTable")
        if rates_table is None:
            return []

        posted_by_term: dict[str, float] = {}
        discounted_by_term: dict[str, float] = {}

        for tg in rates_table.find_all(class_="typeGroup"):
            ph = tg.find(class_="productHeading")
            heading = _normalize(ph.get_text(" ", strip=True)) if ph else ""
            # We want the closed-fixed product only. Skip open and No-Frills.
            if "fixed rate closed" not in heading:
                continue
            for row in tg.find_all(class_="rate"):
                cells = row.find_all(class_="columns")
                # Each row: [label, rate cell, special-rate cell, (spacer)]
                label = _normalize(cells[0].get_text(" ", strip=True)) if cells else ""
                if "high ratio" in label or "convertible" in label or "open" in label:
                    continue
                term = _classify_term(label)
                if term is None:
                    continue
                posted_text = cells[1].get_text(" ", strip=True) if len(cells) > 1 else ""
                special_text = cells[2].get_text(" ", strip=True) if len(cells) > 2 else ""
                posted = _extract_rate(posted_text)
                if posted is None:
                    continue
                posted_by_term.setdefault(term.value, posted)
                special = _extract_rate(special_text)
                if special is not None:
                    discounted_by_term.setdefault(term.value, special)

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

        return rates
