# Big 6 + Tangerine Lenders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BMO, Scotiabank, CIBC, and Tangerine scrapers plus brand-colour badges on all lender rows and hero cards across the site.

**Architecture:** Two independent parallel tracks. Scraper track: four new `ManualLenderScraper` subclasses with synthetic test fixtures and a table-scanning `parse()` strategy. Site track: a `lenders.ts` brand-config map, a `LenderBadge.astro` component, updated `LenderRow` and `HeroFeaturedRates` components, and expanded `rates.sample.json`. Scrapers are registered in `core/cli.py`'s `all_scrapers()`. The runner already handles scraper failures gracefully — missing manual fixtures log a warning and are skipped.

**Tech Stack:** Python 3.12 · BeautifulSoup/lxml · ManualLenderScraper · Astro 4 · TypeScript · Vitest

---

## File Map

**Scraper:**
- Modify: `scraper/core/models.py` — add `OTHER` to `LenderType`
- Create: `scraper/lenders/bmo.py`
- Create: `scraper/lenders/scotiabank.py`
- Create: `scraper/lenders/cibc.py`
- Create: `scraper/lenders/tangerine.py`
- Modify: `scraper/core/cli.py` — add imports + register in `all_scrapers()`
- Create: `scraper/tests/fixtures/bmo.html`
- Create: `scraper/tests/fixtures/scotiabank.html`
- Create: `scraper/tests/fixtures/cibc.html`
- Create: `scraper/tests/fixtures/tangerine.html`
- Modify: `scraper/tests/test_lenders.py` — add four `LENDER_CASES` entries

**Site:**
- Create: `site/src/lib/lenders.ts`
- Create: `site/src/components/LenderBadge.astro`
- Modify: `site/src/components/LenderRow.astro`
- Modify: `site/src/components/HeroFeaturedRates.astro`
- Modify: `site/src/data/rates.sample.json`

---

## Task 1: Add `LenderType.OTHER` to models

**Files:**
- Modify: `scraper/core/models.py`

- [ ] **Step 1: Add `OTHER` to the `LenderType` enum**

In `scraper/core/models.py`, change:

```python
class LenderType(str, Enum):
    BIG6 = "big6"
    MONOLINE = "monoline"
    CREDIT_UNION = "credit_union"
```

to:

```python
class LenderType(str, Enum):
    BIG6 = "big6"
    MONOLINE = "monoline"
    CREDIT_UNION = "credit_union"
    OTHER = "other"
```

- [ ] **Step 2: Run the full scraper test suite to confirm nothing breaks**

```bash
cd scraper
uv run pytest -v
```

Expected: all existing tests pass (no tests check `LenderType` exhaustively).

- [ ] **Step 3: Commit**

```bash
git add scraper/core/models.py
git commit -m "feat(scraper): add LenderType.OTHER for non-Big6 direct banks"
```

---

## Task 2: Site — create `lenders.ts` brand config

**Files:**
- Create: `site/src/lib/lenders.ts`

- [ ] **Step 1: Create the brand config file**

Create `site/src/lib/lenders.ts`:

```ts
export interface LenderBrand {
  bg: string;
  abbr: string;
}

export const LENDER_BRANDS: Record<string, LenderBrand> = {
  rbc:        { bg: "#005DAA", abbr: "RBC"  },
  td:         { bg: "#34B233", abbr: "TD"   },
  bmo:        { bg: "#0075BE", abbr: "BMO"  },
  scotiabank: { bg: "#EC111A", abbr: "BNS"  },
  cibc:       { bg: "#AC145A", abbr: "CIBC" },
  national:   { bg: "#E31837", abbr: "NBC"  },
  tangerine:  { bg: "#F26520", abbr: "TAN"  },
};

export function getLenderBrand(slug: string): LenderBrand {
  return LENDER_BRANDS[slug] ?? { bg: "#6c757d", abbr: slug.slice(0, 4).toUpperCase() };
}
```

- [ ] **Step 2: Run type-check to confirm no errors**

