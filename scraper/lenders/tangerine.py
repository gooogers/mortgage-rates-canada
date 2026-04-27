"""Tangerine posted mortgage rates scraper (manual-capture).

Tangerine's rates page (https://www.tangerine.ca/en/rates/mortgage-rates) is
JavaScript-rendered. Rates are fetched by manually saving the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py tangerine \\
        --url https://www.tangerine.ca/en/rates/mortgage-rates

The page has two tables, each with two columns (term | rate):
    Table 0 — Standard Rates (what we use as "posted")
    Table 1 — "Already a Client" preferred rates (skipped via dedup since
              Table 0 appears first)

Both fixed and variable rates appear together in each table.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.manual_base import ManualLenderScraper

_RATE_RE = re.compile(r"\b\d+\.\d+\b")

TERM_KEYWORD_MAP: list[tuple[str, Term]] = [
    ("variable", Term.VARIABLE),
    ("1 year",   Term.ONE_YEAR_FIXED),
    ("2 year",   Term.TWO_YEAR_FIXED),
    ("3 year",   Term.THREE_YEAR_FIXED),
    ("4 year",   Term.FOUR_YEAR_FIXED),
    ("5 year",   Term.FIVE_YEAR_FIXED),
    ("7 year",   Term.SEVEN_YEAR_FIXED),
    ("10 year",  Term.TEN_YEAR_FIXED),
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("-", " ").replace("\xa0", " ")).strip()


def _extract_rate(cell_text: str) -> float | None:
    m = _RATE_RE.search(cell_text)
    if not m:
        return None
    try:
        v = float(m.group())
    except ValueError:
        return None
    return v if 1.0 <= v <= 15.0 else None


class TangerineScraper(ManualLenderScraper):
    slug = "tangerine"
    name = "Tangerine"
    type = LenderType.OTHER
    source_url = "https://www.tangerine.ca/en/rates/mortgage-rates"
    affiliate_url = None

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: list[Rate] = []
        seen: set[str] = set()

        for row in soup.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            if "open" in label or "month" in label:
                continue
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                if term.value in seen:
                    continue
                rate = None
                for cell in cells[1:]:
                    rate = _extract_rate(cell.get_text(strip=True))
                    if rate is not None:
                        break
                if rate is None:
                    continue
                rates.append(Rate(term=term, posted=rate, discounted=rate))
                seen.add(term.value)
                break

        return rates
