"""TD Bank posted mortgage rates scraper.

TD's rates page is an Angular/AEM SPA.  The rendered DOM contains two
rate tables:

  1. Fixed-Rate Mortgages table  (~line 6230 of the fixture)
     Rows are <tbody><tr><td>term label</td><td>rate cell</td></tr></tbody>.
     Each rate cell contains one or more <span> elements tagged with:
       data-source="tdct-resl"
       data-product-key="MTGFXXXC"   (MTGF = fixed, C = closed)
       data-high-ratio="false"
       data-value="PostedRate"
     Some terms also show a SpecialRate (promotional) — we ignore those and
     use the PostedRate span exclusively.
     Open-term rows use product keys ending in "O" and are skipped.

  2. Variable-Rate Mortgages table  (~line 6520 of the fixture)
     The "5 Year Variable Closed Mortgage" row carries a PostedRate span
     for product key MTGV060C.  TD calls this value the "TD Mortgage Prime
     Rate" — it is the conventional posted variable rate used by the stress
     test.  The SpecialRate for the same product is a discounted offer and
     is ignored.

Rate selection rationale:
  - PostedRate for the posted field; SpecialRate for the discounted field.
  - Closed term only (product keys ending in "C").
  - data-high-ratio="false" (conventional / uninsured tier).
  - No amortization tiers present on TD's page (unlike RBC); a single rate
    is shown per term.

Product-key → Term mapping (closed, conventional):
  MTGF012C  → ONE_YEAR_FIXED   (5.49 %)
  MTGF024C  → TWO_YEAR_FIXED   (4.89 %)
  MTGF036C  → THREE_YEAR_FIXED (6.05 %)
  MTGF048C  → FOUR_YEAR_FIXED  (5.99 %)
  MTGF060C  → FIVE_YEAR_FIXED  (6.09 %)
  MTGF084C  → SEVEN_YEAR_FIXED (6.40 %)
  MTGF120C  → TEN_YEAR_FIXED   (6.80 %)
  MTGV060C  → VARIABLE         (4.60 % — TD Mortgage Prime Rate)

MTGF006C (6-month convertible) and MTGF072C (6-year) have no matching
Term enum value and are intentionally omitted.
"""
from __future__ import annotations

from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders._playwright import render_page
from lenders.base import LenderScraper

# ---------------------------------------------------------------------------
# Product-key → Term mapping
# Only closed (C suffix), non-high-ratio posted rates are included.
# ---------------------------------------------------------------------------
PRODUCT_KEY_MAP: dict[str, Term] = {
    "MTGF012C": Term.ONE_YEAR_FIXED,
    "MTGF024C": Term.TWO_YEAR_FIXED,
    "MTGF036C": Term.THREE_YEAR_FIXED,
    "MTGF048C": Term.FOUR_YEAR_FIXED,
    "MTGF060C": Term.FIVE_YEAR_FIXED,
    "MTGF084C": Term.SEVEN_YEAR_FIXED,
    "MTGF120C": Term.TEN_YEAR_FIXED,
    "MTGV060C": Term.VARIABLE,
}


class TDScraper(LenderScraper):
    slug = "td"
    name = "TD Bank"
    type = LenderType.BIG6
    source_url = "https://www.td.com/ca/en/personal-banking/products/mortgages/mortgage-rates"
    affiliate_url = None

    # Wait until at least one rate span has been populated by the SPA.
    WAIT_FOR_SELECTOR = "[data-source='tdct-resl'][data-value='PostedRate']"
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

        # Iterate every span tagged as a PostedRate for a conventional
        # (non-high-ratio) closed product.  Document order means that if the
        # same product key appears in multiple sections (e.g. the "special
        # offers" spotlight at the top of the page), the first occurrence is
        # used — which is fine because all PostedRate spans for a given key
        # carry the same value.  seen_terms dedup prevents doubles regardless.
        selector = (
            "span[data-source='tdct-resl']"
            "[data-value='PostedRate']"
            "[data-high-ratio='false']"
        )
        for span in soup.select(selector):
            product_key = span.get("data-product-key", "")
            term = PRODUCT_KEY_MAP.get(product_key)
            if term is None:
                continue  # open term, 6-month, 6-year, or high-ratio variant

            term_value = term.value
            if term_value in seen_terms:
                continue  # already captured from an earlier occurrence

            text = span.get_text(strip=True)
            try:
                value = float(text)
            except ValueError:
                continue
            if value < 1.0 or value > 15.0:
                continue

            rates.append(Rate(term=term, posted=value))
            seen_terms.add(term_value)

        # Second pass: collect SpecialRate values as discounted rates.
        # The product-key map is the same; only data-value differs.
        specials: dict[str, float] = {}
        special_selector = (
            "span[data-source='tdct-resl']"
            "[data-value='SpecialRate']"
            "[data-high-ratio='false']"
        )
        seen_special: set[str] = set()
        for span in soup.select(special_selector):
            product_key = span.get("data-product-key", "")
            term = PRODUCT_KEY_MAP.get(product_key)
            if term is None:
                continue

            term_value = term.value
            if term_value in seen_special:
                continue

            text = span.get_text(strip=True)
            try:
                value = float(text)
            except ValueError:
                continue
            if value < 1.0 or value > 15.0:
                continue

            specials[term_value] = value
            seen_special.add(term_value)

        # Attach discounted values to the already-built rates list.
        for i, r in enumerate(rates):
            term_key = r.term if isinstance(r.term, str) else r.term.value
            if term_key in specials:
                rates[i] = Rate(term=r.term, posted=r.posted, discounted=specials[term_key])

        return rates
