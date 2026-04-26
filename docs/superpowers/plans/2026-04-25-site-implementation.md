# Astro Site Implementation Plan (v1)

> **Status:** Executed 2026-04-25. See "Execution Notes" below for what actually shipped.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static Astro site that displays Canadian mortgage rates (the user-facing product), pairs each lender's posted rate with an estimated discounted rate, and includes a standard mortgage payment calculator. The site reads `rates.json` from the scraper as its single data input.

**Architecture:** Astro 4+ static site, TypeScript throughout, plain CSS (no UI framework for v1), Vitest for unit-testing pure logic (calculator math, formatters, data loader). Site is fully static — every page is pre-rendered at build time from `rates.json`. The dynamic `/rates/[term]` and `/lenders/[slug]` pages use Astro's `getStaticPaths()` to enumerate routes from the data file. The calculator is a single client-side island; everything else is server-rendered HTML.

**Tech Stack:** Astro 4+, TypeScript 5+, Vitest 1+, plain CSS, npm.

**Spec reference:** [docs/superpowers/specs/2026-04-25-canadian-mortgage-rates-site-design.md](../specs/2026-04-25-canadian-mortgage-rates-site-design.md) — Sections 4 (pages), 5 (calculator), 6 (data model contract), 8 (legal), 9 (monetization placeholders), 10 (repo structure), 11 (deploy wiring placeholder).

**Plan 1 (scraper) is shipped:** [docs/superpowers/plans/2026-04-25-scraper-implementation.md](2026-04-25-scraper-implementation.md). Its `rates.json` schema is our input contract. v1 ships with 3 lenders (RBC, TD, National Bank); the site renders whatever the scraper produces.

**File structure produced by this plan:**

```
site/
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── scripts/
│   └── fetch-rates.mjs                # placeholder; deploy plan wires it up
└── src/
    ├── data/
    │   ├── rates.sample.json          # checked-in fallback for local dev
    │   └── rates.json                 # gitignored; populated by fetch-rates.mjs
    ├── lib/
    │   ├── rates.ts                   # types + loader for rates.json
    │   ├── calculator.ts              # mortgage math (pure)
    │   ├── format.ts                  # currency, %, date helpers
    │   ├── calculator.test.ts         # unit tests
    │   ├── format.test.ts             # unit tests
    │   └── rates.test.ts              # loader tests
    ├── styles/
    │   └── global.css
    ├── layouts/
    │   └── Base.astro
    ├── components/
    │   ├── Footer.astro
    │   ├── Disclaimer.astro
    │   ├── RateTable.astro
    │   ├── LenderRow.astro
    │   ├── HeroFeaturedRates.astro
    │   └── Calculator.astro            # client island
    └── pages/
        ├── index.astro
        ├── calculator.astro
        ├── about.astro
        ├── methodology.astro
        ├── disclosure.astro
        ├── privacy.astro
        ├── terms.astro
        ├── rates/[term].astro
        └── lenders/[slug].astro
```

---

## Task 1: Initialize Astro project

**Files:**
- Create: `site/package.json`
- Create: `site/astro.config.mjs`
- Create: `site/tsconfig.json`
- Create: `site/vitest.config.ts`
- Create: `site/.gitignore`
- Create: `site/public/robots.txt`
- Create: `site/public/favicon.svg`
- Create: `site/src/styles/global.css` (minimal reset; will grow in later tasks)

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "mortgage-rates-site",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "astro": "^4.16.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `site/astro.config.mjs`**

```javascript
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://yourdomain.ca",
  trailingSlash: "never",
  build: {
    format: "file",
  },
});
```

- [ ] **Step 3: Create `site/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@lib/*": ["lib/*"],
      "@components/*": ["components/*"],
      "@layouts/*": ["layouts/*"]
    }
  }
}
```

- [ ] **Step 4: Create `site/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globals: false,
    environment: "node",
  },
  resolve: {
    alias: {
      "@lib": new URL("./src/lib", import.meta.url).pathname,
      "@components": new URL("./src/components", import.meta.url).pathname,
      "@layouts": new URL("./src/layouts", import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 5: Create `site/.gitignore`**

```
node_modules/
dist/
.astro/
src/data/rates.json
.env
.env.*
!.env.example
```

- [ ] **Step 6: Create `site/public/robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://yourdomain.ca/sitemap.xml
```

- [ ] **Step 7: Create `site/public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0a7"/><text x="16" y="22" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#fff" text-anchor="middle">%</text></svg>
```

- [ ] **Step 8: Create minimal `site/src/styles/global.css`**

```css
:root {
  --color-bg: #ffffff;
  --color-fg: #1a1a1a;
  --color-muted: #6b7280;
  --color-accent: #0a7;
  --color-accent-fg: #ffffff;
  --color-border: #e5e7eb;
  --color-row-alt: #f9fafb;
  --max-width: 1100px;
  --font-stack: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-stack);
  color: var(--color-fg);
  background: var(--color-bg);
  line-height: 1.5;
}

main {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 1rem;
}

a {
  color: var(--color-accent);
}
```

- [ ] **Step 9: Install dependencies**

Run from the repo root:
```
cd site && npm install
```
Expected: creates `node_modules/` and `package-lock.json` without error.

- [ ] **Step 10: Verify Astro and Vitest work**

```
cd site && npx astro --version && npx vitest --version
```
Expected: prints two version numbers (Astro >= 4.16, Vitest >= 2.1).

- [ ] **Step 11: Commit**

```
git add site/package.json site/package-lock.json site/astro.config.mjs site/tsconfig.json site/vitest.config.ts site/.gitignore site/public/ site/src/styles/global.css
git commit -m "chore(site): initialize Astro project"
```

---

## Task 2: Add `rates.sample.json` fallback fixture

**Files:**
- Create: `site/src/data/rates.sample.json`

This file is the data contract test fixture — it's read by local dev when no `rates.json` exists, and by tests in Task 4. It must match the spec's data model exactly.

- [ ] **Step 1: Create `site/src/data/rates.sample.json`**

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
    }
  ]
}
```

- [ ] **Step 2: Commit**

```
git add site/src/data/rates.sample.json
git commit -m "feat(site): add rates.sample.json fallback fixture"
```

---

## Task 3: Implement `lib/format.ts` (formatters) with TDD

**Files:**
- Create: `site/src/lib/format.test.ts`
- Create: `site/src/lib/format.ts`

- [ ] **Step 1: Write failing tests**

Create `site/src/lib/format.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatTermLabel,
  formatUpdatedAt,
} from "@lib/format";

describe("formatCurrency", () => {
  it("formats whole dollars with $ and thousands separator", () => {
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("rounds to whole dollars by default", () => {
    expect(formatCurrency(1234.56)).toBe("$1,235");
  });

  it("supports a 2-decimal cents mode", () => {
    expect(formatCurrency(1234.56, { cents: true })).toBe("$1,234.56");
  });
});

describe("formatPercent", () => {
  it("formats with two decimals and a percent sign", () => {
    expect(formatPercent(5.69)).toBe("5.69%");
  });

  it("formats integer values with two decimals", () => {
    expect(formatPercent(5)).toBe("5.00%");
  });

  it("returns an em-dash for null", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatTermLabel", () => {
  it("formats yearly terms as 'N-Year Fixed'", () => {
    expect(formatTermLabel("5yr_fixed")).toBe("5-Year Fixed");
    expect(formatTermLabel("10yr_fixed")).toBe("10-Year Fixed");
  });

  it("formats variable as 'Variable'", () => {
    expect(formatTermLabel("variable")).toBe("Variable");
  });

  it("formats heloc as 'HELOC'", () => {
    expect(formatTermLabel("heloc")).toBe("HELOC");
  });
});

describe("formatUpdatedAt", () => {
  it("formats an ISO timestamp as a human-friendly date", () => {
    expect(formatUpdatedAt("2026-04-25T10:00:00Z")).toMatch(
      /April 25, 2026/,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd site && npm test
```
Expected: FAIL with `Cannot find module '@lib/format'`.

- [ ] **Step 3: Implement `site/src/lib/format.ts`**

