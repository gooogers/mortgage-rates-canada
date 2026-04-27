"""CIBC posted mortgage rates scraper (manual-capture).

CIBC's rates page uses RDS% template rendering — actual rates are injected
client-side and the page is WAF-protected (headless browsers blocked).
Rates are fetched by manually saving the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py cibc \\
        --url https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html

The page has 6 tables. Each row uses 4 columns:
    Term | Posted Rate | Special Offer | APR

We take the Posted Rate (cells[1]) for fixed terms from the main posted-rates
table and the variable rate from the "5-year variable flex" row in another
section. Dedup keeps the first occurrence of each term.
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


class CIBCScraper(ManualLenderScraper):
    slug = "cibc"
    name = "CIBC"
    type = LenderType.BIG6
    source_url = "https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html"
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
                rates.append(Rate(term=term, posted=rate))
                seen.add(term.value)
                break

        return rates