```bash
cd site && npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add site/src/lib/lenders.ts
git commit -m "feat(site): add LENDER_BRANDS config and getLenderBrand helper"
```

---

## Task 3: Site — create `LenderBadge.astro`

**Files:**
- Create: `site/src/components/LenderBadge.astro`

- [ ] **Step 1: Create the component**

Create `site/src/components/LenderBadge.astro`:

```astro
---
import { getLenderBrand } from "@lib/lenders";

interface Props {
  slug: string;
}

const { slug } = Astro.props;
const brand = getLenderBrand(slug);
---

<span class="lender-badge" style={`background:${brand.bg}`}>{brand.abbr}</span>

<style>
  .lender-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    font-family: sans-serif;
    flex-shrink: 0;
    letter-spacing: -0.3px;
    line-height: 1;
  }
</style>
```

- [ ] **Step 2: Run type-check**

```bash
cd site && npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/LenderBadge.astro
git commit -m "feat(site): add LenderBadge component with brand colour + abbreviation"
```

---

## Task 4: Site — update `LenderRow.astro` with badge

**Files:**
- Modify: `site/src/components/LenderRow.astro`

- [ ] **Step 1: Add the badge import and update the name cell**

The current `LenderRow.astro` frontmatter is:

```astro
---
import { formatPercent } from "@lib/format";
import type { Lender, Term } from "@lib/rates";
```

Change to:

```astro
---
import LenderBadge from "@components/LenderBadge.astro";
import { formatPercent } from "@lib/format";
import type { Lender, Term } from "@lib/rates";
```

The current name cell is:

```astro
  <td class="lender-row__name">
    <a href={`/lenders/${lender.slug}`}>{lender.name}</a>
  </td>
```

Change to:

```astro
  <td class="lender-row__name">
    <div class="lender-row__name-inner">
      <LenderBadge slug={lender.slug} />
      <a href={`/lenders/${lender.slug}`}>{lender.name}</a>
    </div>
  </td>
```

Then add a `<style>` block at the end of the file (after the closing `</tr>` if none exists, or append to existing):

```astro
<style>
  .lender-row__name-inner {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
```

- [ ] **Step 2: Run type-check**

```bash
cd site && npm run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/LenderRow.astro
git commit -m "feat(site): add brand badge to lender table rows"
```

---

## Task 5: Site — update `HeroFeaturedRates.astro` with badge

**Files:**
- Modify: `site/src/components/HeroFeaturedRates.astro`

- [ ] **Step 1: Add the badge import**

The current frontmatter import block is:

```astro
---
import { formatPercent, formatTermLabel } from "@lib/format";
import { bestRateForTerm, type RatesData, type Term } from "@lib/rates";
```

Change to:

```astro
---
import LenderBadge from "@components/LenderBadge.astro";
import { formatPercent, formatTermLabel } from "@lib/format";
import { bestRateForTerm, type RatesData, type Term } from "@lib/rates";
```

- [ ] **Step 2: Add badge to the lender name line in each card**

The current lender name line inside the `.map()` is:

```astro
          <p class="hero-card__lender">{best!.lender.name}</p>
```

Change to:

```astro
          <p class="hero-card__lender">
            <LenderBadge slug={best!.lender.slug} />
            {best!.lender.name}
          </p>
```

- [ ] **Step 3: Add style for the lender line**

Add a `<style>` block at the end of the file:

```astro
<style>
  .hero-card__lender {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
```

- [ ] **Step 4: Run type-check**

```bash
cd site && npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/HeroFeaturedRates.astro
git commit -m "feat(site): add brand badge to hero featured rate cards"
```

---

## Task 6: Site — expand `rates.sample.json` with four new lenders

**Files:**
- Modify: `site/src/data/rates.sample.json`

- [ ] **Step 1: Add four lender entries to the `lenders` array**

The current file ends with the `national` entry followed by `]`. Replace the full file contents with the following (preserving existing RBC/TD/National entries, appending four new ones):