```typescript
/**
 * Display-formatting helpers. Pure functions, no side effects.
 */

const TERM_LABELS: Record<string, string> = {
  "1yr_fixed": "1-Year Fixed",
  "2yr_fixed": "2-Year Fixed",
  "3yr_fixed": "3-Year Fixed",
  "4yr_fixed": "4-Year Fixed",
  "5yr_fixed": "5-Year Fixed",
  "7yr_fixed": "7-Year Fixed",
  "10yr_fixed": "10-Year Fixed",
  variable: "Variable",
  heloc: "HELOC",
};

export function formatCurrency(
  value: number,
  options: { cents?: boolean } = {},
): string {
  const fractionDigits = options.cents ? 2 : 0;
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    currencyDisplay: "narrowSymbol",
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
}

export function formatTermLabel(term: string): string {
  return TERM_LABELS[term] ?? term;
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd site && npm test
```
Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```
git add site/src/lib/format.ts site/src/lib/format.test.ts
git commit -m "feat(site): add format helpers (currency, percent, term, date)"
```

---

## Task 4: Implement `lib/rates.ts` (types + loader) with TDD

**Files:**
- Create: `site/src/lib/rates.test.ts`
- Create: `site/src/lib/rates.ts`

- [ ] **Step 1: Write failing tests**

Create `site/src/lib/rates.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  bestRateForTerm,
  loadRatesData,
  ratesByTerm,
  type Term,
} from "@lib/rates";

describe("loadRatesData", () => {
  it("loads and parses the sample rates file", async () => {
    const data = await loadRatesData();
    expect(data.lenders.length).toBeGreaterThan(0);
    expect(data.discount_formula.fixed).toBe(1.5);
    expect(data.lenders[0].slug).toBe("rbc");
  });
});

describe("bestRateForTerm", () => {
  it("returns the lender with the lowest discounted rate for a term", async () => {
    const data = await loadRatesData();
    const best = bestRateForTerm(data, "5yr_fixed");
    expect(best).not.toBeNull();
    expect(best!.lender.slug).toBeDefined();
    expect(best!.rate.term).toBe("5yr_fixed");
    // Sample's lowest 5yr discounted = 4.59 across RBC/TD/National (all tied)
    expect(best!.rate.discounted).toBe(4.59);
  });

  it("returns null when no lender offers that term", async () => {
    const data = await loadRatesData();
    const best = bestRateForTerm(data, "heloc");
    expect(best).toBeNull();
  });

  it("ignores lenders whose rate has discounted=null for that term", async () => {
    const data = {
      ...(await loadRatesData()),
      lenders: [
        {
          slug: "x",
          name: "X",
          type: "big6" as const,
          source_url: "",
          affiliate_url: null,
          scraped_at: "2026-04-25T10:00:00Z",
          rates: [{ term: "heloc" as Term, posted: 7.2, discounted: null }],
        },
      ],
    };
    expect(bestRateForTerm(data, "heloc")).toBeNull();
  });
});

describe("ratesByTerm", () => {
  it("returns one entry per lender for the given term, sorted by discounted asc", async () => {
    const data = await loadRatesData();
    const entries = ratesByTerm(data, "5yr_fixed");
    expect(entries.length).toBe(data.lenders.length);
    // Sorted ascending by discounted
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1].rate.discounted ?? Infinity;
      const cur = entries[i].rate.discounted ?? Infinity;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });

  it("omits lenders that don't offer the requested term", async () => {
    const data = await loadRatesData();
    const entries = ratesByTerm(data, "heloc");
    expect(entries.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd site && npm test -- rates
```
Expected: FAIL with `Cannot find module '@lib/rates'`.

- [ ] **Step 3: Implement `site/src/lib/rates.ts`**

```typescript
/**
 * Types and loader for the rates.json contract produced by the scraper.
 *
 * At build time we read either:
 *   - src/data/rates.json (populated by scripts/fetch-rates.mjs in production)
 *   - src/data/rates.sample.json (fallback for local dev when no rates.json exists)
 */
import sample from "../data/rates.sample.json";

export type Term =
  | "1yr_fixed"
  | "2yr_fixed"
  | "3yr_fixed"
  | "4yr_fixed"
  | "5yr_fixed"
  | "7yr_fixed"
  | "10yr_fixed"
  | "variable"
  | "heloc";

export type LenderType = "big6" | "monoline" | "credit_union";

export interface Rate {
  term: Term;
  posted: number;
  discounted: number | null;
}

export interface Lender {
  slug: string;
  name: string;
  type: LenderType;
  source_url: string;
  affiliate_url: string | null;
  scraped_at: string;
  rates: Rate[];
}

export interface DiscountFormula {
  fixed: number | null;
  variable: number | null;
  heloc: number | null;
}

export interface RatesData {
  updated_at: string;
  discount_formula: DiscountFormula;
  lenders: Lender[];
}

/**
 * Load rates data. Tries src/data/rates.json first; falls back to the sample.
 * Async to leave room for future build-time fetches without changing the API.
 */
export async function loadRatesData(): Promise<RatesData> {
  try {
    const real = await import("../data/rates.json");
    return real.default as RatesData;
  } catch {
    return sample as RatesData;
  }
}

export interface BestRate {
  lender: Lender;
  rate: Rate;
}

/** Return the lender + rate with the lowest `discounted` for the given term, or null. */
export function bestRateForTerm(data: RatesData, term: Term): BestRate | null {
  let best: BestRate | null = null;
  for (const lender of data.lenders) {
    for (const rate of lender.rates) {
      if (rate.term !== term) continue;
      if (rate.discounted === null || rate.discounted === undefined) continue;
      if (best === null || rate.discounted < best.rate.discounted!) {
        best = { lender, rate };
      }
    }
  }
  return best;
}

/** Return one (lender, rate) entry per lender for the given term, sorted by discounted ascending. */
export function ratesByTerm(data: RatesData, term: Term): BestRate[] {
  const entries: BestRate[] = [];
  for (const lender of data.lenders) {
    const rate = lender.rates.find((r) => r.term === term);
    if (rate) entries.push({ lender, rate });
  }
  entries.sort((a, b) => {
    const av = a.rate.discounted ?? Infinity;
    const bv = b.rate.discounted ?? Infinity;
    return av - bv;
  });
  return entries;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd site && npm test -- rates
```
Expected: all 5 rates tests PASS. Full test count: 11 (format) + 5 (rates) = 16.

- [ ] **Step 5: Commit**

```
git add site/src/lib/rates.ts site/src/lib/rates.test.ts
git commit -m "feat(site): add rates loader + types + best/by-term helpers"
```

---

## Task 5: Implement `lib/calculator.ts` (mortgage math) with TDD

**Files:**
- Create: `site/src/lib/calculator.test.ts`
- Create: `site/src/lib/calculator.ts`

- [ ] **Step 1: Write failing tests**

Create `site/src/lib/calculator.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  calculateMortgage,
  cmhcPremiumRate,
  type Frequency,
} from "@lib/calculator";

describe("cmhcPremiumRate", () => {
  it("returns 0 when down payment is 20% or more", () => {
    expect(cmhcPremiumRate(0.20)).toBe(0);
    expect(cmhcPremiumRate(0.50)).toBe(0);
  });

  it("returns 4.00% when down payment is between 5% and 9.99%", () => {
    expect(cmhcPremiumRate(0.05)).toBe(0.04);
    expect(cmhcPremiumRate(0.0999)).toBe(0.04);
  });

  it("returns 3.10% when down payment is 10–14.99%", () => {
    expect(cmhcPremiumRate(0.10)).toBe(0.031);
    expect(cmhcPremiumRate(0.149)).toBe(0.031);
  });

  it("returns 2.80% when down payment is 15–19.99%", () => {
    expect(cmhcPremiumRate(0.15)).toBe(0.028);
    expect(cmhcPremiumRate(0.1999)).toBe(0.028);
  });

  it("throws when down payment is below the 5% minimum", () => {
    expect(() => cmhcPremiumRate(0.04)).toThrow();
  });
});

describe("calculateMortgage", () => {
  // Reference scenario: $500k home, 20% down, 5% rate, 25yr, monthly
  // Loan = $400k. Monthly payment ≈ $2,326.92.
  it("computes monthly payment for a 20% down conventional mortgage", () => {
    const result = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "monthly",
    });
    expect(result.cmhcPremium).toBe(0);
    expect(result.principal).toBe(400_000);
    expect(result.totalLoan).toBe(400_000);
    expect(result.payment).toBeCloseTo(2326.92, 0);
    expect(result.totalPaid).toBeCloseTo(2326.92 * 12 * 25, -2);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - 400_000, -2);
  });

  // Insured scenario: $500k home, 5% down, 5% rate, 25yr, monthly
  // Down = $25k. Loan-before-CMHC = $475k. CMHC = 4% × $475k = $19,000.
  // Total loan = $494,000. Monthly payment ≈ $2,873.95.
  it("adds CMHC insurance to the loan when down payment is below 20%", () => {
    const result = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.05,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "monthly",
    });
    expect(result.cmhcPremium).toBe(19_000);
    expect(result.totalLoan).toBe(494_000);
    expect(result.payment).toBeCloseTo(2873.95, 0);
  });

  it("supports bi-weekly frequency (26 payments per year)", () => {
    const monthly = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "monthly",
    });
    const biweekly = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "biweekly",
    });
    // Bi-weekly payment ≈ monthly × 12/26
    expect(biweekly.payment).toBeCloseTo(monthly.payment * 12 / 26, 0);
  });

  it("supports accelerated bi-weekly frequency (monthly / 2)", () => {
    const monthly = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "monthly",
    });
    const accelerated = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "accelerated_biweekly",
    });
    // Accelerated bi-weekly = monthly / 2 (so 26 × half-monthly = 13 × monthly per year)
    expect(accelerated.payment).toBeCloseTo(monthly.payment / 2, 1);
  });

  it("handles a 0% rate as straight division of principal by number of payments", () => {
    const result = calculateMortgage({
      homePrice: 240_000,
      downPaymentPct: 0.20,
      annualRatePct: 0,
      amortizationYears: 20,
      frequency: "monthly",
    });
    // Loan = 192,000; payments = 240; per payment = 800
    expect(result.principal).toBe(192_000);
    expect(result.payment).toBeCloseTo(800, 2);
    expect(result.totalInterest).toBeCloseTo(0, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd site && npm test -- calculator
```
Expected: FAIL with `Cannot find module '@lib/calculator'`.

