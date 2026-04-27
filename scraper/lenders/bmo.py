"""BMO Bank of Montreal posted mortgage rates scraper (manual-capture).

BMO's rates page is protected by Akamai Bot Manager (returns
ERR_HTTP2_PROTOCOL_ERROR to headless Chromium via TLS fingerprinting).
Rates are fetched by manually saving the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py bmo \\
        --url https://www.bmo.com/main/personal/mortgages/mortgage-rates/

BMO's HTML uses several `<table>` elements; the relevant row layout is:

    <tr>
      <td>1 year</td>          <!-- term label -->
      <td>5.490%</td>          <!-- Rate, amortization under 25 years -->
      <td>5.580%</td>          <!-- APR, amortization under 25 years  -->
      <td>5.490%</td>          <!-- Rate, amortization over 25 years  -->
      <td>5.580%</td>          <!-- APR, amortization over 25 years   -->
    </tr>

We take the second cell (Rate, under-25yr amortization) as the posted rate.
Open-term rows are skipped via the "open" check. Term labels use spaces
("1 year", "3 year fixed (closed)") so the keyword match normalizes the
label by collapsing whitespace.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.manual_base import ManualLenderScraper

_RATE_RE = re.compile(r"\b\d+\.\d+\b")

# Keywords match the normalized label (spaces collapsed). "variable" comes
# first so "5 year variable" classifies as VARIABLE not FIVE_YEAR_FIXED.
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
    """Lowercase + collapse whitespace + replace hyphens with spaces."""
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


class BMOScraper(ManualLenderScraper):
    slug = "bmo"
    name = "BMO Bank of Montreal"
    type = LenderType.BIG6
    source_url = "https://www.bmo.com/main/personal/mortgages/mortgage-rates/"
    affiliate_url = None

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")

        # Pass 1: collect special-offer rates (rows whose label contains parens
        # or "smart"). Map term → discounted rate.
        specials: dict[str, float] = {}
        for row in soup.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            if "(" not in label and "smart" not in label:
                continue
            if "open" in label:
                continue
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                rate = None
                for cell in cells[1:]:
                    rate = _extract_rate(cell.get_text(strip=True))
                    if rate is not None:
                        break
                if rate is not None and term.value not in specials:
                    specials[term.value] = rate
                break

        # Pass 2: emit posted rates with matching specials.
        rates: list[Rate] = []
        seen: set[str] = set()
        for row in soup.find_all("tr"):
            cells = row.find_all(["th", "td"])
            if len(cells) < 2:
                continue
            label = _normalize(cells[0].get_text(" ", strip=True))
            if "open" in label:
                continue
            if "variable" not in label and ("(" in label or "smart" in label):
                continue
            for keyword, term in TERM_KEYWORD_MAP:
                if keyword not in label:
                    continue
                if term.value in seen:
                    continue
                posted = None
                for cell in cells[1:]:
                    posted = _extract_rate(cell.get_text(strip=True))
                    if posted is not None:
                        break
                if posted is None:
                    continue
                discounted = specials.get(term.value)
                # If this row IS the variable special-offer row (no separate posted),
                # treat the same value as both.
                if "variable" in label and "(" in label and discounted is None:
                    discounted = posted
                rates.append(Rate(term=term, posted=posted, discounted=discounted))
                seen.add(term.value)
                break

        return rates