```json
{
  "updated_at": "2026-04-25T10:00:00Z",
  "discount_formula": {
    "fixed": 1.50,
    "variable": 1.00,
    "heloc": null
  },
  "lenders": [
    {
      "slug": "rbc",
      "name": "RBC Royal Bank",
      "type": "big6",
      "source_url": "https://www.rbcroyalbank.com/mortgages/mortgage-rates.html",
      "affiliate_url": null,
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 5.49, "discounted": 3.99},
        {"term": "2yr_fixed",  "posted": 5.09, "discounted": 3.59},
        {"term": "3yr_fixed",  "posted": 6.05, "discounted": 4.55},
        {"term": "4yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "5yr_fixed",  "posted": 6.09, "discounted": 4.59},
        {"term": "7yr_fixed",  "posted": 6.40, "discounted": 4.90},
        {"term": "10yr_fixed", "posted": 6.80, "discounted": 5.30},
        {"term": "variable",   "posted": 4.45, "discounted": 3.45}
      ]
    },
    {
      "slug": "td",
      "name": "TD Bank",
      "type": "big6",
      "source_url": "https://www.td.com/ca/en/personal-banking/products/mortgages/mortgage-rates",
      "affiliate_url": null,
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 5.49, "discounted": 3.99},
        {"term": "2yr_fixed",  "posted": 4.89, "discounted": 3.39},
        {"term": "3yr_fixed",  "posted": 6.05, "discounted": 4.55},
        {"term": "4yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "5yr_fixed",  "posted": 6.09, "discounted": 4.59},
        {"term": "7yr_fixed",  "posted": 6.40, "discounted": 4.90},
        {"term": "10yr_fixed", "posted": 6.80, "discounted": 5.30},
        {"term": "variable",   "posted": 4.60, "discounted": 3.60}
      ]
    },
    {
      "slug": "national",
      "name": "National Bank of Canada",
      "type": "big6",
      "source_url": "https://www.nbc.ca/personal/mortgages.html",
      "affiliate_url": null,
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 5.49, "discounted": 3.99},
        {"term": "2yr_fixed",  "posted": 5.14, "discounted": 3.64},
        {"term": "3yr_fixed",  "posted": 6.05, "discounted": 4.55},
        {"term": "4yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "5yr_fixed",  "posted": 6.09, "discounted": 4.59},
        {"term": "7yr_fixed",  "posted": 6.40, "discounted": 4.90},
        {"term": "10yr_fixed", "posted": 6.80, "discounted": 5.30},
        {"term": "variable",   "posted": 4.45, "discounted": 3.45}
      ]
    },
    {
      "slug": "bmo",
      "name": "BMO Bank of Montreal",
      "type": "big6",
      "source_url": "https://www.bmo.com/en-ca/main/personal/mortgages/mortgage-rates/",
      "affiliate_url": null,
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 5.49, "discounted": 3.99},
        {"term": "2yr_fixed",  "posted": 5.09, "discounted": 3.59},
        {"term": "3yr_fixed",  "posted": 6.05, "discounted": 4.55},
        {"term": "4yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "5yr_fixed",  "posted": 6.09, "discounted": 4.59},
        {"term": "7yr_fixed",  "posted": 6.40, "discounted": 4.90},
        {"term": "10yr_fixed", "posted": 6.80, "discounted": 5.30},
        {"term": "variable",   "posted": 4.45, "discounted": 3.45}
      ]
    },
    {
      "slug": "scotiabank",
      "name": "Scotiabank",
      "type": "big6",
      "source_url": "https://www.scotiabank.com/ca/en/personal/mortgages/mortgage-rates.html",
      "affiliate_url": null,
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 5.49, "discounted": 3.99},
        {"term": "2yr_fixed",  "posted": 5.09, "discounted": 3.59},
        {"term": "3yr_fixed",  "posted": 6.05, "discounted": 4.55},
        {"term": "4yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "5yr_fixed",  "posted": 6.09, "discounted": 4.59},
        {"term": "7yr_fixed",  "posted": 6.40, "discounted": 4.90},
        {"term": "10yr_fixed", "posted": 6.80, "discounted": 5.30},
        {"term": "variable",   "posted": 4.45, "discounted": 3.45}
      ]
    },
    {
      "slug": "cibc",
      "name": "CIBC",
      "type": "big6",
      "source_url": "https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html",
      "affiliate_url": null,
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 5.49, "discounted": 3.99},
        {"term": "2yr_fixed",  "posted": 5.09, "discounted": 3.59},
        {"term": "3yr_fixed",  "posted": 6.05, "discounted": 4.55},
        {"term": "4yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "5yr_fixed",  "posted": 6.09, "discounted": 4.59},
        {"term": "7yr_fixed",  "posted": 6.40, "discounted": 4.90},
        {"term": "10yr_fixed", "posted": 6.80, "discounted": 5.30},
        {"term": "variable",   "posted": 4.45, "discounted": 3.45}
      ]
    },
    {
      "slug": "tangerine",
      "name": "Tangerine",
      "type": "other",
      "source_url": "https://www.tangerine.ca/en/rates/mortgage-rates",
      "affiliate_url": null,
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "2yr_fixed",  "posted": 5.79, "discounted": 4.29},
        {"term": "3yr_fixed",  "posted": 5.59, "discounted": 4.09},
        {"term": "4yr_fixed",  "posted": 5.49, "discounted": 3.99},
        {"term": "5yr_fixed",  "posted": 5.44, "discounted": 3.94},
        {"term": "7yr_fixed",  "posted": 5.90, "discounted": 4.40},
        {"term": "10yr_fixed", "posted": 5.90, "discounted": 4.40},
        {"term": "variable",   "posted": 4.00, "discounted": 3.00}
      ]
    }
  ]
}
```