- [ ] **Step 3: Implement `site/src/lib/calculator.ts`**

```typescript
/**
 * Canadian mortgage payment math. Pure functions.
 *
 * Canadian mortgages are compounded semi-annually but paid monthly (or more
 * frequently). The standard payment formula is:
 *
 *   P = L × i / (1 - (1 + i)^(-n))
 *
 * where L is the loan amount, i is the periodic interest rate, and n is the
 * total number of payments. The periodic rate is derived from the annual rate
 * with semi-annual compounding:
 *
 *   r_eff = (1 + annual_rate / 2)^2 - 1   (effective annual rate)
 *   i = (1 + r_eff)^(periods_per_year ^ -1) - 1   (periodic rate)
 */

export type Frequency = "monthly" | "biweekly" | "accelerated_biweekly";

export interface MortgageInput {
  homePrice: number;
  downPaymentPct: number; // 0.05 = 5%
  annualRatePct: number; // 5.69 = 5.69%
  amortizationYears: number;
  frequency: Frequency;
}

export interface MortgageResult {
  /** Loan amount before CMHC premium. */
  principal: number;
  /** CMHC insurance premium in dollars (0 if down >= 20%). */
  cmhcPremium: number;
  /** Loan amount including CMHC premium. */
  totalLoan: number;
  /** Per-payment dollar amount. */
  payment: number;
  /** Number of payments per year for the chosen frequency. */
  paymentsPerYear: number;
  /** Total amount paid over the amortization (payments × periods). */
  totalPaid: number;
  /** Total interest paid (totalPaid - totalLoan). */
  totalInterest: number;
}

const PAYMENTS_PER_YEAR: Record<Frequency, number> = {
  monthly: 12,
  biweekly: 26,
  accelerated_biweekly: 26,
};

/** Required CMHC premium rate as a fraction of the loan. 0 = no CMHC required. */
export function cmhcPremiumRate(downPaymentPct: number): number {
  if (downPaymentPct < 0.05) {
    throw new Error("Down payment must be at least 5% in Canada.");
  }
  if (downPaymentPct >= 0.20) return 0;
  if (downPaymentPct >= 0.15) return 0.028;
  if (downPaymentPct >= 0.10) return 0.031;
  return 0.04; // 5.00–9.99%
}

export function calculateMortgage(input: MortgageInput): MortgageResult {
  const { homePrice, downPaymentPct, annualRatePct, amortizationYears, frequency } =
    input;

  const downPayment = homePrice * downPaymentPct;
  const principal = homePrice - downPayment;
  const cmhcPremium = principal * cmhcPremiumRate(downPaymentPct);
  const totalLoan = principal + cmhcPremium;

  const paymentsPerYear = PAYMENTS_PER_YEAR[frequency];
  const totalPayments = paymentsPerYear * amortizationYears;

  const payment = computePayment(
    totalLoan,
    annualRatePct,
    frequency,
    amortizationYears,
  );

  const totalPaid = payment * totalPayments;
  const totalInterest = totalPaid - totalLoan;

  return {
    principal,
    cmhcPremium,
    totalLoan,
    payment,
    paymentsPerYear,
    totalPaid,
    totalInterest,
  };
}

function computePayment(
  totalLoan: number,
  annualRatePct: number,
  frequency: Frequency,
  amortizationYears: number,
): number {
  const paymentsPerYear = PAYMENTS_PER_YEAR[frequency];
  const totalPayments = paymentsPerYear * amortizationYears;

  if (annualRatePct === 0) {
    return totalLoan / totalPayments;
  }

  // Canadian convention: nominal annual rate compounded semi-annually.
  const annualRate = annualRatePct / 100;
  const effectiveAnnual = Math.pow(1 + annualRate / 2, 2) - 1;

  if (frequency === "accelerated_biweekly") {
    // Compute the monthly payment, then divide by 2.
    const monthlyRate = Math.pow(1 + effectiveAnnual, 1 / 12) - 1;
    const monthlyPayments = 12 * amortizationYears;
    const monthlyPayment =
      (totalLoan * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -monthlyPayments));
    return monthlyPayment / 2;
  }

  const periodicRate = Math.pow(1 + effectiveAnnual, 1 / paymentsPerYear) - 1;
  return (
    (totalLoan * periodicRate) /
    (1 - Math.pow(1 + periodicRate, -totalPayments))
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd site && npm test -- calculator
```
Expected: all 9 calculator tests PASS. Full count: 11 + 5 + 9 = 25.

- [ ] **Step 5: Commit**

```
git add site/src/lib/calculator.ts site/src/lib/calculator.test.ts
git commit -m "feat(site): add mortgage math (semi-annual compounding, CMHC, frequencies)"
```

---

## Task 6: Build Base layout + Footer + Disclaimer components

**Files:**
- Create: `site/src/layouts/Base.astro`
- Create: `site/src/components/Footer.astro`
- Create: `site/src/components/Disclaimer.astro`
- Modify: `site/src/styles/global.css` (append layout/footer styles)

- [ ] **Step 1: Create `site/src/components/Disclaimer.astro`**

```astro
---
interface Props {
  variant?: "rate" | "footer";
}
const { variant = "rate" } = Astro.props;
---

{
  variant === "rate" && (
    <p class="disclaimer disclaimer--rate">
      Rates shown are estimates updated daily and are not an offer of credit.
      Actual rates require lender approval and may differ. Discounted rates are
      illustrative estimates of typical broker-channel pricing — see our
      <a href="/methodology">methodology</a>.
    </p>
  )
}

{
  variant === "footer" && (
    <p class="disclaimer disclaimer--footer">
      The information on this site is for general purposes only and is not
      financial advice. We may earn a commission when you apply through some
      lender links — see our <a href="/disclosure">affiliate disclosure</a>.
    </p>
  )
}
```

- [ ] **Step 2: Create `site/src/components/Footer.astro`**

```astro
---
import Disclaimer from "@components/Disclaimer.astro";
---

<footer class="site-footer">
  <Disclaimer variant="footer" />
  <nav class="site-footer__nav">
    <a href="/about">About</a>
    <a href="/methodology">Methodology</a>
    <a href="/disclosure">Disclosure</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
  </nav>
  <p class="site-footer__credit">© {new Date().getFullYear()} Mortgage Rates Canada</p>
</footer>
```

- [ ] **Step 3: Create `site/src/layouts/Base.astro`**

