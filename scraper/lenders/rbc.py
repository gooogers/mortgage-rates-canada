"""RBC Royal Bank posted mortgage rates scraper.

RBC's rates page has two tabs: "Special Rates" (promotional) and "Posted Rates".
We exclusively use the "Posted Rates" tab (div#posted-rates), 25-year amortization
or less section, which is the regulatory posted rate used by the stress test formula.

Fixed rates are identified via data-rate-code values mapped to Term enums below.
Variable rates are expressed as "RBC Prime Rate + <spread>" — we read the spread
span value and add it to the Prime Rate span (also a data-rate-code span) to
compute the effective posted variable rate.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

from core.models import LenderType, Rate, Term
from lenders._playwright import render_page
from lenders.base import LenderScraper

# ---------------------------------------------------------------------------
# Rate-code → Term mapping
# Only "Posted Rates" column spans from the 25-year amortization or less section.
# These codes were identified by inspecting the fixture at:
#   tests/fixtures/rbc.html  (div#posted-rates > h4[25yr] > collapsible-table5)
# DO NOT include special-offer / APR / greater-than-25yr codes here.
# ---------------------------------------------------------------------------
RATE_CODE_MAP: dict[str, Term] = {
    "0006340013": Term.ONE_YEAR_FIXED,    # 1 Year Closed posted rate
    "0006340016": Term.TWO_YEAR_FIXED,    # 2 Year Closed posted rate
    "0006340019": Term.THREE_YEAR_FIXED,  # 3 Year Closed posted rate
    "0006340022": Term.FOUR_YEAR_FIXED,   # 4 Year Closed posted rate
    "0006340025": Term.FIVE_YEAR_FIXED,   # 5 Year Closed posted rate
    "0006340042": Term.SEVEN_YEAR_FIXED,  # 7 Year Closed posted rate
    "0006340030": Term.TEN_YEAR_FIXED,    # 10 Year Closed posted rate
}

# Rate code for the RBC Prime Rate (used to compute variable posted rate).
PRIME_RATE_CODE = "0006470002"

# Rate code for the variable spread in the 25yr-or-less posted-rates section.
# The posted variable rate = Prime + this spread.
VARIABLE_SPREAD_CODE = "0236440012"  # 5 Year Closed variable, posted rates col


class RBCScraper(LenderScraper):
    slug = "rbc"
    name = "RBC Royal Bank"
    type = LenderType.BIG6
    source_url = "https://www.rbcroyalbank.com/mortgages/mortgage-rates.html"
    affiliate_url = None

    # Wait for any rate-code span to appear before grabbing the HTML.
    WAIT_FOR_SELECTOR = "[data-rate-code]"
    # Render wait beyond domcontentloaded — RBC's table populates a few seconds
    # after navigation.
    RENDER_TIMEOUT_MS = 60_000

    def fetch(self) -> str:
        return render_page(
            self.source_url,
            wait_for_selector=self.WAIT_FOR_SELECTOR,
            timeout_ms=self.RENDER_TIMEOUT_MS,
        )

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: list[Rate] = []
        seen_terms: set[str] = set()

        # ------------------------------------------------------------------
        # Step 1: Build a lookup of all rate-code → float from the whole page
        # so we can resolve Prime and variable spread without scanning twice.
        # ------------------------------------------------------------------
        all_codes: dict[str, float] = {}
        for span in soup.select("span[data-rate-code]"):
            code = span.get("data-rate-code", "")
            text = span.get_text(strip=True)
            try:
                all_codes[code] = float(text)
            except ValueError:
                pass

        # ------------------------------------------------------------------
        # Step 2: Extract fixed posted rates from RATE_CODE_MAP.
        # We iterate spans in document order; the posted-rates section appears
        # after the special-rates section, so duplicate codes (same code
        # appears in both sections) are handled by seen_terms dedup.
        # Both sections use the same rate codes for fixed rates, so we take
        # the first occurrence — which is in the special-rates section.
        # To be precise, we scope to div#posted-rates only.
        # ------------------------------------------------------------------
        posted_div = soup.find("div", id="posted-rates")
        if not isinstance(posted_div, Tag):
            return rates

        for span in posted_div.select("span[data-rate-code]"):
            code = span.get("data-rate-code", "")
            term = RATE_CODE_MAP.get(code)
            if term is None:
                continue
            term_value = term.value if isinstance(term, Term) else str(term)
            if term_value in seen_terms:
                continue
            try:
                value = float(span.get_text(strip=True))
            except ValueError:
                continue
            if value < 1.0 or value > 15.0:
                continue
            rates.append(Rate(term=term, posted=value))
            seen_terms.add(term_value)

        # ------------------------------------------------------------------
        # Step 3: Extract variable posted rate.
        # Posted variable = Prime Rate + spread (from div#posted-rates,
        # 25yr-or-less variable table, "Posted Rates" column).
        # Prime is read from div#rbc-prime-rate table.
        # ------------------------------------------------------------------
        prime = all_codes.get(PRIME_RATE_CODE)
        spread = all_codes.get(VARIABLE_SPREAD_CODE)

        if prime is not None and spread is not None:
            variable_rate = round(prime + spread, 4)
            if 1.0 <= variable_rate <= 15.0:
                term_value = Term.VARIABLE.value
                if term_value not in seen_terms:
                    rates.append(Rate(term=Term.VARIABLE, posted=variable_rate))
                    seen_terms.add(term_value)

        return rates
