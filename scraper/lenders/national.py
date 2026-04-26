"""National Bank of Canada posted mortgage rates scraper.

National Bank's mortgage page embeds rate data in a JavaScript call:

    Websites.Product.Core.setProductMap(JSON.parse("..."), true);

The JSON string contains a single key "c1" whose value is a JSON array of
product-condition objects.  Each object is identified by its ``conditionId``
field:

    PH-TF   Mortgage fixed rate   (taux*F fields carry posted closed rates)
    PH-TV   Mortgage variable rate (taux5ansO is the 5-year variable posted)
    PH-TV-PL Variable capped-rate mortgage (not used here)

Fixed-rate fields (from the PH-TF product):
    taux1anF    → ONE_YEAR_FIXED
    taux2ansF   → TWO_YEAR_FIXED
    taux3ansF   → THREE_YEAR_FIXED
    taux4ansF   → FOUR_YEAR_FIXED
    taux5ansF   → FIVE_YEAR_FIXED
    taux7ansF   → SEVEN_YEAR_FIXED
    taux10ansF  → TEN_YEAR_FIXED

Variable-rate field (from the PH-TV product):
    taux5ansO   → VARIABLE (5-year adjustable-rate, posted)

The ``tauxPromo*`` fields are promotional/special offer rates and are
intentionally ignored.  The ``taux*O`` open-term fields in the fixed
product are also ignored.

The page's "Special offers on certain terms" section renders tauxPromo*
values as ``.bnc-renderer-percent`` spans via JS; we use the presence of
those spans as the Playwright wait condition to confirm the JS has run and
the JSON is available in the DOM.
"""
from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders._playwright import render_page
from lenders.base import LenderScraper

# ---------------------------------------------------------------------------
# Field-name → Term mapping for the PH-TF (fixed rate) product.
# Only closed (F suffix) posted rates are included; open (O) and promo
# (tauxPromo*) fields are excluded.
# ---------------------------------------------------------------------------
FIXED_FIELD_MAP: dict[str, Term] = {
    "taux1anF": Term.ONE_YEAR_FIXED,
    "taux2ansF": Term.TWO_YEAR_FIXED,
    "taux3ansF": Term.THREE_YEAR_FIXED,
    "taux4ansF": Term.FOUR_YEAR_FIXED,
    "taux5ansF": Term.FIVE_YEAR_FIXED,
    "taux7ansF": Term.SEVEN_YEAR_FIXED,
    "taux10ansF": Term.TEN_YEAR_FIXED,
}

# PH-TV product's field for the 5-year posted variable rate.
VARIABLE_FIELD = "taux5ansO"

# conditionId values used to identify the right product objects.
FIXED_CONDITION_ID = "PH-TF"
VARIABLE_CONDITION_ID = "PH-TV"


class NationalScraper(LenderScraper):
    slug = "national"
    name = "National Bank of Canada"
    type = LenderType.BIG6
    source_url = "https://www.nbc.ca/personal/mortgages.html"
    affiliate_url = None

    # Wait until the JS has rendered at least one percent span, which
    # confirms that setProductMap() has run and the JSON data is in the DOM.
    WAIT_FOR_SELECTOR = ".bnc-renderer-percent"
    RENDER_TIMEOUT_MS = 60_000

    def fetch(self) -> str:
        return render_page(
            self.source_url,
            wait_for_selector=self.WAIT_FOR_SELECTOR,
            timeout_ms=self.RENDER_TIMEOUT_MS,
        )

    def parse(self, html: str) -> list[Rate]:  # noqa: PLR0912
        soup = BeautifulSoup(html, "lxml")
        rates: list[Rate] = []

        # ------------------------------------------------------------------
        # Locate the setProductMap(...) call and extract the inner JSON.
        # The call looks like:
        #   Websites.Product.Core.setProductMap(JSON.parse("..."), true);
        # where "..." is a JS-escaped JSON string (uses \x22 for " etc.).
        # ------------------------------------------------------------------
        script_text = ""
        for script in soup.find_all("script"):
            text = script.get_text()
            if "setProductMap" in text and "JSON.parse" in text:
                script_text = text
                break

        if not script_text:
            return rates

        m = re.search(
            r'setProductMap\(JSON\.parse\("(.*?)"\),\s*true\)',
            script_text,
            re.DOTALL,
        )
        if not m:
            return rates

        raw = m.group(1)

        # Decode JS string escapes (\x22 → ", \u002D → -, etc.).
        # Pre-replace \/ → / to avoid a DeprecationWarning in Python 3.12+
        # where \/ is not a recognised unicode escape sequence.
        raw = raw.replace("\\/", "/")
        try:
            decoded = raw.encode("raw_unicode_escape").decode("unicode_escape")
        except (UnicodeDecodeError, ValueError):
            return rates

        # The decoded string is a JSON object like {"c1": "[...]"}.
        try:
            outer: dict[str, str] = json.loads(decoded)
        except json.JSONDecodeError:
            return rates

        # The value of each key is itself a JSON-encoded array of products.
        products: list[dict] = []
        for v in outer.values():
            try:
                products.extend(json.loads(v))
            except (json.JSONDecodeError, TypeError):
                pass

        # ------------------------------------------------------------------
        # Build a lookup: conditionId → product dict.
        # ------------------------------------------------------------------
        by_condition: dict[str, dict] = {}
        for product in products:
            cid = product.get("conditionId", "")
            if cid:
                by_condition[cid] = product

        seen_terms: set[str] = set()

        # ------------------------------------------------------------------
        # Extract fixed posted rates from the PH-TF product.
        # ------------------------------------------------------------------
        fixed_product = by_condition.get(FIXED_CONDITION_ID, {})
        for field, term in FIXED_FIELD_MAP.items():
            raw_value = fixed_product.get(field, "")
            if not raw_value:
                continue
            try:
                value = float(str(raw_value).replace(",", "."))
            except ValueError:
                continue
            if value < 1.0 or value > 15.0:
                continue
            term_key = term.value
            if term_key in seen_terms:
                continue
            rates.append(Rate(term=term, posted=value))
            seen_terms.add(term_key)

        # ------------------------------------------------------------------
        # Extract the variable posted rate from the PH-TV product.
        # ------------------------------------------------------------------
        variable_product = by_condition.get(VARIABLE_CONDITION_ID, {})
        raw_var = variable_product.get(VARIABLE_FIELD, "")
        if raw_var:
            try:
                var_value = float(str(raw_var).replace(",", "."))
            except ValueError:
                var_value = None

            if var_value is not None and 1.0 <= var_value <= 15.0:
                term_key = Term.VARIABLE.value
                if term_key not in seen_terms:
                    rates.append(Rate(term=Term.VARIABLE, posted=var_value))
                    seen_terms.add(term_key)

        return rates