```astro
---
import Footer from "@components/Footer.astro";
import "../styles/global.css";

interface Props {
  title: string;
  description?: string;
  canonical?: string;
}

const { title, description, canonical } = Astro.props;
const fullTitle = title.includes("Mortgage Rates Canada")
  ? title
  : `${title} — Mortgage Rates Canada`;
---

<!doctype html>
<html lang="en-CA">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    {description && <meta name="description" content={description} />}
    {canonical && <link rel="canonical" href={canonical} />}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <header class="site-header">
      <a href="/" class="site-header__brand">Mortgage Rates Canada</a>
      <nav class="site-header__nav">
        <a href="/">Rates</a>
        <a href="/calculator">Calculator</a>
      </nav>
    </header>
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 4: Append layout / header / footer styles to `site/src/styles/global.css`**

Open `site/src/styles/global.css` and append:

```css
/* Header */
.site-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.site-header__brand {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-fg);
  text-decoration: none;
}

.site-header__nav a {
  margin-left: 1rem;
  color: var(--color-fg);
  text-decoration: none;
}

.site-header__nav a:hover {
  text-decoration: underline;
}

/* Footer */
.site-footer {
  max-width: var(--max-width);
  margin: 3rem auto 1rem;
  padding: 1rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.9rem;
  color: var(--color-muted);
}

.site-footer__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.5rem 0;
}

.site-footer__nav a {
  color: var(--color-muted);
  text-decoration: none;
}

.site-footer__nav a:hover {
  text-decoration: underline;
}

.site-footer__credit {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
}

/* Disclaimers */
.disclaimer {
  font-size: 0.85rem;
  color: var(--color-muted);
  margin: 0.5rem 0;
}

.disclaimer--rate {
  background: var(--color-row-alt);
  border-left: 3px solid var(--color-accent);
  padding: 0.75rem 1rem;
}
```

- [ ] **Step 5: Smoke-test the build**

Create a temporary `site/src/pages/index.astro`:

```astro
---
import Base from "@layouts/Base.astro";
---

<Base title="Mortgage Rates Canada" description="Compare current Canadian mortgage rates.">
  <h1>Mortgage Rates Canada</h1>
  <p>Hello world (temporary placeholder — replaced in Task 10).</p>
</Base>
```

Run:
```
cd site && npm run build
```
Expected: build succeeds; `dist/index.html` is produced and contains the title and footer.

- [ ] **Step 6: Commit**

```
git add site/src/layouts/Base.astro site/src/components/Footer.astro site/src/components/Disclaimer.astro site/src/styles/global.css site/src/pages/index.astro
git commit -m "feat(site): add Base layout, Footer, Disclaimer components"
```

---

## Task 7: Build `RateTable` and `LenderRow` components

**Files:**
- Create: `site/src/components/LenderRow.astro`
- Create: `site/src/components/RateTable.astro`
- Modify: `site/src/styles/global.css` (append table styles)

- [ ] **Step 1: Create `site/src/components/LenderRow.astro`**

```astro
---
import { formatPercent } from "@lib/format";
import type { Lender, Term } from "@lib/rates";

interface Props {
  lender: Lender;
  terms: Term[];
}

const { lender, terms } = Astro.props;

function rateFor(term: Term) {
  return lender.rates.find((r) => r.term === term);
}
---

<tr class="lender-row">
  <td class="lender-row__name">
    <a href={`/lenders/${lender.slug}`}>{lender.name}</a>
  </td>
  {
    terms.map((term) => {
      const rate = rateFor(term);
      return (
        <td class="lender-row__rate">
          {rate ? (
            <>
              <s class="lender-row__posted">{formatPercent(rate.posted)}</s>
              <br />
              <strong class="lender-row__discounted">
                {formatPercent(rate.discounted)}
              </strong>
            </>
          ) : (
            "—"
          )}
        </td>
      );
    })
  }
  <td class="lender-row__cta">
    {
      lender.affiliate_url ? (
        <a class="cta" href={lender.affiliate_url} rel="sponsored noopener" target="_blank">
          Apply →
        </a>
      ) : (
        <a class="cta cta--secondary" href={lender.source_url} rel="noopener" target="_blank">
          Visit lender →
        </a>
      )
    }
  </td>
</tr>
```

- [ ] **Step 2: Create `site/src/components/RateTable.astro`**

```astro
---
import LenderRow from "@components/LenderRow.astro";
import { formatTermLabel } from "@lib/format";
import type { RatesData, Term } from "@lib/rates";

interface Props {
  data: RatesData;
  terms?: Term[];
}

const DEFAULT_TERMS: Term[] = ["3yr_fixed", "5yr_fixed", "variable"];
const { data, terms = DEFAULT_TERMS } = Astro.props;
---

<div class="rate-table-wrap">
  <table class="rate-table">
    <thead>
      <tr>
        <th>Lender</th>
        {terms.map((t) => <th>{formatTermLabel(t)}</th>)}
        <th></th>
      </tr>
    </thead>
    <tbody>
      {data.lenders.map((lender) => <LenderRow lender={lender} terms={terms} />)}
    </tbody>
  </table>
  <p class="rate-table__legend">
    <s>Posted</s> &nbsp; <strong>Estimated discounted</strong>
  </p>
</div>
```

- [ ] **Step 3: Append table styles to `site/src/styles/global.css`**

```css
/* Rate table */
.rate-table-wrap {
  overflow-x: auto;
}

.rate-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.rate-table th,
.rate-table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.rate-table th {
  background: var(--color-row-alt);
  font-weight: 600;
  font-size: 0.9rem;
}

.rate-table tbody tr:hover {
  background: var(--color-row-alt);
}

.lender-row__posted {
  font-size: 0.8rem;
  color: var(--color-muted);
}

.lender-row__discounted {
  color: var(--color-accent);
  font-size: 1rem;
}

.lender-row__name a {
  color: var(--color-fg);
  text-decoration: none;
  font-weight: 600;
}

.lender-row__name a:hover {
  text-decoration: underline;
}

.cta {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  background: var(--color-accent);
  color: var(--color-accent-fg);
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.9rem;
  white-space: nowrap;
}

.cta:hover {
  filter: brightness(0.92);
}

.cta--secondary {
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
}

.rate-table__legend {
  font-size: 0.85rem;
  color: var(--color-muted);
  margin: 0.5rem 0 0;
}
```

- [ ] **Step 4: Verify the build still succeeds**

```
cd site && npm run build
```
Expected: success.

- [ ] **Step 5: Commit**

```
git add site/src/components/LenderRow.astro site/src/components/RateTable.astro site/src/styles/global.css
git commit -m "feat(site): add RateTable and LenderRow components"
```

---

## Task 8: Build `HeroFeaturedRates` component

**Files:**
- Create: `site/src/components/HeroFeaturedRates.astro`
- Modify: `site/src/styles/global.css` (append hero styles)

- [ ] **Step 1: Create `site/src/components/HeroFeaturedRates.astro`**

```astro
---
import { formatPercent, formatTermLabel } from "@lib/format";
import { bestRateForTerm, type RatesData, type Term } from "@lib/rates";

interface Props {
  data: RatesData;
  /** Which terms to feature in the hero (default 5yr_fixed and variable). */
  featured?: Term[];
}

const DEFAULT_FEATURED: Term[] = ["5yr_fixed", "variable"];
const { data, featured = DEFAULT_FEATURED } = Astro.props;

const cards = featured
  .map((term) => ({ term, best: bestRateForTerm(data, term) }))
  .filter((c) => c.best !== null);
---

<section class="hero">
  <h1 class="hero__title">Today's Lowest Canadian Mortgage Rates</h1>
  <div class="hero__cards">
    {
      cards.map(({ term, best }) => (
        <article class="hero-card">
          <p class="hero-card__label">Best {formatTermLabel(term)}</p>
          <p class="hero-card__rate">{formatPercent(best!.rate.discounted)}</p>
          <p class="hero-card__lender">{best!.lender.name}</p>
          {best!.lender.affiliate_url ? (
            <a
              class="cta"
              href={best!.lender.affiliate_url}
              rel="sponsored noopener"
              target="_blank"
            >
              Get this rate →
            </a>
          ) : (
            <a
              class="cta cta--secondary"
              href={`/lenders/${best!.lender.slug}`}
            >
              View lender →
            </a>
          )}
        </article>
      ))
    }
  </div>
</section>
```

- [ ] **Step 2: Append hero styles to `site/src/styles/global.css`**

```css
/* Hero */
.hero {
  margin: 1.5rem 0;
}

.hero__title {
  font-size: 1.75rem;
  margin: 0 0 1rem;
}

.hero__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.hero-card {
  background: var(--color-accent);
  color: var(--color-accent-fg);
  padding: 1.25rem;
  border-radius: 8px;
  text-align: center;
}