- [ ] **Step 2: Run site tests to confirm sample data loads cleanly**

```bash
cd site && npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Run type-check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add site/src/data/rates.sample.json
git commit -m "feat(site): expand sample data with BMO, Scotiabank, CIBC, Tangerine"
```

---

## Task 7: Scraper — BMO `ManualLenderScraper`

**Files:**
- Create: `scraper/tests/fixtures/bmo.html`
- Create: `scraper/lenders/bmo.py`
- Modify: `scraper/tests/test_lenders.py`

The parse() strategy is a keyword-scanning table walker — it finds `<tr>` elements whose first `<td>` contains a term keyword, and extracts the rate from the last `<td>`. This synthetic fixture and parser serve as a testable scaffold; after capturing real BMO HTML via `scripts/manual_capture.py`, rerun the tests — if they fail, update the selectors in `parse()` and the fixture to match the real HTML structure.

- [ ] **Step 1: Create the synthetic test fixture**

Create `scraper/tests/fixtures/bmo.html`:

```html
<!DOCTYPE html>
<html>
<body>
<table class="posted-rates">
  <thead><tr><th>Mortgage</th><th>Posted Rate</th></tr></thead>
  <tbody>
    <tr><td>1-Year Fixed Closed Mortgage</td><td>5.49%</td></tr>
    <tr><td>2-Year Fixed Closed Mortgage</td><td>5.09%</td></tr>
    <tr><td>3-Year Fixed Closed Mortgage</td><td>6.05%</td></tr>
    <tr><td>4-Year Fixed Closed Mortgage</td><td>5.99%</td></tr>
    <tr><td>5-Year Fixed Closed Mortgage</td><td>6.09%</td></tr>
    <tr><td>7-Year Fixed Closed Mortgage</td><td>6.40%</td></tr>
    <tr><td>10-Year Fixed Closed Mortgage</td><td>6.80%</td></tr>
    <tr><td>Variable Rate Closed Mortgage</td><td>4.45%</td></tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: Create `scraper/lenders/bmo.py`**

```python
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
```

- [ ] **Step 3: Add BMO to `LENDER_CASES` in `test_lenders.py`**

Open `scraper/tests/test_lenders.py`. The current import block is:

```python
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.td import TDScraper
```

Change to:

```python
from lenders.bmo import BMOScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.td import TDScraper
```

The current `LENDER_CASES` list is:

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
]
```

