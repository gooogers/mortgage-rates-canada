# Big 6 + Tangerine Lenders — Design Spec

**Date:** 2026-04-27
**Status:** Approved (pending user review)

---

## 1. Goal

Add BMO, Scotiabank, CIBC, and Tangerine to the scraper and site, and add brand-colour badges to all lender rows across the site. The result is a 7-lender rate table with visual identity for each bank.

---

## 2. Architecture Overview

Two independent tracks that can be implemented in parallel:

- **Scraper track**: 4 new lender scrapers, registered alongside existing RBC/TD/National.
- **Site track**: Brand badge config + updated components + expanded sample data.

The scraper output format (`rates.json`) does not change — new lenders are additional entries in the existing `lenders` array. No data model changes.

---

## 3. Scraper Track

### 3.1 New Lenders

| Slug | Name | Type | Fetch Strategy |
|---|---|---|---|
| `bmo` | BMO Bank of Montreal | `big6` | `ManualLenderScraper` |
| `scotiabank` | Scotiabank | `big6` | `ManualLenderScraper` |
| `cibc` | CIBC | `big6` | `ManualLenderScraper` |
| `tangerine` | Tangerine | `other` | Playwright first; fall back to `ManualLenderScraper` if WAF-blocked |

### 3.2 LenderType enum

Add `OTHER = "other"` to `scraper/core/models.py`:

```python
class LenderType(str, Enum):
    BIG6 = "big6"
    MONOLINE = "monoline"
    CREDIT_UNION = "credit_union"
    OTHER = "other"
```

### 3.3 Manual lenders (BMO, Scotiabank, CIBC)

Each extends `ManualLenderScraper` from `scraper/lenders/manual_base.py`:

- Only implements `parse(html: str) -> list[Rate]`
- Reads live snapshot from `scraper/data/manual/{slug}.html` at runtime (not committed)
- `parse()` logic written against the bank's live page DOM (inspected via WebFetch during implementation)
- Extracts posted fixed rates (1yr–10yr where available) and variable rate

### 3.4 Tangerine

Attempts Playwright render first (`LenderScraper`). If the live page is WAF-blocked during implementation, downgrades to `ManualLenderScraper`. Decision made at implementation time.

### 3.5 Test fixtures

- Trimmed real HTML (or representative synthetic HTML) saved to `scraper/tests/fixtures/{slug}.html` for each new lender
- Tests added to `scraper/tests/test_lenders.py` following existing RBC/TD/National pattern
- `scraper/data/manual/` is gitignored — live snapshots never committed

### 3.6 Registration

All new scrapers registered in `scraper/lenders/__init__.py` so the CLI runner picks them up automatically.

---

## 4. Site Track

### 4.1 Brand config

New file `site/src/lib/lenders.ts` exports a `LENDER_BRANDS` map:

```ts
export interface LenderBrand {
  bg: string;   // CSS colour for badge background
  abbr: string; // 2–4 letter abbreviation shown in badge
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
```

Unknown slugs fall back to a neutral grey badge.

### 4.2 LenderBadge component

New `site/src/components/LenderBadge.astro`:

- Props: `slug: string`, `name: string`
- Renders a 32×32 rounded square with brand background colour and white abbreviation text
- Falls back gracefully if slug not in `LENDER_BRANDS`

### 4.3 Updated components

**`LenderRow.astro`**: Replace plain lender name text with `<LenderBadge>` + name side by side.

**`HeroFeaturedRates.astro`**: Add `<LenderBadge>` beside the winning lender name on each featured rate card.

### 4.4 Sample data

`site/src/data/rates.sample.json` gains 4 new lender entries (BMO, Scotiabank, CIBC, Tangerine) with representative placeholder rates. Keeps CI and local dev rendering a full 7-lender table.

---

## 5. What Is Not Changing

- `rates.json` schema — no fields added or removed
- Routing — no new pages; existing `/lenders/[slug].astro` handles new slugs automatically
- Discount formula — same 1.5% fixed / 1.0% variable applied to new lenders
- `_headers`, `robots.txt`, staging behaviour — untouched

---

## 6. Manual Snapshot Workflow

BMO, Scotiabank, and CIBC (and Tangerine if WAF-blocked) require a manually saved HTML snapshot to produce live rates. The existing `scripts/manual_capture.py` documents the process. The operator runs it periodically (weekly-ish) to keep rates fresh. The daily cron skips lenders whose `scraper/data/manual/{slug}.html` is absent and logs a warning — it does not fail.

---

## 7. Testing

- Each new lender has at least one pytest test: `test_{slug}_parse_returns_expected_rates`
- Tests use `scraper/tests/fixtures/{slug}.html` (committed) not `scraper/data/manual/` (not committed)
- Site: `rates.sample.json` updated so existing Vitest suite continues to pass
- CI (`.github/workflows/ci.yml`) requires no changes
