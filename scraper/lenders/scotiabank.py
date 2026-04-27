"""Scotiabank posted mortgage rates scraper (manual-capture).

Scotiabank's rates page is WAF-protected (headless browsers blocked).
Rates are fetched by manually saving the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py scotiabank \\
        --url https://www.scotiabank.com/ca/en/personal/mortgages.html

The page has three tables:
  Table 0 — Special offers (Scotia Ultimate Variable, Flex Value Closed/Open).
            We pick the variable rate from here (no variable in the posted table).
  Table 1 — Posted fixed rates with clean term labels: "1 year", "2 years",
            "3 years", ... "10 years". Each <tr> is <th>term</th><td>rate</td>.
  Table 2 — Open and short-term offers; skipped.

The parse() method skips rows whose label contains promotional qualifiers
("scotia", "flex", "open", "month") so only the clean Posted-table fixed
rows are captured. Variable is allowed through the filter so the Scotia
Ultimate Variable rate makes it in.
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
    return re.sub(r"\s+", " ", text.lower().replace("-", " ")).strip()


def _extract_rate(cell_text: str) -> float | None:
    m = _RATE_RE.search(cell_text)
    if not m:
        return None
    try:
        v = float(m.group())
    except ValueError:
        return None
    return v if 1.0 <= v <= 15.0 else None


class ScotiabankScraper(ManualLenderScraper):
    slug = "scotiabank"
    name = "Scotiabank"
    type = LenderType.BIG6
    source_url = "https://www.scotiabank.com/ca/en/personal/mortgages.html"
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
            # Skip open-term, short-term and brand-decorated FIXED rows.
            # Variable is allowed because the only variable on the page is the
            # "Scotia Ultimate Variable Rate Mortgage" in the Special Offers table.
            if "open" in label or "month" in label:
                continue
            if "variable" not in label and ("flex" in label or "scotia" in label):
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