Change to:

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
]
```

- [ ] **Step 4: Run the new test to verify it passes**

```bash
cd scraper && uv run pytest tests/test_lenders.py -v -k bmo
```

Expected output (3 passing tests):
```
PASSED tests/test_lenders.py::test_parse_extracts_required_terms[bmo]
PASSED tests/test_lenders.py::test_parse_rates_are_in_sane_range[bmo]
PASSED tests/test_lenders.py::test_parse_no_duplicate_terms[bmo]
```

- [ ] **Step 5: Commit**

```bash
git add scraper/lenders/bmo.py scraper/tests/fixtures/bmo.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add BMO ManualLenderScraper with synthetic fixture"
```

---

## Task 8: Scraper — Scotiabank `ManualLenderScraper`

**Files:**
- Create: `scraper/tests/fixtures/scotiabank.html`
- Create: `scraper/lenders/scotiabank.py`
- Modify: `scraper/tests/test_lenders.py`

Same keyword-scanning approach as BMO. After capturing real HTML via `scripts/manual_capture.py scotiabank --url https://www.scotiabank.com/ca/en/personal/mortgages/mortgage-rates.html`, rerun tests and update parse() + fixture if needed.

- [ ] **Step 1: Create the synthetic test fixture**

Create `scraper/tests/fixtures/scotiabank.html`:

```html
<!DOCTYPE html>
<html>
<body>
<table class="posted-rates">
  <thead><tr><th>Mortgage</th><th>Posted Rate</th></tr></thead>
  <tbody>
    <tr><td>1-Year Fixed Closed Mortgage</td><td>5.49%</td></tr>
    <tr><td>2-Year Fixed Closed Mortgage</td><td>5.09%</td></tr>
    <tr><td>3-Year Fixed Closed Mortgage</td><td>6.05%</td></tr>
    <tr><td>4-Year Fixed Closed Mortgage</td><td>5.99%</td></tr>
    <tr><td>5-Year Fixed Closed Mortgage</td><td>6.09%</td></tr>
    <tr><td>7-Year Fixed Closed Mortgage</td><td>6.40%</td></tr>
    <tr><td>10-Year Fixed Closed Mortgage</td><td>6.80%</td></tr>
    <tr><td>Variable Rate Closed Mortgage</td><td>4.45%</td></tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: Create `scraper/lenders/scotiabank.py`**

```python
"""Scotiabank posted mortgage rates scraper (manual-capture).

Scotiabank's rates page is WAF-protected. Rates are fetched by manually saving
the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py scotiabank \\
        --url https://www.scotiabank.com/ca/en/personal/mortgages/mortgage-rates.html

The parse() method uses a keyword-scanning table walker. If the real Scotiabank
HTML structure differs from the synthetic test fixture, update the selectors here
and replace tests/fixtures/scotiabank.html with a trimmed real snapshot.
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


class ScotiabankScraper(ManualLenderScraper):
    slug = "scotiabank"
    name = "Scotiabank"
    type = LenderType.BIG6
    source_url = "https://www.scotiabank.com/ca/en/personal/mortgages/mortgage-rates.html"
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
```

- [ ] **Step 3: Add Scotiabank to `LENDER_CASES` in `test_lenders.py`**

Current import block (after Task 7):

```python
from lenders.bmo import BMOScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.td import TDScraper
```

Change to:

```python
from lenders.bmo import BMOScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.td import TDScraper
```

Current `LENDER_CASES` (after Task 7):

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
]
```

Change to:

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(ScotiabankScraper, "scotiabank.html", id="scotiabank"),
]
```

- [ ] **Step 4: Run the new test**

```bash
cd scraper && uv run pytest tests/test_lenders.py -v -k scotiabank
```

Expected: 3 tests pass (`test_parse_extracts_required_terms[scotiabank]`, `test_parse_rates_are_in_sane_range[scotiabank]`, `test_parse_no_duplicate_terms[scotiabank]`).

- [ ] **Step 5: Commit**

```bash
git add scraper/lenders/scotiabank.py scraper/tests/fixtures/scotiabank.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add Scotiabank ManualLenderScraper with synthetic fixture"
```

---

## Task 9: Scraper — CIBC `ManualLenderScraper`

**Files:**
- Create: `scraper/tests/fixtures/cibc.html`
- Create: `scraper/lenders/cibc.py`
- Modify: `scraper/tests/test_lenders.py`

Same keyword-scanning approach. After capturing real HTML via `scripts/manual_capture.py cibc --url https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html`, rerun tests and update parse() + fixture if needed.

- [ ] **Step 1: Create the synthetic test fixture**

Create `scraper/tests/fixtures/cibc.html`:

```html
<!DOCTYPE html>
<html>
<body>
<table class="posted-rates">
  <thead><tr><th>Mortgage</th><th>Posted Rate</th></tr></thead>
  <tbody>
    <tr><td>1-Year Fixed Closed Mortgage</td><td>5.49%</td></tr>
    <tr><td>2-Year Fixed Closed Mortgage</td><td>5.09%</td></tr>
    <tr><td>3-Year Fixed Closed Mortgage</td><td>6.05%</td></tr>
    <tr><td>4-Year Fixed Closed Mortgage</td><td>5.99%</td></tr>
    <tr><td>5-Year Fixed Closed Mortgage</td><td>6.09%</td></tr>
    <tr><td>7-Year Fixed Closed Mortgage</td><td>6.40%</td></tr>
    <tr><td>10-Year Fixed Closed Mortgage</td><td>6.80%</td></tr>
    <tr><td>Variable Rate Closed Mortgage</td><td>4.45%</td></tr>
  </tbody>
</table>
</body>
</html>
```

- [ ] **Step 2: Create `scraper/lenders/cibc.py`**

```python
"""CIBC posted mortgage rates scraper (manual-capture).

