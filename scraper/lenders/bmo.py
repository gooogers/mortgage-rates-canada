"""BMO Bank of Montreal posted mortgage rates scraper (manual-capture).

BMO's rates page is protected by Akamai Bot Manager. Rates are fetched by
manually saving the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py bmo \\
        --url https://www.bmo.com/en-ca/main/personal/mortgages/mortgage-rates/

The parse() method uses a keyword-scanning table walker. If the real BMO HTML
structure differs from the synthetic test fixture, update the selectors here
and replace tests/fixtures/bmo.html with a trimmed real snapshot.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.manual_base import ManualLenderScraper

_RATE_RE = re.compile(r"\b\d+\.\d+\b")

TERM_KEYWORD_MAP: list[tuple[str, Term]] = [
    ("variable",  Term.VARIABLE),
    ("1-year",    Term.ONE_YEAR_FIXED),
    ("2-year",    Term.TWO_YEAR_FIXED),
    ("3-year",    Term.THREE_YEAR_FIXED),
    ("4-year",    Term.FOUR_YEAR_FIXED),
    ("5-year",    Term.FIVE_YEAR_FIXED),
    ("7-year",    Term.SEVEN_YEAR_FIXED),
    ("10-year",   Term.TEN_YEAR_FIXED),
]


class BMOScraper(ManualLenderScraper):
    slug = "bmo"
    name = "BMO Bank of Montreal"
    type = LenderType.BIG6
    source_url = "https://www.bmo.com/en-ca/main/personal/mortgages/mortgage-rates/"
    affiliate_url = None

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: list[Rate] = []
        seen: set[str] = set()

        for row in soup.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue
            label = cells[0].get_text(" ", strip=True).lower()
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                if term.value in seen:
                    continue
                m = _RATE_RE.search(cells[-1].get_text(strip=True))
                if not m:
                    continue
                try:
                    rate = float(m.group())
                except ValueError:
                    continue
                if 1.0 <= rate <= 15.0:
                    rates.append(Rate(term=term, posted=rate))
                    seen.add(term.value)
                break

        return rates