.hero-card__label {
  font-size: 0.85rem;
  opacity: 0.9;
  margin: 0 0 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-card__rate {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
  line-height: 1.1;
}

.hero-card__lender {
  margin: 0.25rem 0 0.75rem;
  font-size: 0.95rem;
}

.hero-card .cta {
  background: var(--color-accent-fg);
  color: var(--color-accent);
  margin-top: 0.5rem;
}

.hero-card .cta--secondary {
  background: transparent;
  color: var(--color-accent-fg);
  border-color: var(--color-accent-fg);
}
```

- [ ] **Step 3: Verify the build succeeds**

```
cd site && npm run build
```
Expected: success.

- [ ] **Step 4: Commit**

```
git add site/src/components/HeroFeaturedRates.astro site/src/styles/global.css
git commit -m "feat(site): add HeroFeaturedRates component"
```

---

## Task 9: Build `Calculator` client island

**Files:**
- Create: `site/src/components/Calculator.astro`
- Modify: `site/src/styles/global.css` (append calculator styles)

This is the only client-side island in the site. It uses inline `<script>` rather than a separate `client:` directive so the calc logic is loaded on every page that includes it.

- [ ] **Step 1: Create `site/src/components/Calculator.astro`**

```astro
---
import { bestRateForTerm, loadRatesData } from "@lib/rates";

const data = await loadRatesData();
const best = bestRateForTerm(data, "5yr_fixed");
const defaultRate = best?.rate.discounted ?? 5.0;
---

<form class="calculator" data-default-rate={defaultRate}>
  <h2 class="calculator__title">Mortgage payment calculator</h2>
  <div class="calculator__grid">
    <label class="calculator__field">
      Home price
      <input type="number" name="homePrice" min="0" step="1000" value="600000" required />
    </label>

    <label class="calculator__field">
      Down payment %
      <input type="number" name="downPct" min="5" max="90" step="0.5" value="20" required />
    </label>

    <label class="calculator__field">
      Rate %
      <input type="number" name="rate" min="0" max="20" step="0.01" value={defaultRate} required />
    </label>

    <label class="calculator__field">
      Amortization (years)
      <select name="amortization">
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="15">15</option>
        <option value="20">20</option>
        <option value="25" selected>25</option>
        <option value="30">30</option>
      </select>
    </label>

    <label class="calculator__field">
      Frequency
      <select name="frequency">
        <option value="monthly" selected>Monthly</option>
        <option value="biweekly">Bi-weekly</option>
        <option value="accelerated_biweekly">Accelerated bi-weekly</option>
      </select>
    </label>
  </div>

  <div class="calculator__results">
    <div class="calculator__result">
      <span class="calculator__result-label">Payment</span>
      <span class="calculator__result-value" data-result="payment">$0</span>
    </div>
    <div class="calculator__result">
      <span class="calculator__result-label">CMHC premium</span>
      <span class="calculator__result-value" data-result="cmhc">$0</span>
    </div>
    <div class="calculator__result">
      <span class="calculator__result-label">Total interest</span>
      <span class="calculator__result-value" data-result="interest">$0</span>
    </div>
    <div class="calculator__result">
      <span class="calculator__result-label">Total cost</span>
      <span class="calculator__result-value" data-result="total">$0</span>
    </div>
  </div>
</form>

<script>
  import { calculateMortgage, type Frequency } from "@lib/calculator";
  import { formatCurrency } from "@lib/format";

  const form = document.querySelector<HTMLFormElement>(".calculator");
  if (!form) throw new Error("calculator form not found");

  function read(name: string): number {
    const el = form!.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
    return parseFloat(el.value);
  }

  function readString(name: string): string {
    const el = form!.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
    return el.value;
  }

  function setText(selector: string, value: string) {
    const el = form!.querySelector(selector);
    if (el) el.textContent = value;
  }

  function recalc() {
    try {
      const result = calculateMortgage({
        homePrice: read("homePrice"),
        downPaymentPct: read("downPct") / 100,
        annualRatePct: read("rate"),
        amortizationYears: read("amortization"),
        frequency: readString("frequency") as Frequency,
      });
      setText("[data-result='payment']", formatCurrency(result.payment, { cents: true }));
      setText("[data-result='cmhc']", formatCurrency(result.cmhcPremium));
      setText("[data-result='interest']", formatCurrency(result.totalInterest));
      setText("[data-result='total']", formatCurrency(result.totalPaid));
      updateUrl();
    } catch (err) {
      // Most likely: down payment < 5%. Show dashes rather than crashing.
      setText("[data-result='payment']", "—");
      setText("[data-result='cmhc']", "—");
      setText("[data-result='interest']", "—");
      setText("[data-result='total']", "—");
    }
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("price", String(read("homePrice")));
    url.searchParams.set("down", String(read("downPct")));
    url.searchParams.set("rate", String(read("rate")));
    url.searchParams.set("am", String(read("amortization")));
    url.searchParams.set("freq", readString("frequency"));
    window.history.replaceState({}, "", url);
  }

  function applyUrl() {
    const params = new URLSearchParams(window.location.search);
    const map: Record<string, string> = {
      price: "homePrice",
      down: "downPct",
      rate: "rate",
      am: "amortization",
      freq: "frequency",
    };
    for (const [param, name] of Object.entries(map)) {
      const v = params.get(param);
      if (v === null) continue;
      const el = form!.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
      if (el) el.value = v;
    }
  }

  applyUrl();
  recalc();
  form.addEventListener("input", recalc);
  form.addEventListener("change", recalc);
</script>
```

- [ ] **Step 2: Append calculator styles to `site/src/styles/global.css`**

```css
/* Calculator */
.calculator {
  background: var(--color-row-alt);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1.5rem 0;
}

.calculator__title {
  margin: 0 0 1rem;
  font-size: 1.25rem;
}

.calculator__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

.calculator__field {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  font-weight: 500;
  gap: 0.25rem;
}

.calculator__field input,
.calculator__field select {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.calculator__results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.calculator__result {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.calculator__result-label {
  font-size: 0.8rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.calculator__result-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-accent);
}
```

- [ ] **Step 3: Verify the build succeeds**

```
cd site && npm run build
```
Expected: success. The build output should include the calculator's inline JS bundled.

- [ ] **Step 4: Commit**

```
git add site/src/components/Calculator.astro site/src/styles/global.css
git commit -m "feat(site): add Calculator client island with URL params"
```

---

## Task 10: Build the homepage

**Files:**
- Modify: `site/src/pages/index.astro` (replace placeholder with real content)

- [ ] **Step 1: Replace `site/src/pages/index.astro`**

```astro
---
import Base from "@layouts/Base.astro";
import Calculator from "@components/Calculator.astro";
import Disclaimer from "@components/Disclaimer.astro";
import HeroFeaturedRates from "@components/HeroFeaturedRates.astro";
import RateTable from "@components/RateTable.astro";
import { formatUpdatedAt } from "@lib/format";
import { loadRatesData } from "@lib/rates";

const data = await loadRatesData();
---

<Base
  title="Mortgage Rates Canada — Compare today's posted and estimated discounted rates"
  description="Compare current Canadian mortgage rates from major banks. Posted vs. estimated discounted broker-channel rates, updated daily."
  canonical="https://yourdomain.ca/"
>
  <HeroFeaturedRates data={data} />

  <section class="rates-section">
    <h2>All lender rates</h2>
    <p class="muted">
      Updated {formatUpdatedAt(data.updated_at)}. Posted rates are what each
      lender publishes; discounted rates are estimates of what's typically
      available through a mortgage broker.
    </p>
    <Disclaimer variant="rate" />
    <RateTable data={data} terms={["3yr_fixed", "5yr_fixed", "variable"]} />
    <p>
      <a href="/rates/5-year-fixed">See full 5-year fixed rankings →</a>
    </p>
  </section>

  <section>
    <Calculator />
    <p>
      <a href="/calculator">Open the full calculator →</a>
    </p>
  </section>
</Base>

<style>
  .rates-section {
    margin: 2rem 0;
  }
  .muted {
    color: var(--color-muted);
    font-size: 0.95rem;
  }
</style>
```

- [ ] **Step 2: Smoke-test in dev mode**

```
cd site && npm run build
```
Expected: build success. Check `site/dist/index.html` exists and contains `<h1` matching "Today's Lowest", `<table class="rate-table"`, and the calculator form.

- [ ] **Step 3: Commit**

```
git add site/src/pages/index.astro
git commit -m "feat(site): build homepage with hero, rate table, and calculator"
```

---

## Task 11: Build the standalone calculator page

**Files:**
- Create: `site/src/pages/calculator.astro`

- [ ] **Step 1: Create `site/src/pages/calculator.astro`**

```astro
---
import Base from "@layouts/Base.astro";
import Calculator from "@components/Calculator.astro";
---

<Base
  title="Mortgage Payment Calculator Canada"
  description="Calculate your Canadian mortgage payment with CMHC insurance, down payment, amortization, and payment frequency. Share scenarios via URL."
  canonical="https://yourdomain.ca/calculator"
>
  <h1>Mortgage Payment Calculator</h1>
  <p>
    Estimate your monthly, bi-weekly, or accelerated bi-weekly mortgage
    payment, including CMHC insurance for down payments under 20%.
  </p>
  <Calculator />
  <h2>How this calculator works</h2>
  <p>
    Canadian mortgages are compounded semi-annually (not monthly), so the
    effective per-payment rate is derived from the nominal annual rate as
    <code>(1 + annual / 2)<sup>2</sup> − 1</code>. CMHC insurance is required
    when the down payment is less than 20% and is added to the loan principal.
  </p>
  <ul>
    <li>5.00–9.99% down: 4.00% CMHC premium</li>
    <li>10.00–14.99% down: 3.10% CMHC premium</li>
    <li>15.00–19.99% down: 2.80% CMHC premium</li>
    <li>20%+ down: no CMHC required</li>
  </ul>
</Base>
```

- [ ] **Step 2: Verify build**

```
cd site && npm run build
```
Expected: success; `dist/calculator.html` is produced.

- [ ] **Step 3: Commit**

```
git add site/src/pages/calculator.astro
git commit -m "feat(site): add standalone calculator page"
```

---

## Task 12: Build dynamic `/rates/[term]` pages

**Files:**
- Create: `site/src/pages/rates/[term].astro`

- [ ] **Step 1: Create `site/src/pages/rates/[term].astro`**

```astro
---
import Base from "@layouts/Base.astro";
import Disclaimer from "@components/Disclaimer.astro";
import { formatPercent, formatTermLabel, formatUpdatedAt } from "@lib/format";
import { loadRatesData, ratesByTerm, type Term } from "@lib/rates";

// /rates/5-year-fixed maps to term "5yr_fixed".
const TERM_SLUGS: Record<string, Term> = {
  "1-year-fixed": "1yr_fixed",
  "2-year-fixed": "2yr_fixed",
  "3-year-fixed": "3yr_fixed",
  "4-year-fixed": "4yr_fixed",
  "5-year-fixed": "5yr_fixed",
  "7-year-fixed": "7yr_fixed",
  "10-year-fixed": "10yr_fixed",
  variable: "variable",
};

export async function getStaticPaths() {
  const slugs = [
    "1-year-fixed",
    "2-year-fixed",
    "3-year-fixed",
    "4-year-fixed",
    "5-year-fixed",
    "7-year-fixed",
    "10-year-fixed",
    "variable",
  ];
  return slugs.map((slug) => ({ params: { term: slug } }));
}

const { term: slug } = Astro.params;
const term = TERM_SLUGS[slug as string];
if (!term) {
  return Astro.redirect("/404");
}

const data = await loadRatesData();
const entries = ratesByTerm(data, term);
const label = formatTermLabel(term);
---

<Base
  title={`Best ${label} Mortgage Rates in Canada`}
  description={`Compare ${label.toLowerCase()} mortgage rates across Canadian lenders. Posted vs. estimated discounted broker-channel rates, updated daily.`}
  canonical={`https://yourdomain.ca/rates/${slug}`}
>
  <h1>Best {label} Mortgage Rates in Canada</h1>
  <p class="muted">Updated {formatUpdatedAt(data.updated_at)}.</p>
  <Disclaimer variant="rate" />

  {
    entries.length === 0 ? (
      <p>No lenders currently offer this term.</p>
    ) : (
      <table class="rate-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Lender</th>
            <th>Posted</th>
            <th>Estimated discounted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ lender, rate }, i) => (
            <tr class="lender-row">
              <td>{i + 1}</td>
              <td class="lender-row__name">
                <a href={`/lenders/${lender.slug}`}>{lender.name}</a>
              </td>
              <td>
                <s class="lender-row__posted">{formatPercent(rate.posted)}</s>
              </td>
              <td>
                <strong class="lender-row__discounted">
                  {formatPercent(rate.discounted)}
                </strong>
              </td>
              <td>
                {lender.affiliate_url ? (
                  <a class="cta" href={lender.affiliate_url} rel="sponsored noopener" target="_blank">
                    Apply →
                  </a>
                ) : (
                  <a
                    class="cta cta--secondary"
                    href={lender.source_url}
                    rel="noopener"
                    target="_blank"
                  >
                    Visit lender →
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
</Base>

<style>
  .muted {
    color: var(--color-muted);
    font-size: 0.95rem;
  }
</style>
```

- [ ] **Step 2: Verify build creates all 8 term pages**

```
cd site && npm run build
```
Expected: build success. `dist/rates/5-year-fixed.html` (and the other 7) are produced.

- [ ] **Step 3: Commit**

```
git add site/src/pages/rates/[term].astro
git commit -m "feat(site): add dynamic /rates/[term] pages"
```

---

## Task 13: Build dynamic `/lenders/[slug]` pages

**Files:**
- Create: `site/src/pages/lenders/[slug].astro`

- [ ] **Step 1: Create `site/src/pages/lenders/[slug].astro`**

```astro
---
import Base from "@layouts/Base.astro";
import Disclaimer from "@components/Disclaimer.astro";
import { formatPercent, formatTermLabel, formatUpdatedAt } from "@lib/format";
import { loadRatesData } from "@lib/rates";

export async function getStaticPaths() {
  const data = await loadRatesData();
  return data.lenders.map((lender) => ({
    params: { slug: lender.slug },
    props: { lender, updatedAt: data.updated_at },
  }));
}

const { lender, updatedAt } = Astro.props as {
  lender: import("@lib/rates").Lender;
  updatedAt: string;
};
---

<Base
  title={`${lender.name} Mortgage Rates`}
  description={`Current posted and estimated discounted mortgage rates for ${lender.name}, updated daily.`}
  canonical={`https://yourdomain.ca/lenders/${lender.slug}`}
>
  <h1>{lender.name} Mortgage Rates</h1>
  <p class="muted">
    Source: <a href={lender.source_url} rel="noopener" target="_blank">{lender.source_url}</a>
    <br />
    Last updated {formatUpdatedAt(updatedAt)}.
  </p>
  <Disclaimer variant="rate" />

  <table class="rate-table">
    <thead>
      <tr>
        <th>Term</th>
        <th>Posted</th>
        <th>Estimated discounted</th>
      </tr>
    </thead>
    <tbody>
      {lender.rates.map((rate) => (
        <tr class="lender-row">
          <td class="lender-row__name">{formatTermLabel(rate.term)}</td>
          <td><s class="lender-row__posted">{formatPercent(rate.posted)}</s></td>
          <td><strong class="lender-row__discounted">{formatPercent(rate.discounted)}</strong></td>
        </tr>
      ))}
    </tbody>
  </table>

  {lender.affiliate_url && (
    <p>
      <a class="cta" href={lender.affiliate_url} rel="sponsored noopener" target="_blank">
        Apply with {lender.name} →
      </a>
    </p>
  )}
</Base>

<style>
  .muted {
    color: var(--color-muted);
    font-size: 0.95rem;
  }
</style>
```

- [ ] **Step 2: Verify build creates one page per lender**

```
cd site && npm run build
```
Expected: success. `dist/lenders/rbc.html`, `dist/lenders/td.html`, `dist/lenders/national.html` all exist.

- [ ] **Step 3: Commit**

```
git add site/src/pages/lenders/[slug].astro
git commit -m "feat(site): add dynamic /lenders/[slug] pages"
```

---

## Task 14: Build the 5 legal / informational pages

**Files:**
- Create: `site/src/pages/about.astro`
- Create: `site/src/pages/methodology.astro`
- Create: `site/src/pages/disclosure.astro`
- Create: `site/src/pages/privacy.astro`
- Create: `site/src/pages/terms.astro`

- [ ] **Step 1: Create `site/src/pages/about.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="About"
  description="About Mortgage Rates Canada — what we do and who we are."
  canonical="https://yourdomain.ca/about"
>
  <h1>About Mortgage Rates Canada</h1>
  <p>
    Mortgage Rates Canada displays publicly-published posted mortgage rates
    from major Canadian lenders alongside an estimated discounted rate that
    reflects what's typically available through a mortgage broker. We update
    rates daily.
  </p>
  <p>
    We earn a commission when you apply through some lender links — see our
    <a href="/disclosure">affiliate disclosure</a>. Our discount estimation
    methodology is published in full at <a href="/methodology">methodology</a>.
  </p>
  <h2>Who runs this site</h2>
  <p>
    This site is operated by an independent owner. We do not employ licensed
    mortgage brokers or financial advisors, and the information on this site is
    not personal advice. For personalized recommendations, consult a licensed
    mortgage professional.
  </p>
</Base>
```

- [ ] **Step 2: Create `site/src/pages/methodology.astro`**

```astro
---
import Base from "@layouts/Base.astro";
import { loadRatesData } from "@lib/rates";
import { formatUpdatedAt } from "@lib/format";

const data = await loadRatesData();
---

<Base
  title="Methodology"
  description="How we collect and calculate the rates shown on Mortgage Rates Canada."
  canonical="https://yourdomain.ca/methodology"
>
  <h1>Methodology</h1>
  <p>Last updated {formatUpdatedAt(data.updated_at)}.</p>

  <h2>Where the posted rates come from</h2>
  <p>
    For each lender we display, we automatically read the rates published on
    that lender's public mortgage rates page. For lenders whose sites cannot
    be read by an automated scraper, we maintain the rates manually based on
    their published rate sheets. We always link to the source page on each
    lender's profile so you can verify.
  </p>

  <h2>How we estimate the discounted rate</h2>
  <p>
    Posted rates are typically what lenders advertise. The actual rate you
    qualify for through a mortgage broker is usually lower. We apply a fixed
    haircut to each posted rate to estimate what's typically available:
  </p>
  <ul>
    <li>Fixed terms: posted rate minus {data.discount_formula.fixed}%</li>
    <li>Variable: posted rate minus {data.discount_formula.variable}%</li>
    {data.discount_formula.heloc !== null && (
      <li>HELOC: posted rate minus {data.discount_formula.heloc}%</li>
    )}
  </ul>
  <p>
    This is an estimate, not a guarantee. The actual rate you receive depends
    on your credit score, down payment, property type, broker relationship,
    and lender promotions in effect when you apply. Always confirm directly
    with a lender or broker.
  </p>

  <h2>How often rates update</h2>
  <p>
    The site rebuilds daily. Each lender's profile shows when their rates were
    last successfully scraped.
  </p>
</Base>
```

- [ ] **Step 3: Create `site/src/pages/disclosure.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="Affiliate Disclosure"
  description="How Mortgage Rates Canada is funded."
  canonical="https://yourdomain.ca/disclosure"
>
  <h1>Affiliate Disclosure</h1>
  <p>
    Mortgage Rates Canada earns a commission when you apply for a mortgage
    through some of the "Apply →" or "Get this rate →" links on this site.
    These are affiliate links — when a visitor clicks through and is approved
    by the lender, we receive a referral fee at no cost to the visitor.
  </p>
  <p>
    Affiliate compensation does <strong>not</strong> influence the rates we
    display or the order in which lenders are ranked. We rank by lowest
    estimated discounted rate, regardless of whether a lender pays us a
    commission. Lenders without an affiliate program are still included.
  </p>
  <p>
    This disclosure is published in compliance with the Competition Bureau of
    Canada's guidance on the disclosure of material connections in online
    marketing (Competition Act).
  </p>
</Base>
```

- [ ] **Step 4: Create `site/src/pages/privacy.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="Privacy Policy"
  description="What information Mortgage Rates Canada collects."
  canonical="https://yourdomain.ca/privacy"
>
  <h1>Privacy Policy</h1>

  <h2>Information we collect</h2>
  <p>
    Mortgage Rates Canada does not require accounts and does not collect any
    personal information directly. The mortgage calculator runs entirely in
    your browser and does not transmit any of the values you enter to our
    servers.
  </p>

  <h2>Cookies and analytics</h2>
  <p>
    The site uses minimal first-party analytics to count page views and
    measure performance. We do not use cookies that track you across other
    websites.
  </p>

  <h2>Affiliate links</h2>
  <p>
    When you click an affiliate "Apply →" link, you leave this site for the
    lender's website. The lender may set their own cookies and collect
    information per their own privacy policy, which we do not control.
  </p>

  <h2>Contact</h2>
  <p>
    If you have privacy questions, contact the site operator. This policy is
    governed by Canada's Personal Information Protection and Electronic
    Documents Act (PIPEDA).
  </p>
</Base>
```

- [ ] **Step 5: Create `site/src/pages/terms.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="Terms of Use"
  description="Terms of use for Mortgage Rates Canada."
  canonical="https://yourdomain.ca/terms"
>
  <h1>Terms of Use</h1>

  <h2>Information only — not financial advice</h2>
  <p>
    All content on Mortgage Rates Canada is for general informational purposes
    only and does not constitute financial, legal, tax, or investment advice.
    The information is not a substitute for professional advice from a
    licensed mortgage broker or financial advisor.
  </p>

  <h2>Rate accuracy</h2>
  <p>
    Posted rates are estimates updated daily and may differ from what a
    lender will actually offer you. Discounted rates shown are estimates of
    typical broker-channel pricing and are not an offer of credit. Actual
    rates require lender approval based on your individual circumstances.
  </p>

  <h2>No warranty</h2>
  <p>
    The site is provided "as is" without warranty of any kind. We make no
    representations about the completeness, reliability, or timeliness of any
    information on the site. To the maximum extent permitted by law, we
    disclaim all liability for any loss arising from reliance on this site.
  </p>

  <h2>Acceptance</h2>
  <p>
    By using this site you agree to these terms. If you do not agree, do not
    use the site.
  </p>
</Base>
```

- [ ] **Step 6: Verify build creates all 5 pages**

```
cd site && npm run build
```
Expected: success. `dist/about.html`, `dist/methodology.html`, `dist/disclosure.html`, `dist/privacy.html`, `dist/terms.html` all exist.

- [ ] **Step 7: Commit**

```
git add site/src/pages/about.astro site/src/pages/methodology.astro site/src/pages/disclosure.astro site/src/pages/privacy.astro site/src/pages/terms.astro
git commit -m "feat(site): add legal pages (about, methodology, disclosure, privacy, terms)"
```

---

## Task 15: Add `scripts/fetch-rates.mjs` placeholder

**Files:**
- Create: `site/scripts/fetch-rates.mjs`

This script's full wiring (fetching from the `data` branch via raw.githubusercontent.com) is the deploy plan (plan 3). For now we ship a script that:
- Looks for `src/data/rates.json` (real one written by the deploy environment).
- Does nothing if it exists.
- Prints a friendly message about the sample fallback if not.

The site already prefers `rates.json` over `rates.sample.json` via `loadRatesData()`. This script just needs to exist and not error so `npm run build` works in CI.

- [ ] **Step 1: Create `site/scripts/fetch-rates.mjs`**

```javascript
#!/usr/bin/env node
/**
 * Prebuild step: ensure src/data/rates.json is populated for the build.
 *
 * In production (set up in deploy plan 3), this fetches the latest rates.json
 * from the `data` branch via raw.githubusercontent.com and writes it to
 * src/data/rates.json (which is gitignored).
 *
 * In local dev or CI without DATA_BRANCH_URL set, it does nothing — the
 * site falls back to src/data/rates.sample.json automatically.
 */
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RATES_PATH = resolve(__dirname, "..", "src", "data", "rates.json");
const RATES_URL = process.env.DATA_BRANCH_URL;

async function main() {
  if (!RATES_URL) {
    if (existsSync(RATES_PATH)) {
      console.log(`[fetch-rates] using existing ${RATES_PATH}`);
    } else {
      console.log(
        `[fetch-rates] DATA_BRANCH_URL not set and no rates.json present — site will use rates.sample.json fallback`,
      );
    }
    return;
  }

  console.log(`[fetch-rates] fetching ${RATES_URL} ...`);
  const response = await fetch(RATES_URL);
  if (!response.ok) {
    throw new Error(`fetch-rates: HTTP ${response.status} for ${RATES_URL}`);
  }
  const text = await response.text();
  // Quick sanity check: must be valid JSON with a `lenders` array.
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.lenders)) {
    throw new Error(`fetch-rates: response missing 'lenders' array`);
  }
  await writeFile(RATES_PATH, text, "utf8");
  console.log(`[fetch-rates] wrote ${text.length} bytes to ${RATES_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Wire it into `package.json` as a prebuild step**

Open `site/package.json` and replace the `"build"` script line to add the prebuild:

Old:
```json
    "build": "astro build",
```

New:
```json
    "prebuild": "node scripts/fetch-rates.mjs",
    "build": "astro build",
```

The full `scripts` block becomes:
```json
  "scripts": {
    "dev": "astro dev",
    "prebuild": "node scripts/fetch-rates.mjs",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Verify the prebuild runs**

```
cd site && npm run build
```
Expected: build succeeds. The output should include the line `[fetch-rates] DATA_BRANCH_URL not set and no rates.json present — site will use rates.sample.json fallback`.

- [ ] **Step 4: Commit**

```
git add site/scripts/fetch-rates.mjs site/package.json
git commit -m "feat(site): add fetch-rates prebuild script (placeholder for deploy)"
```

---

## Task 16: Final verification — local dev server smoke test

**Files:** none modified.

This task verifies the complete site works end-to-end. No code changes; just verification.

- [ ] **Step 1: Run the full test suite**

```
cd site && npm test
```
Expected: 25/25 tests pass (11 format + 5 rates + 9 calculator).

- [ ] **Step 2: Run `astro check` for type safety**

```
cd site && npm run check
```
Expected: 0 errors. Warnings are OK.

- [ ] **Step 3: Build the site**

```
cd site && npm run build
```
Expected: success. `dist/` should contain at minimum:
- `index.html`
- `calculator.html`
- `about.html`, `methodology.html`, `disclosure.html`, `privacy.html`, `terms.html`
- `rates/1-year-fixed.html`, `rates/5-year-fixed.html`, `rates/variable.html`, etc. (8 total)
- `lenders/rbc.html`, `lenders/td.html`, `lenders/national.html` (3 total — matches sample data)
- `favicon.svg`, `robots.txt`

- [ ] **Step 4: Start the preview server**

```
cd site && npm run preview
```
Expected: server starts on http://localhost:4321 (or similar).

- [ ] **Step 5: Smoke test in browser (manual)**

Open http://localhost:4321 in a browser and verify:
- Homepage renders the hero (best 5-yr fixed and best variable cards), the rate table with 3 lenders, the calculator below
- Clicking a lender name navigates to `/lenders/<slug>`
- `/calculator` page renders and the calculator updates as you change inputs
- `/rates/5-year-fixed` shows lenders ranked by discounted rate
- All 5 footer links (About, Methodology, Disclosure, Privacy, Terms) navigate to their pages
- Calculator URL params: change inputs and verify the URL updates with `?price=&down=...`
- Calculator URL params: visit http://localhost:4321/calculator?price=400000&down=10&rate=4.5&am=20 and confirm inputs are pre-filled
- No console errors in browser DevTools

If any of these fail, fix in place and re-verify before continuing.

- [ ] **Step 6: Stop the preview server**

Ctrl+C the preview server.

- [ ] **Step 7: Commit (if anything was changed during smoke test)**

If you fixed bugs found during smoke test, commit them with a `fix(site):` prefix. Otherwise no commit needed.

---

## Verification (end of plan)

After Task 16, the site is complete and verifiable on its own:

- [ ] `cd site && npm test` — 25 unit tests pass
- [ ] `cd site && npm run check` — 0 type errors
- [ ] `cd site && npm run build` — produces a complete `dist/` of static HTML
- [ ] `cd site && npm run preview` — local server renders the homepage, calculator, all dynamic pages, and all legal pages without console errors

This plan ships a fully-working Astro site that consumes the scraper's `rates.json`. Plan 3 (deploy wiring) takes this site + the scraper from plan 1 and connects them via the `data` branch and Cloudflare Pages.

---

## Deferred to v1.1 (intentionally NOT in this plan)

- **Display ad placeholder slots** (spec Section 9). The spec calls for reserved AdSense/Mediavine slots from day one to avoid layout shift when ads are approved. These are easy to drop in later (a fixed-dimension `<div class="ad-slot ad-slot--banner">` with a faint dashed border, replaced with the network's snippet on approval). Adding them before approval makes the site look unfinished; defer until you've signed up for an ad network.
- **Email capture slot** (spec Section 9). "Notify me when rates drop" was reserved for v1.1.
- **Sitemap.xml** generation. Add the `@astrojs/sitemap` integration when the domain is finalized.
- **Open Graph / Twitter Card meta tags.** Worth adding before launch for better social sharing.

---

## Execution Notes (2026-04-25)

**Outcome:** All 16 tasks shipped. 26 unit tests pass; `astro check` reports 0 errors / 0 warnings; build produces 18 static pages. Merged to master in commit `e099058`.

**Corrections made during execution (followers of this plan should apply these directly):**

1. **Vite path aliases (Task 6).** The plan only set up TS path aliases in `tsconfig.json`. Astro's Vite build also needs `resolve.alias` in `astro.config.mjs`:
   ```javascript
   import { defineConfig } from "astro/config";
   import { fileURLToPath } from "node:url";

   export default defineConfig({
     site: "https://yourdomain.ca",
     trailingSlash: "never",
     build: { format: "file" },
     vite: {
       resolve: {
         alias: {
           "@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
           "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
           "@layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
         },
       },
     },
   });
   ```

2. **Calculator reference constants (Task 5).** The plan's reference values were off (off-by-rounding errors from a different compounding model). Correct values for `$400k @ 5% over 25yr` under Canadian semi-annual compounding:
   - Monthly conventional: **$2,326.42** (plan said 2326.92)
   - Monthly with $19k CMHC: **$2,873.13** (plan said 2873.95)
   - Bi-weekly is computed from the bi-weekly periodic rate, not as `monthly × 12/26` (the approximation drifts by ~$1). For `$400k @ 5% over 25yr biweekly`: **$1,072.54**.

3. **`fetch-rates.mjs` bootstrap fallback (Task 15).** `loadRatesData()` does a static dynamic import of `../data/rates.json` that Rollup tries to resolve at build time. The runtime `try/catch` fallback never gets a chance because the module resolution fails first. The prebuild script must ensure `rates.json` exists by copying `rates.sample.json` when no real data is available — the plan was updated to include this fallback case.

4. **`pages/calculator.astro` import naming (post Task 11).** `import Calculator from ...` collides with Astro's internally-generated `Calculator` type for the page itself. Rename to `CalculatorWidget`:
   ```astro
   import CalculatorWidget from "@components/Calculator.astro";
   ...
   <CalculatorWidget />
   ```

5. **`site/.gitignore` (post Task 1).** Add `src/env.d.ts` (Astro auto-generates this on first build).

**Final task structure (as actually executed):**

| Task | Title | Commit | Status |
|---|---|---|---|
| 1 | Initialize Astro project | `645a8d9` | Done |
| 2 | rates.sample.json | `bb990f0` | Done |
| 3 | format.ts (TDD) | `3982546` | Done — 10 tests |
| 4 | rates.ts (TDD) | `4087a60` | Done — 6 tests |
| 5 | calculator.ts (TDD) | `62c7dd2` | Done — 10 tests (constants corrected) |
| 6 | Base + Footer + Disclaimer | `d8eb8aa` | Done (Vite alias added to astro.config.mjs) |
| 7 | RateTable + LenderRow | `6bc35f8` | Done |
| 8 | HeroFeaturedRates | `dcac91b` | Done |
| 9 | Calculator client island | `4b46035` | Done |
| 10 | Homepage | `e14329a` | Done (revealed bootstrap issue, fixed in Task 15) |
| 11 | Calculator page | `0ef7664` | Done (import renamed to fix later check error) |
| 12 | /rates/[term] | `735ad4e` | Done — 8 pages |
| 13 | /lenders/[slug] | `d2b13c3` | Done — 3 pages |
| 14 | Legal pages | `26c86f5` | Done — 5 pages |
| 15 | fetch-rates.mjs | `57b6ac4` | Done (with bootstrap fallback) |
| 16 | Verification | (no commit) | Done — 26/26 tests, 0 errors / 0 warnings, 18 pages |
| post | Naming-collision + dead-import fixes | `0c396e5` | Done |
| merge | feature/site → master | `e099058` | Done |