CIBC's rates page uses server-side RDS% template rendering — actual rates are
injected client-side and are not available in the initial HTML. Rates are
fetched by manually saving the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py cibc \\
        --url https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html

The parse() method uses a keyword-scanning table walker. If the real CIBC HTML
structure differs from the synthetic test fixture, update the selectors here
and replace tests/fixtures/cibc.html with a trimmed real snapshot.
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
```

- [ ] **Step 3: Add CIBC to `LENDER_CASES` in `test_lenders.py`**

Current import block (after Task 8):

```python
from lenders.bmo import BMOScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.td import TDScraper
```

Change to:

```python
from lenders.bmo import BMOScraper
from lenders.cibc import CIBCScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.td import TDScraper
```

Current `LENDER_CASES` (after Task 8):

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(ScotiabankScraper, "scotiabank.html", id="scotiabank"),
]
```

Change to:

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(ScotiabankScraper, "scotiabank.html", id="scotiabank"),
    pytest.param(CIBCScraper, "cibc.html", id="cibc"),
]
```

- [ ] **Step 4: Run the new test**

```bash
cd scraper && uv run pytest tests/test_lenders.py -v -k cibc
```

Expected: 3 tests pass (`test_parse_extracts_required_terms[cibc]`, `test_parse_rates_are_in_sane_range[cibc]`, `test_parse_no_duplicate_terms[cibc]`).

- [ ] **Step 5: Commit**

```bash
git add scraper/lenders/cibc.py scraper/tests/fixtures/cibc.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add CIBC ManualLenderScraper with synthetic fixture"
```

---

## Task 10: Scraper — Tangerine `ManualLenderScraper`

**Files:**
- Create: `scraper/tests/fixtures/tangerine.html`
- Create: `scraper/lenders/tangerine.py`
- Modify: `scraper/tests/test_lenders.py`

Tangerine's rates page (`https://www.tangerine.ca/en/rates/mortgage-rates`) embeds rate data in the initial HTML and is accessible without JavaScript rendering — verified by `WebFetch` returning actual rate values. However, the exact DOM structure is unknown. The scraper uses `ManualLenderScraper` with the same keyword-scanning strategy as BMO/Scotia/CIBC. After capturing real HTML, rerun the tests — if the fixture format matches the real HTML, no changes are needed; otherwise update parse() + fixture.

