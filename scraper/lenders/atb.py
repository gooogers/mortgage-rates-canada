"""ATB Financial (Alberta) posted mortgage rates scraper.

ATB's `/resources/rates/mortgage-rates/` page has two parallel rate sections,
each with a banner heading and a series of product subheadings:

    <h2>Client Rates</h2>           (discounted)
    <h2>Closed fixed-rate mortgages</h2>      -> table of fixed terms
    <h2>Closed variable-rate mortgages</h2>   -> table of variable
    ... (Open variants are skipped)

    <h2>Posted Rates</h2>           (posted)
    <h2>Closed fixed-rate mortgages</h2>      -> table of fixed terms
    <h2>Closed variable-rate mortgages</h2>   -> table of variable

Within fixed tables, rows look like:
    "1 year" / "1 year conventional"  | "6.09%"
    "5 years high ratio"              | "5.64%"   (we skip "high ratio")
    "30 month conventional"           | "6.34%"   (we skip "30 month")

The leading h2 banners "Our featured offers" and "Featured" replicate the
client-rate tables; we look up tables by walking from the section h2 forward.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

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
    if "30 month" in label or "30-month" in label or "high ratio" in label:
        return None
    for needle, term in TERM_LABEL_MAP:
        if needle in label:
            return term
    return None


def _find_section_table(banner: Tag, product_label_prefix: str) -> Tag | None:
    """Walk forward from `banner` (an h2) looking for an h2 whose text starts
    with `product_label_prefix` (lowercased). Stop when another top-level
    banner is hit. Return the first <table> following that h2.

    The prefix check excludes the parallel "Rate First closed fixed-rate ..."
    section, which precedes the conventional fixed-rate section in document
    order."""
    stop_banners = {"client rates", "posted rates", "ready to get started?"}
    node = banner.find_next("h2")
    while node is not None:
        text = _normalize(node.get_text(" ", strip=True))
        if text in stop_banners and node is not banner:
            return None
        if text.startswith(product_label_prefix):
            tbl = node.find_next("table")
            if tbl is not None:
                return tbl
        node = node.find_next("h2")
    return None


def _find_banner(soup: BeautifulSoup, banner_text: str) -> Tag | None:
    target = banner_text.lower()
    for h2 in soup.find_all("h2"):
        if _normalize(h2.get_text(" ", strip=True)) == target:
            return h2
    return None


def _parse_fixed_table(table: Tag) -> dict[str, float]:
    out: dict[str, float] = {}
    for row in table.find_all("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        label = _normalize(cells[0].get_text(" ", strip=True))
        if "term" == label:  # header row
            continue
        term = _classify_term(label)
        if term is None:
            continue
        # Prefer "conventional" rows over the unmarked label when both exist.
        rate = _extract_rate(cells[1].get_text(" ", strip=True))
        if rate is None:
            continue
        # If label is bare "X year" and we already have a conventional value, skip.
        if "conventional" in label or term.value not in out:
            out[term.value] = rate
    return out


def _parse_variable_table(table: Tag) -> float | None:
    for row in table.find_all("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        label = _normalize(cells[0].get_text(" ", strip=True))
        if "high ratio" in label or "open" in label:
            continue
        if "5 year" not in label and "5-year" not in label:
            continue
        rate = _extract_rate(cells[1].get_text(" ", strip=True))
        if rate is not None:
            return rate
    return None


class ATBScraper(LenderScraper):
    slug = "atb"
    name = "ATB Financial"
    type = LenderType.CREDIT_UNION
    source_url = "https://www.atb.com/resources/rates/mortgage-rates/"
    affiliate_url = None
    provinces = ["AB"]

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

        client_banner = _find_banner(soup, "Client Rates")
        posted_banner = _find_banner(soup, "Posted Rates")

        discounted_fixed: dict[str, float] = {}
        posted_fixed: dict[str, float] = {}
        discounted_variable: float | None = None
        posted_variable: float | None = None

        if client_banner is not None:
            tbl = _find_section_table(client_banner, "closed fixed-rate")
            if tbl is not None:
                discounted_fixed = _parse_fixed_table(tbl)
            tbl = _find_section_table(client_banner, "closed variable-rate")
            if tbl is not None:
                discounted_variable = _parse_variable_table(tbl)

        if posted_banner is not None:
            tbl = _find_section_table(posted_banner, "closed fixed-rate")
            if tbl is not None:
                posted_fixed = _parse_fixed_table(tbl)
            tbl = _find_section_table(posted_banner, "closed variable-rate")
            if tbl is not None:
                posted_variable = _parse_variable_table(tbl)

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