Note: Tangerine shows both "Standard Rates" and "Already a Client" (preferred) rates. The `parse()` should target the **standard (higher, posted) rates** only. If both rate sections share the same table structure, the deduplication via `seen` will keep the first occurrence; verify that standard rates appear before preferred rates in the captured HTML. If not, add a section-scoping step before the `find_all("tr")` call.

- [ ] **Step 1: Create the synthetic test fixture**

Create `scraper/tests/fixtures/tangerine.html`:

```html
<!DOCTYPE html>
<html>
<body>
<div class="rate-section">
  <h3>Standard Rates</h3>
  <table class="posted-rates">
    <thead><tr><th>Mortgage</th><th>Posted Rate</th></tr></thead>
    <tbody>
      <tr><td>1-Year Fixed Mortgage</td><td>5.99%</td></tr>
      <tr><td>2-Year Fixed Mortgage</td><td>5.79%</td></tr>
      <tr><td>3-Year Fixed Mortgage</td><td>5.59%</td></tr>
      <tr><td>4-Year Fixed Mortgage</td><td>5.49%</td></tr>
      <tr><td>5-Year Fixed Mortgage</td><td>5.44%</td></tr>
      <tr><td>7-Year Fixed Mortgage</td><td>5.90%</td></tr>
      <tr><td>10-Year Fixed Mortgage</td><td>5.90%</td></tr>
      <tr><td>5-Year Variable Mortgage</td><td>4.00%</td></tr>
    </tbody>
  </table>
</div>
<div class="rate-section">
  <h3>Already a Client</h3>
  <table class="preferred-rates">
    <thead><tr><th>Mortgage</th><th>Preferred Rate</th></tr></thead>
    <tbody>
      <tr><td>5-Year Fixed Mortgage</td><td>4.84%</td></tr>
      <tr><td>5-Year Variable Mortgage</td><td>3.80%</td></tr>
    </tbody>
  </table>
</div>
</body>
</html>
```

- [ ] **Step 2: Create `scraper/lenders/tangerine.py`**

```python
"""Tangerine posted mortgage rates scraper (manual-capture).

Tangerine's rates page (https://www.tangerine.ca/en/rates/mortgage-rates)
embeds rate data in the initial HTML. Rates are fetched by manually saving
the rendered HTML via:

    cd scraper
    uv run python scripts/manual_capture.py tangerine \\
        --url https://www.tangerine.ca/en/rates/mortgage-rates

The parse() scopes to the first table on the page (Standard Rates section),
which contains posted rates. The "Already a Client" preferred-rate section
appears later and is skipped by the `seen` deduplication set. If the real HTML
uses a different structure, update the selectors here and replace
tests/fixtures/tangerine.html with a trimmed real snapshot.
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
```

- [ ] **Step 3: Add Tangerine to `LENDER_CASES` in `test_lenders.py`**

Current import block (after Task 9):

```python
from lenders.bmo import BMOScraper
from lenders.cibc import CIBCScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.td import TDScraper
```

Change to:

```python
from lenders.bmo import BMOScraper
from lenders.cibc import CIBCScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.tangerine import TangerineScraper
from lenders.td import TDScraper
```

Current `LENDER_CASES` (after Task 9):

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(ScotiabankScraper, "scotiabank.html", id="scotiabank"),
    pytest.param(CIBCScraper, "cibc.html", id="cibc"),
]
```

Change to:

```python
LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(NationalScraper, "national.html", id="national"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(ScotiabankScraper, "scotiabank.html", id="scotiabank"),
    pytest.param(CIBCScraper, "cibc.html", id="cibc"),
    pytest.param(TangerineScraper, "tangerine.html", id="tangerine"),
]
```

- [ ] **Step 4: Run the new test**

```bash
cd scraper && uv run pytest tests/test_lenders.py -v -k tangerine
```

Expected: 3 tests pass (`test_parse_extracts_required_terms[tangerine]`, `test_parse_rates_are_in_sane_range[tangerine]`, `test_parse_no_duplicate_terms[tangerine]`).

- [ ] **Step 5: Commit**

```bash
git add scraper/lenders/tangerine.py scraper/tests/fixtures/tangerine.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add Tangerine ManualLenderScraper with synthetic fixture"
```

---

## Task 11: Register all new scrapers in `cli.py`

**Files:**
- Modify: `scraper/core/cli.py`

- [ ] **Step 1: Add imports and register all new scrapers**

The current import block in `scraper/core/cli.py` is:

```python
from lenders.base import LenderScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.td import TDScraper
```

Change to:

```python
from lenders.base import LenderScraper
from lenders.bmo import BMOScraper
from lenders.cibc import CIBCScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotiabank import ScotiabankScraper
from lenders.tangerine import TangerineScraper
from lenders.td import TDScraper
```

The current `all_scrapers()` function is:

```python
def all_scrapers() -> list[LenderScraper]:
    """Return all configured lender scrapers, in display order."""
    return [
        RBCScraper(),
        TDScraper(),
        NationalScraper(),
        # Scotia/BMO/CIBC deferred to v1.1 — see scraper/README.md "Manual-source lenders"
    ]
```

Change to:

```python
def all_scrapers() -> list[LenderScraper]:
    """Return all configured lender scrapers, in display order."""
    return [
        RBCScraper(),
        TDScraper(),
        BMOScraper(),
        ScotiabankScraper(),
        CIBCScraper(),
        NationalScraper(),
        TangerineScraper(),
    ]
```

- [ ] **Step 2: Run the full test suite**

```bash
cd scraper && uv run pytest -v
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add scraper/core/cli.py
git commit -m "feat(scraper): register BMO, Scotiabank, CIBC, Tangerine in all_scrapers()"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the full scraper test suite**

```bash
cd scraper && uv run pytest -v
```

Expected: all tests pass (7 lenders × 3 tests = 21 tests, plus other test files).

- [ ] **Step 2: Run the full site test suite and type-check**

```bash
cd site && npm run check && npm run test
```

Expected: no TypeScript errors, all Vitest tests pass.

- [ ] **Step 3: Build the site locally to verify all 7 lenders render**

```bash
cd site && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

Expected: CI goes green — both `Scraper tests` and `Site build + tests` jobs pass.

---

## Post-implementation: Capture real HTML fixtures

The parsers ship with synthetic fixtures. To get live rates for BMO, Scotiabank, CIBC, and Tangerine, run the following from the repo root (requires a desktop environment with Chromium):

```bash
cd scraper

uv run python scripts/manual_capture.py bmo \
    --url https://www.bmo.com/en-ca/main/personal/mortgages/mortgage-rates/

uv run python scripts/manual_capture.py scotiabank \
    --url https://www.scotiabank.com/ca/en/personal/mortgages/mortgage-rates.html

uv run python scripts/manual_capture.py cibc \
    --url https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html

uv run python scripts/manual_capture.py tangerine \
    --url https://www.tangerine.ca/en/rates/mortgage-rates
```

For each: a Chromium window opens, wait for rates to fully render, solve any cookie banners, then press Enter. The HTML is saved to `scraper/data/manual/{slug}.html`.

After capturing, run a dry-run to confirm rates parse correctly:

```bash
uv run python -m core.cli --dry-run --verbose 2>&1 | python -m json.tool | head -100
```

If a bank's rates don't appear or look wrong, inspect the captured HTML and update the corresponding `parse()` method and `tests/fixtures/{slug}.html` to match the real structure, then rerun `uv run pytest -v` to confirm tests pass.
