# Phase 1 Content and Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pre-launch content and interactive-tool layer described in the [Phase 1 design spec](../specs/2026-04-28-content-and-tools-phase-1-design.md) — 8 term-page intros, templated lender facts, 2 hero guides + tools (fixed-vs-variable break-even, affordability), shared tool framework, and editorial-team E-E-A-T signals.

**Architecture:** Pure-TS math modules with TDD foundation, then Astro content collections (MDX guides + Markdown term intros), then shared components (`ToolFrame`, `AuthorByline`, `GuideCard`), then the two tool components, then guide MDX prose with embedded tools, then site-wide integration. Lender data comes from a structured YAML file rendered through deterministic templating to avoid hand-writing per-lender essays.

**Tech Stack:** Astro 4 + TypeScript + Vitest (existing), Astro content collections (`@astrojs/markdown` and `@astrojs/mdx` integrations), `js-yaml` (new dep) for lender facts loader.

**Spec reference:** [docs/superpowers/specs/2026-04-28-content-and-tools-phase-1-design.md](../specs/2026-04-28-content-and-tools-phase-1-design.md)

**Important authoring note:** Several tasks include "user review required" pauses where the user must edit drafted prose for voice and fact-check numbers per the hybrid authoring workflow. Implementation cannot proceed past those gates without user approval — the executor should stop and surface the draft for review rather than committing AI-generated prose unedited.

---

## Task 1: Domain housekeeping

**Files:**
- Modify: `site/astro.config.mjs:9`
- Modify: `site/src/pages/index.astro`
- Modify: `site/src/pages/about.astro`
- Modify: `site/src/pages/calculator.astro`
- Modify: `site/src/pages/disclosure.astro`
- Modify: `site/src/pages/methodology.astro`
- Modify: `site/src/pages/privacy.astro`
- Modify: `site/src/pages/terms.astro`
- Modify: `site/src/pages/lenders/[slug].astro`
- Modify: `site/src/pages/rates/[term].astro`

- [ ] **Step 1: Replace the placeholder domain everywhere**

Run from repo root:
```bash
grep -rl "yourdomain.ca" site/ | xargs sed -i 's|yourdomain\.ca|canadianrates.ca|g'
```

- [ ] **Step 2: Verify nothing remains**

Run:
```bash
grep -r "yourdomain" site/
```

Expected: no output (exit code 1).

- [ ] **Step 3: Build to verify nothing broke**

```bash
cd site && npm run build
```

Expected: build succeeds; no warnings about canonical URLs.

- [ ] **Step 4: Commit**

```bash
git add site/
git commit -m "chore(site): replace yourdomain.ca placeholder with canadianrates.ca"
```

---

## Task 2: Add `breakEven.ts` math module (TDD)

**Files:**
- Create: `site/src/lib/breakEven.ts`
- Create: `site/src/lib/breakEven.test.ts`

This module models a fixed-vs-variable comparison over a horizon (typically the 5-year term length). Variable rate is modeled as piecewise-constant: it starts at `variableRate` and jumps by `rateChangePct` at month `rateChangeMonth`.

- [ ] **Step 1: Write the failing tests**

Create `site/src/lib/breakEven.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compareBreakEven, findBreakEvenRise } from "@lib/breakEven";

describe("compareBreakEven", () => {
  const base = {
    loanAmount: 500_000,
    amortizationYears: 25,
    fixedRate: 4.79,
    variableRate: 4.20,
    horizonMonths: 60,
  };

  it("variable wins when rates stay flat", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 0, rateChangeMonth: 0 });
    expect(r.winner).toBe("variable");
    expect(r.savingsAmount).toBeGreaterThan(0);
    expect(r.variableTotalInterest).toBeLessThan(r.fixedTotalInterest);
  });

  it("fixed wins when variable rises sharply early", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 2.0, rateChangeMonth: 1 });
    expect(r.winner).toBe("fixed");
    expect(r.fixedTotalInterest).toBeLessThan(r.variableTotalInterest);
  });

  it("rounds payment values consistently", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 0, rateChangeMonth: 0 });
    expect(r.fixedPayment).toBeGreaterThan(0);
    expect(r.variableInitialPayment).toBeGreaterThan(0);
    expect(r.variablePostChangePayment).toEqual(r.variableInitialPayment);
  });

  it("post-change payment reflects new rate", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 1.0, rateChangeMonth: 12 });
    expect(r.variablePostChangePayment).toBeGreaterThan(r.variableInitialPayment);
  });

  it("zero loan returns zero interest", () => {
    const r = compareBreakEven({ ...base, loanAmount: 0, rateChangePct: 0, rateChangeMonth: 0 });
    expect(r.fixedTotalInterest).toBe(0);
    expect(r.variableTotalInterest).toBe(0);
  });
});

describe("findBreakEvenRise", () => {
  const base = {
    loanAmount: 500_000,
    amortizationYears: 25,
    fixedRate: 4.79,
    variableRate: 4.20,
    horizonMonths: 60,
    rateChangeMonth: 12,
  };

  it("finds a positive break-even when fixed > variable", () => {
    const rise = findBreakEvenRise(base);
    expect(rise).toBeGreaterThan(0);
    expect(rise).toBeLessThan(5);
  });

  it("returns 0 when fixed already <= variable", () => {
    const rise = findBreakEvenRise({ ...base, fixedRate: 3.0, variableRate: 4.0 });
    expect(rise).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
cd site && npm run test -- breakEven
```

Expected: failure with `Cannot find module '@lib/breakEven'`.

- [ ] **Step 3: Implement the module**

Create `site/src/lib/breakEven.ts`:

```ts
/**
 * Fixed vs variable break-even math. Pure functions.
 *
 * Models a variable-rate scenario where the rate is piecewise-constant: it
 * starts at `variableRate` and jumps by `rateChangePct` at month
 * `rateChangeMonth`. Outputs the total interest paid under each option over
 * the chosen horizon (typically the 5-year term length).
 *
 * Uses Canadian semi-annual compounding via the existing calculator math.
 */

export interface BreakEvenInput {
  loanAmount: number;
  amortizationYears: number;
  fixedRate: number; // %
  variableRate: number; // % at month 0
  rateChangePct: number; // 0.5 = +0.5 percentage points
  rateChangeMonth: number; // 0 = immediate, 12 = month 12
  horizonMonths: number; // typically 60
}

export interface BreakEvenResult {
  fixedTotalInterest: number;
  variableTotalInterest: number;
  fixedPayment: number;
  variableInitialPayment: number;
  variablePostChangePayment: number;
  winner: "fixed" | "variable" | "tie";
  savingsAmount: number;
}

function periodicRateMonthly(annualRatePct: number): number {
  if (annualRatePct === 0) return 0;
  const annualRate = annualRatePct / 100;
  const effectiveAnnual = Math.pow(1 + annualRate / 2, 2) - 1;
  return Math.pow(1 + effectiveAnnual, 1 / 12) - 1;
}

function monthlyPayment(loan: number, annualRatePct: number, amortYears: number): number {
  if (loan === 0) return 0;
  const i = periodicRateMonthly(annualRatePct);
  const n = amortYears * 12;
  if (i === 0) return loan / n;
  return (loan * i) / (1 - Math.pow(1 + i, -n));
}

function simulate(
  loanAmount: number,
  amortYears: number,
  ratePcts: number[], // length = horizonMonths; rate per month
): { totalInterest: number; payments: number[] } {
  let balance = loanAmount;
  let totalInterest = 0;
  const payments: number[] = [];
  let currentRate = NaN;
  let currentPayment = 0;

  for (let m = 0; m < ratePcts.length; m++) {
    const r = ratePcts[m];
    if (r !== currentRate) {
      // Re-amortize remaining balance over remaining amortization months.
      const remainingMonths = amortYears * 12 - m;
      currentPayment = monthlyPayment(balance, r, remainingMonths / 12);
      currentRate = r;
    }
    const i = periodicRateMonthly(r);
    const interest = balance * i;
    const principal = currentPayment - interest;
    balance = Math.max(0, balance - principal);
    totalInterest += interest;
    payments.push(currentPayment);
    if (balance === 0) break;
  }

  return { totalInterest, payments };
}

export function compareBreakEven(input: BreakEvenInput): BreakEvenResult {
  const { loanAmount, amortizationYears, fixedRate, variableRate, rateChangePct, rateChangeMonth, horizonMonths } = input;

  if (loanAmount === 0) {
    return {
      fixedTotalInterest: 0,
      variableTotalInterest: 0,
      fixedPayment: 0,
      variableInitialPayment: 0,
      variablePostChangePayment: 0,
      winner: "tie",
      savingsAmount: 0,
    };
  }

  const fixedRates = Array(horizonMonths).fill(fixedRate);
  const variableRates = Array.from({ length: horizonMonths }, (_, m) =>
    m < rateChangeMonth ? variableRate : variableRate + rateChangePct,
  );

  const fixedSim = simulate(loanAmount, amortizationYears, fixedRates);
  const varSim = simulate(loanAmount, amortizationYears, variableRates);

  const variableInitialPayment = varSim.payments[0] ?? 0;
  const variablePostChangePayment =
    varSim.payments[Math.min(rateChangeMonth, varSim.payments.length - 1)] ?? variableInitialPayment;

  const diff = fixedSim.totalInterest - varSim.totalInterest;
  let winner: "fixed" | "variable" | "tie";
  if (Math.abs(diff) < 1) winner = "tie";
  else if (diff > 0) winner = "variable";
  else winner = "fixed";

  return {
    fixedTotalInterest: fixedSim.totalInterest,
    variableTotalInterest: varSim.totalInterest,
    fixedPayment: fixedSim.payments[0] ?? 0,
    variableInitialPayment,
    variablePostChangePayment,
    winner,
    savingsAmount: Math.abs(diff),
  };
}

export function findBreakEvenRise(input: Omit<BreakEvenInput, "rateChangePct">): number {
  if (input.fixedRate <= input.variableRate) return 0;

  // Bisection over [0, 10] percentage-point rises.
  let lo = 0;
  let hi = 10;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const r = compareBreakEven({ ...input, rateChangePct: mid });
    if (r.winner === "fixed") {
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
cd site && npm run test -- breakEven
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/breakEven.ts site/src/lib/breakEven.test.ts
git commit -m "feat(site): add break-even math module with TDD coverage"
```

---

## Task 3: Add `affordability.ts` math module (TDD)

**Files:**
- Create: `site/src/lib/affordability.ts`
- Create: `site/src/lib/affordability.test.ts`

Canadian affordability is bound by GDS (≤39%), TDS (≤44%), and the federal stress test (qualify at greater of contract+2% or 5.25%).

- [ ] **Step 1: Write the failing tests**

Create `site/src/lib/affordability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateAffordability, qualifyingRate } from "@lib/affordability";

describe("qualifyingRate", () => {
  it("uses contract + 2 when above floor", () => {
    expect(qualifyingRate(5.0)).toBeCloseTo(7.0);
  });
  it("uses 5.25 floor when contract is low", () => {
    expect(qualifyingRate(2.5)).toBe(5.25);
  });
  it("uses contract + 2 right at the boundary", () => {
    expect(qualifyingRate(3.25)).toBe(5.25);
    expect(qualifyingRate(3.26)).toBeCloseTo(5.26);
  });
});

describe("calculateAffordability", () => {
  const base = {
    grossAnnualIncome: 120_000,
    monthlyDebts: 500,
    estimatedPropertyTax: 400,
    estimatedHeat: 100,
    estimatedCondoFees: 0,
    downPayment: 80_000,
    contractRate: 5.0,
    amortizationYears: 25,
  };

  it("returns positive max mortgage for typical input", () => {
    const r = calculateAffordability(base);
    expect(r.maxMortgage).toBeGreaterThan(0);
    expect(r.maxPurchasePrice).toBeGreaterThan(r.maxMortgage);
  });

  it("uses qualifying rate, not contract rate, to size mortgage", () => {
    const r = calculateAffordability(base);
    expect(r.qualifyingRate).toBeCloseTo(7.0);
  });

  it("identifies binding constraint correctly when GDS limits", () => {
    const r = calculateAffordability({ ...base, monthlyDebts: 0 });
    expect(r.bindingConstraint).toBe("gds");
  });

  it("identifies TDS as binding when debts are large", () => {
    const r = calculateAffordability({ ...base, monthlyDebts: 2000 });
    expect(r.bindingConstraint).toBe("tds");
  });

  it("returns 0 mortgage when housing already exceeds GDS", () => {
    const r = calculateAffordability({
      ...base,
      grossAnnualIncome: 30_000,
      estimatedPropertyTax: 2000,
    });
    expect(r.maxMortgage).toBe(0);
  });

  it("counts 50% of condo fees in housing costs", () => {
    const noCondo = calculateAffordability(base);
    const withCondo = calculateAffordability({ ...base, estimatedCondoFees: 600 });
    expect(withCondo.maxMortgage).toBeLessThan(noCondo.maxMortgage);
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
cd site && npm run test -- affordability
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the module**

Create `site/src/lib/affordability.ts`:

```ts
/**
 * Canadian mortgage affordability math (GDS/TDS + federal stress test).
 *
 * GDS limit: 39% (federally insured). TDS limit: 44%.
 * Stress test: must qualify at max(contract + 2%, 5.25%).
 *
 * Uses Canadian semi-annual compounding.
 */

export interface AffordabilityInput {
  grossAnnualIncome: number;
  monthlyDebts: number; // car/credit card minimums/student loans
  estimatedPropertyTax: number; // monthly
  estimatedHeat: number; // monthly
  estimatedCondoFees: number; // monthly; 0 if not condo
  downPayment: number; // dollars
  contractRate: number; // %
  amortizationYears: number;
  gdsLimit?: number; // default 0.39
  tdsLimit?: number; // default 0.44
  stressTestFloor?: number; // default 5.25
}

export interface AffordabilityResult {
  qualifyingRate: number;
  maxMortgageGds: number;
  maxMortgageTds: number;
  maxMortgage: number;
  maxPurchasePrice: number;
  bindingConstraint: "gds" | "tds";
}

const STRESS_TEST_FLOOR = 5.25;

export function qualifyingRate(contractRatePct: number, floor = STRESS_TEST_FLOOR): number {
  return Math.max(contractRatePct + 2, floor);
}

function periodicRateMonthly(annualRatePct: number): number {
  if (annualRatePct === 0) return 0;
  const annualRate = annualRatePct / 100;
  const effectiveAnnual = Math.pow(1 + annualRate / 2, 2) - 1;
  return Math.pow(1 + effectiveAnnual, 1 / 12) - 1;
}

function maxMortgageFromMonthlyPayment(
  maxMonthlyPayment: number,
  qualifyRatePct: number,
  amortYears: number,
): number {
  if (maxMonthlyPayment <= 0) return 0;
  const i = periodicRateMonthly(qualifyRatePct);
  const n = amortYears * 12;
  if (i === 0) return maxMonthlyPayment * n;
  // P = M * (1 - (1+i)^-n) / i
  return (maxMonthlyPayment * (1 - Math.pow(1 + i, -n))) / i;
}

export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  const {
    grossAnnualIncome,
    monthlyDebts,
    estimatedPropertyTax,
    estimatedHeat,
    estimatedCondoFees,
    downPayment,
    contractRate,
    amortizationYears,
    gdsLimit = 0.39,
    tdsLimit = 0.44,
    stressTestFloor = STRESS_TEST_FLOOR,
  } = input;

  const qualifyRate = qualifyingRate(contractRate, stressTestFloor);
  const monthlyIncome = grossAnnualIncome / 12;
  const housingFixed = estimatedPropertyTax + estimatedHeat + estimatedCondoFees * 0.5;

  const gdsBudget = monthlyIncome * gdsLimit - housingFixed;
  const tdsBudget = monthlyIncome * tdsLimit - housingFixed - monthlyDebts;

  const maxPaymentGds = Math.max(0, gdsBudget);
  const maxPaymentTds = Math.max(0, tdsBudget);

  const maxMortgageGds = maxMortgageFromMonthlyPayment(maxPaymentGds, qualifyRate, amortizationYears);
  const maxMortgageTds = maxMortgageFromMonthlyPayment(maxPaymentTds, qualifyRate, amortizationYears);

  const maxMortgage = Math.min(maxMortgageGds, maxMortgageTds);
  const bindingConstraint = maxMortgageGds <= maxMortgageTds ? "gds" : "tds";

  return {
    qualifyingRate: qualifyRate,
    maxMortgageGds,
    maxMortgageTds,
    maxMortgage,
    maxPurchasePrice: maxMortgage + downPayment,
    bindingConstraint,
  };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

```bash
cd site && npm run test -- affordability
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/affordability.ts site/src/lib/affordability.test.ts
git commit -m "feat(site): add affordability math module with GDS/TDS + stress test"
```

---

## Task 4: Set up Astro content collections

**Files:**
- Modify: `site/package.json` (add `@astrojs/mdx`, `js-yaml`, `@types/js-yaml`)
- Modify: `site/astro.config.mjs` (register MDX integration)
- Create: `site/src/content/config.ts`

- [ ] **Step 1: Install MDX integration and YAML loader**

```bash
cd site && npm install @astrojs/mdx js-yaml && npm install -D @types/js-yaml
```

- [ ] **Step 2: Register MDX in `astro.config.mjs`**

Modify `site/astro.config.mjs` — add `import mdx from "@astrojs/mdx";` at the top and add `integrations: [mdx()]` to the config.

- [ ] **Step 3: Create the content collection schema**

Create `site/src/content/config.ts`:

```ts
import { defineCollection, z } from "astro:content";

const guides = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tool_id: z.enum(["break-even", "affordability"]).optional(),
    related_guides: z.array(z.string()).default([]),
    related_terms: z.array(z.string()).default([]),
    last_reviewed_at: z.string(), // ISO date
  }),
});

const termIntros = defineCollection({
  type: "content",
  schema: z.object({
    term: z.string(), // matches Term type in lib/rates
    headline: z.string(),
    last_reviewed_at: z.string(),
  }),
});

export const collections = { guides, "term-intros": termIntros };
```

- [ ] **Step 4: Verify the build still works**

```bash
cd site && npm run build
```

Expected: build succeeds (no content yet, but config is valid).

- [ ] **Step 5: Commit**

```bash
git add site/package.json site/package-lock.json site/astro.config.mjs site/src/content/config.ts
git commit -m "feat(site): add MDX integration and content collection schemas"
```

---

## Task 5: Add editorial config

**Files:**
- Create: `site/src/data/editorial.ts`

- [ ] **Step 1: Create the file**

Create `site/src/data/editorial.ts`:

```ts
export const EDITORIAL = {
  teamName: "Mortgage Rates Canada editorial team",
  affiliateDisclosure:
    "We earn a commission when you apply through some links — see our affiliate disclosure.",
  methodologySummary:
    "Each guide is researched against primary sources (Bank of Canada, OSFI, CMHC, lender rate sheets), drafted, edited for clarity, and reviewed before publication. We update guides when the underlying rules change and review every guide quarterly.",
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add site/src/data/editorial.ts
git commit -m "feat(site): add editorial config (team name, disclosure, methodology summary)"
```

---

## Task 6: Build `AuthorByline.astro` component

**Files:**
- Create: `site/src/components/AuthorByline.astro`

- [ ] **Step 1: Create the component**

Create `site/src/components/AuthorByline.astro`:

```astro
---
import { EDITORIAL } from "../data/editorial";

interface Props {
  lastReviewedAt: string; // ISO date
}

const { lastReviewedAt } = Astro.props;
const reviewedDate = new Date(lastReviewedAt).toLocaleDateString("en-CA", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
---

<p class="byline">
  <span>By {EDITORIAL.teamName}</span>
  <span aria-hidden="true"> · </span>
  <span>Last reviewed <time datetime={lastReviewedAt}>{reviewedDate}</time></span>
</p>

<style>
  .byline {
    color: var(--color-muted);
    font-size: 0.9rem;
    margin: 0.25rem 0 1rem;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add site/src/components/AuthorByline.astro
git commit -m "feat(site): add AuthorByline component"
```

---

## Task 7: Build `AffiliateDisclosure.astro` component

**Files:**
- Create: `site/src/components/AffiliateDisclosure.astro`

- [ ] **Step 1: Create the component**

Create `site/src/components/AffiliateDisclosure.astro`:

```astro
---
import { EDITORIAL } from "../data/editorial";
---

<aside class="disclosure">
  <p>
    {EDITORIAL.affiliateDisclosure.replace("affiliate disclosure", "")}
    <a href="/disclosure">affiliate disclosure</a>.
  </p>
</aside>

<style>
  .disclosure {
    background: var(--color-surface, #f7f9fb);
    border-left: 3px solid var(--color-accent, #0066cc);
    padding: 0.5rem 0.75rem;
    margin: 0 0 1.5rem;
    font-size: 0.85rem;
    color: var(--color-muted);
  }
  .disclosure p {
    margin: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add site/src/components/AffiliateDisclosure.astro
git commit -m "feat(site): add AffiliateDisclosure component"
```

---

## Task 8: Build `GuideCard.astro` component

**Files:**
- Create: `site/src/components/GuideCard.astro`

- [ ] **Step 1: Create the component**

Create `site/src/components/GuideCard.astro`:

```astro
---
interface Props {
  href: string;
  title: string;
  description: string;
}

const { href, title, description } = Astro.props;
---

<a class="guide-card" href={href}>
  <h3 class="guide-card__title">{title}</h3>
  <p class="guide-card__desc">{description}</p>
  <span class="guide-card__cta">Read the guide →</span>
</a>

<style>
  .guide-card {
    display: block;
    padding: 1rem 1.25rem;
    border: 1px solid var(--color-border, #e0e4e8);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, transform 0.15s;
  }
  .guide-card:hover {
    border-color: var(--color-accent, #0066cc);
    transform: translateY(-2px);
  }
  .guide-card__title {
    margin: 0 0 0.4rem;
    font-size: 1.1rem;
  }
  .guide-card__desc {
    margin: 0 0 0.6rem;
    font-size: 0.9rem;
    color: var(--color-muted);
  }
  .guide-card__cta {
    font-size: 0.85rem;
    color: var(--color-accent, #0066cc);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add site/src/components/GuideCard.astro
git commit -m "feat(site): add GuideCard component"
```

---

## Task 9: Build `RelatedGuides.astro` component

**Files:**
- Create: `site/src/lib/guides.ts`
- Create: `site/src/components/RelatedGuides.astro`

- [ ] **Step 1: Create the guides helper**

Create `site/src/lib/guides.ts`:

```ts
import { getCollection, type CollectionEntry } from "astro:content";

export type Guide = CollectionEntry<"guides">;

export async function getAllGuides(): Promise<Guide[]> {
  return getCollection("guides");
}

export async function getGuidesBySlug(slugs: string[]): Promise<Guide[]> {
  const all = await getAllGuides();
  return slugs
    .map((s) => all.find((g) => g.slug === s))
    .filter((g): g is Guide => g !== undefined);
}
```

- [ ] **Step 2: Create the component**

Create `site/src/components/RelatedGuides.astro`:

```astro
---
import GuideCard from "@components/GuideCard.astro";
import { getGuidesBySlug } from "@lib/guides";

interface Props {
  slugs: string[];
  heading?: string;
}

const { slugs, heading = "Related guides" } = Astro.props;
const guides = await getGuidesBySlug(slugs);
---

{guides.length > 0 && (
  <section class="related">
    <h2>{heading}</h2>
    <div class="related__grid">
      {guides.map((g) => (
        <GuideCard
          href={`/guides/${g.slug}`}
          title={g.data.title}
          description={g.data.description}
        />
      ))}
    </div>
  </section>
)}

<style>
  .related {
    margin-top: 2.5rem;
  }
  .related__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add site/src/lib/guides.ts site/src/components/RelatedGuides.astro
git commit -m "feat(site): add guides helper and RelatedGuides component"
```

---

## Task 10: Build `ToolFrame.astro` component

**Files:**
- Create: `site/src/components/ToolFrame.astro`

This component provides the shared layout scaffold for all tools. The actual form fields and result rendering live in the tool-specific components; ToolFrame just gives them a consistent shell.

- [ ] **Step 1: Create the component**

Create `site/src/components/ToolFrame.astro`:

```astro
---
interface Props {
  title: string;
  toolId: string; // used for form-id attribute
}

const { title, toolId } = Astro.props;
---

<section class="tool" data-tool-id={toolId}>
  <h3 class="tool__title">{title}</h3>
  <div class="tool__body">
    <div class="tool__inputs">
      <slot name="inputs" />
    </div>
    <div class="tool__result">
      <slot name="result" />
    </div>
  </div>
  <details class="tool__details">
    <summary>Show the math</summary>
    <slot name="details" />
  </details>
</section>

<style>
  .tool {
    border: 1px solid var(--color-border, #e0e4e8);
    border-radius: 8px;
    padding: 1.25rem;
    margin: 2rem 0;
    background: var(--color-surface, #fafbfc);
  }
  .tool__title {
    margin: 0 0 1rem;
    font-size: 1.15rem;
  }
  .tool__body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
  @media (max-width: 600px) {
    .tool__body {
      grid-template-columns: 1fr;
    }
  }
  .tool__inputs {
    display: grid;
    gap: 0.5rem;
  }
  .tool__result {
    background: var(--color-bg, #fff);
    border-radius: 6px;
    padding: 0.75rem 1rem;
  }
  .tool__details {
    margin-top: 1rem;
    font-size: 0.9rem;
  }
  .tool__details summary {
    cursor: pointer;
    color: var(--color-accent, #0066cc);
  }
  .tool :global(label) {
    display: block;
    font-size: 0.85rem;
    color: var(--color-muted);
  }
  .tool :global(input),
  .tool :global(select) {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-border, #ccc);
    border-radius: 4px;
    font-size: 0.95rem;
  }
  .tool :global(.tool__use-rates) {
    margin-top: 0.5rem;
    background: none;
    border: 1px solid var(--color-accent, #0066cc);
    color: var(--color-accent, #0066cc);
    padding: 0.35rem 0.7rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add site/src/components/ToolFrame.astro
git commit -m "feat(site): add ToolFrame shared component"
```

---

## Task 11: Add lender facts loader

**Files:**
- Create: `site/src/data/lenders.yaml` (skeleton with one lender)
- Create: `site/src/lib/lenderFacts.ts`
- Create: `site/src/lib/lenderFacts.test.ts`

- [ ] **Step 1: Create the YAML skeleton with one lender**

Create `site/src/data/lenders.yaml`:

```yaml
# Structured facts per lender. Rendered into prose by the lender page template.
# Add a `last_verified_at` (YYYY-MM-DD) every time you fact-check an entry.
lenders:
  rbc:
    full_name: Royal Bank of Canada
    short_name: RBC
    founded_year: 1864
    regulator: OSFI
    channels:
      - branch
      - broker
      - online
    prepayment:
      lump_sum_pct: 10
      payment_increase_pct: 10
    notable_quirks: []
    last_verified_at: "2026-04-28"
```

- [ ] **Step 2: Write the failing tests**

Create `site/src/lib/lenderFacts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getLenderFacts, renderLenderIntro } from "@lib/lenderFacts";

describe("getLenderFacts", () => {
  it("returns facts for known lender", () => {
    const facts = getLenderFacts("rbc");
    expect(facts).not.toBeNull();
    expect(facts!.full_name).toBe("Royal Bank of Canada");
    expect(facts!.founded_year).toBe(1864);
  });

  it("returns null for unknown lender", () => {
    expect(getLenderFacts("not-a-lender")).toBeNull();
  });
});

describe("renderLenderIntro", () => {
  it("includes founded year and regulator in prose", () => {
    const facts = getLenderFacts("rbc")!;
    const intro = renderLenderIntro(facts);
    expect(intro).toContain("1864");
    expect(intro).toContain("OSFI");
    expect(intro.length).toBeGreaterThan(80);
    expect(intro.length).toBeLessThan(800);
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd site && npm run test -- lenderFacts
```

Expected: module not found.

- [ ] **Step 4: Implement the loader**

Create `site/src/lib/lenderFacts.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

export interface LenderFacts {
  full_name: string;
  short_name: string;
  founded_year: number;
  regulator: string;
  channels: ("branch" | "broker" | "online")[];
  prepayment: {
    lump_sum_pct: number;
    payment_increase_pct: number;
  };
  notable_quirks: string[];
  last_verified_at: string;
}

interface LendersFile {
  lenders: Record<string, LenderFacts>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const yamlPath = resolve(__dirname, "../data/lenders.yaml");

let cache: LendersFile | null = null;

function load(): LendersFile {
  if (cache) return cache;
  const raw = readFileSync(yamlPath, "utf8");
  cache = yaml.load(raw) as LendersFile;
  return cache;
}

export function getLenderFacts(slug: string): LenderFacts | null {
  return load().lenders[slug] ?? null;
}

export function renderLenderIntro(facts: LenderFacts): string {
  const channelList = facts.channels.join(", ");
  return [
    `${facts.full_name} (${facts.short_name}) was founded in ${facts.founded_year} and is regulated by ${facts.regulator}.`,
    `Mortgages are originated through ${channelList} channels.`,
    `Standard prepayment privileges allow up to ${facts.prepayment.lump_sum_pct}% annual lump sum and up to ${facts.prepayment.payment_increase_pct}% payment increase per year.`,
  ].join(" ");
}
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd site && npm run test -- lenderFacts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add site/src/data/lenders.yaml site/src/lib/lenderFacts.ts site/src/lib/lenderFacts.test.ts
git commit -m "feat(site): add lenders.yaml and lender facts loader"
```

---

## Task 12: Build `LenderFacts.astro` component

**Files:**
- Create: `site/src/components/LenderFacts.astro`

- [ ] **Step 1: Create the component**

Create `site/src/components/LenderFacts.astro`:

```astro
---
import type { LenderFacts } from "@lib/lenderFacts";

interface Props {
  facts: LenderFacts;
}

const { facts } = Astro.props;
const channelList = facts.channels
  .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
  .join(", ");
const verifiedDate = new Date(facts.last_verified_at).toLocaleDateString("en-CA", {
  year: "numeric",
  month: "short",
});
---

<section class="lender-facts">
  <h2>Lender facts</h2>
  <dl class="lender-facts__grid">
    <dt>Founded</dt>
    <dd>{facts.founded_year}</dd>
    <dt>Regulator</dt>
    <dd>{facts.regulator}</dd>
    <dt>Channels</dt>
    <dd>{channelList}</dd>
    <dt>Prepayment</dt>
    <dd>
      {facts.prepayment.lump_sum_pct}% lump sum / {facts.prepayment.payment_increase_pct}% payment increase
    </dd>
  </dl>
  <p class="lender-facts__verified">Verified {verifiedDate}</p>
</section>

<style>
  .lender-facts {
    margin: 2rem 0;
  }
  .lender-facts__grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.4rem 1rem;
    font-size: 0.95rem;
  }
  .lender-facts__grid dt {
    color: var(--color-muted);
  }
  .lender-facts__grid dd {
    margin: 0;
  }
  .lender-facts__verified {
    margin-top: 0.75rem;
    font-size: 0.8rem;
    color: var(--color-muted);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add site/src/components/LenderFacts.astro
git commit -m "feat(site): add LenderFacts component"
```

---

## Task 13: Wire intro + facts into the lender page

**Files:**
- Modify: `site/src/pages/lenders/[slug].astro`

- [ ] **Step 1: Add intro paragraph and facts table**

Replace the entire content of `site/src/pages/lenders/[slug].astro` with:

```astro
---
import Base from "@layouts/Base.astro";
import Disclaimer from "@components/Disclaimer.astro";
import LenderFacts from "@components/LenderFacts.astro";
import RelatedGuides from "@components/RelatedGuides.astro";
import { formatPercent, formatTermLabel, formatUpdatedAt } from "@lib/format";
import { loadRatesData } from "@lib/rates";
import { getLenderFacts, renderLenderIntro } from "@lib/lenderFacts";

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
const facts = getLenderFacts(lender.slug);
const intro = facts ? renderLenderIntro(facts) : null;
---

<Base
  title={`${lender.name} Mortgage Rates`}
  description={`Current posted and estimated discounted mortgage rates for ${lender.name}, updated daily.`}
  canonical={`https://canadianrates.ca/lenders/${lender.slug}`}
>
  <h1>{lender.name} Mortgage Rates</h1>
  <p class="muted">
    Source: <a href={lender.source_url} rel="noopener" target="_blank">{lender.source_url}</a>
    <br />
    Last updated {formatUpdatedAt(updatedAt)}.
  </p>

  {intro && <p class="lender-intro">{intro}</p>}

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

  {facts && <LenderFacts facts={facts} />}

  {lender.affiliate_url && (
    <p>
      <a class="cta" href={lender.affiliate_url} rel="sponsored noopener" target="_blank">
        Apply with {lender.name} →
      </a>
    </p>
  )}

  <RelatedGuides slugs={["affordability"]} />
</Base>

<style>
  .muted {
    color: var(--color-muted);
    font-size: 0.95rem;
  }
  .lender-intro {
    font-size: 1rem;
    line-height: 1.55;
    margin: 1rem 0 1.25rem;
  }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
cd site && npm run build
```

Expected: build succeeds. RBC page renders intro + facts; other lenders render without intro/facts (until Task 14 adds them).

- [ ] **Step 3: Commit**

```bash
git add site/src/pages/lenders/[slug].astro
git commit -m "feat(site): render lender intro and facts on lender pages"
```

---

## Task 14: Populate `lenders.yaml` for all lenders (USER REVIEW REQUIRED)

**Files:**
- Modify: `site/src/data/lenders.yaml`

This task uses the hybrid authoring workflow. Claude drafts entries from public sources; the user must fact-check before this commit lands.

- [ ] **Step 1: List all lenders currently in `rates.json`**

Run:
```bash
cd site && node -e "import('./scripts/fetch-rates.mjs').then(()=>{const d=JSON.parse(require('fs').readFileSync('src/data/rates.sample.json'));console.log(d.lenders.map(l=>l.slug).join('\n'))})"
```

Or simpler: read `site/src/data/rates.sample.json` and list the `slug` field of each lender.

- [ ] **Step 2: Draft YAML entries for each lender**

For each lender slug not already in `lenders.yaml`, add a complete entry following the RBC schema. Use public sources:

- `founded_year` — Wikipedia / lender's "About" page
- `regulator` — OSFI for federally-regulated banks/trust companies; FSRA for Ontario credit unions; etc.
- `channels` — based on whether they have branches, work with brokers, offer online application
- `prepayment` — published in lender's mortgage terms documents
- `notable_quirks` — anything material (e.g. "Restricted lender — does not allow porting to another property")

For each entry, draft from public sources, then leave `last_verified_at: ""` to be filled in after user verification.

- [ ] **Step 3: PAUSE — user verification gate**

Surface the drafted YAML for user review. The user must:
1. Spot-check 2–3 entries against primary sources (lender's own website)
2. Correct any errors
3. Set `last_verified_at` to today's date for verified entries

Do not proceed to step 4 until the user confirms verification is complete.

- [ ] **Step 4: Build and verify**

```bash
cd site && npm run build
```

Expected: every lender page now renders an intro + facts table.

- [ ] **Step 5: Commit**

```bash
git add site/src/data/lenders.yaml
git commit -m "feat(site): populate lenders.yaml with verified facts for all lenders"
```

---

## Task 15: Draft 8 term-page intros (USER REVIEW REQUIRED)

**Files:**
- Create: `site/src/content/term-intros/1-year-fixed.md`
- Create: `site/src/content/term-intros/2-year-fixed.md`
- Create: `site/src/content/term-intros/3-year-fixed.md`
- Create: `site/src/content/term-intros/4-year-fixed.md`
- Create: `site/src/content/term-intros/5-year-fixed.md`
- Create: `site/src/content/term-intros/7-year-fixed.md`
- Create: `site/src/content/term-intros/10-year-fixed.md`
- Create: `site/src/content/term-intros/variable.md`

- [ ] **Step 1: Draft each intro using the shared template**

Each file uses this frontmatter shape:

```md
---
term: "5yr_fixed"
headline: "The default Canadian mortgage"
last_reviewed_at: "2026-04-28"
---

[200–400 word intro covering: who picks this term and why, how it relates
 to bond yields / prime, when it's the right choice vs alternatives, how
 to read the rate table below, typical broker discount.]
```

The `term` value matches the keys in `lib/rates.ts` (`1yr_fixed`, `2yr_fixed`, ..., `10yr_fixed`, `variable`).

Slug-to-term mapping:
- `1-year-fixed.md` → `1yr_fixed`
- `2-year-fixed.md` → `2yr_fixed`
- `3-year-fixed.md` → `3yr_fixed`
- `4-year-fixed.md` → `4yr_fixed`
- `5-year-fixed.md` → `5yr_fixed`
- `7-year-fixed.md` → `7yr_fixed`
- `10-year-fixed.md` → `10yr_fixed`
- `variable.md` → `variable`

- [ ] **Step 2: PAUSE — user review and rewrite gate**

Per the hybrid authoring workflow:
1. Draft each of the 8 intros
2. Surface drafts for the user to rewrite for voice and fact-check numbers
3. Apply the user's edits
4. Do not proceed to step 3 until user approves all 8

- [ ] **Step 3: Verify the build**

```bash
cd site && npm run build
```

Expected: build succeeds; content collection schema validates all 8 files.

- [ ] **Step 4: Commit**

```bash
git add site/src/content/term-intros/
git commit -m "feat(site): add 8 term-page intros (reviewed and voice-edited)"
```

---

## Task 16: Build `TermIntro.astro` and `TermFaq.astro` components

**Files:**
- Create: `site/src/components/TermIntro.astro`
- Create: `site/src/components/TermFaq.astro`

- [ ] **Step 1: Create `TermIntro.astro`**

Create `site/src/components/TermIntro.astro`:

```astro
---
import { getEntry, render } from "astro:content";
import type { Term } from "@lib/rates";

interface Props {
  termSlug: string; // URL slug, e.g. "5-year-fixed"
}

const { termSlug } = Astro.props;
const entry = await getEntry("term-intros", termSlug);
if (!entry) {
  // Build-time invariant: every term slug should have an intro after Task 15.
  throw new Error(`Missing term intro for slug: ${termSlug}`);
}
const { Content } = await render(entry);
---

<section class="term-intro">
  <h2 class="term-intro__headline">{entry.data.headline}</h2>
  <Content />
</section>

<style>
  .term-intro {
    margin: 1.5rem 0 2rem;
    line-height: 1.6;
  }
  .term-intro__headline {
    font-size: 1.2rem;
    margin: 0 0 0.75rem;
  }
  .term-intro :global(p) {
    margin: 0 0 1rem;
  }
</style>
```

- [ ] **Step 2: Create `TermFaq.astro`**

Create `site/src/components/TermFaq.astro`:

```astro
---
interface FaqItem {
  q: string;
  a: string;
}

interface Props {
  items: FaqItem[];
}

const { items } = Astro.props;
---

{items.length > 0 && (
  <section class="term-faq">
    <h2>Common questions</h2>
    {items.map(({ q, a }) => (
      <details class="term-faq__item">
        <summary>{q}</summary>
        <p>{a}</p>
      </details>
    ))}
  </section>
)}

<style>
  .term-faq {
    margin: 2rem 0;
  }
  .term-faq__item {
    border-top: 1px solid var(--color-border, #e0e4e8);
    padding: 0.75rem 0;
  }
  .term-faq__item summary {
    cursor: pointer;
    font-weight: 600;
  }
  .term-faq__item p {
    margin: 0.5rem 0 0;
    line-height: 1.5;
    color: var(--color-muted);
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add site/src/components/TermIntro.astro site/src/components/TermFaq.astro
git commit -m "feat(site): add TermIntro and TermFaq components"
```

---

## Task 17: Wire intro + FAQ + related guide into term pages

**Files:**
- Modify: `site/src/pages/rates/[term].astro`

- [ ] **Step 1: Define a FAQ map per term**

Add a small per-term FAQ map. For each term, 3–5 short Q&As. Drafted by Claude, user-reviewed (this is part of the same review pass as the intros — surface together).

- [ ] **Step 2: Replace the page content**

Replace `site/src/pages/rates/[term].astro` with:

```astro
---
import Base from "@layouts/Base.astro";
import Disclaimer from "@components/Disclaimer.astro";
import TermIntro from "@components/TermIntro.astro";
import TermFaq from "@components/TermFaq.astro";
import RelatedGuides from "@components/RelatedGuides.astro";
import { formatPercent, formatTermLabel, formatUpdatedAt } from "@lib/format";
import { loadRatesData, ratesByTerm, type Term } from "@lib/rates";

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

// Per-term FAQ map. User-reviewed prose.
const FAQS: Record<string, { q: string; a: string }[]> = {
  "5-year-fixed": [
    { q: "Why are 5-year rates often higher than 3-year today?", a: "..." },
    { q: "What's the typical broker discount on the 5-year fixed?", a: "..." },
    { q: "Can I break a 5-year fixed early?", a: "..." },
  ],
  // ... other terms
};

export async function getStaticPaths() {
  return Object.keys(TERM_SLUGS).map((slug) => ({ params: { term: slug } }));
}

const { term: slug } = Astro.params;
const term = TERM_SLUGS[slug as string];
if (!term) return Astro.redirect("/404");

const data = await loadRatesData();
const entries = ratesByTerm(data, term);
const label = formatTermLabel(term);
const faqItems = FAQS[slug as string] ?? [];

// Pick a related guide. fixed-vs-variable is the universal default for now.
const relatedSlugs = ["fixed-vs-variable", "affordability"];
---

<Base
  title={`Best ${label} Mortgage Rates in Canada`}
  description={`Compare ${label.toLowerCase()} mortgage rates across Canadian lenders. Posted vs. estimated discounted broker-channel rates, updated daily.`}
  canonical={`https://canadianrates.ca/rates/${slug}`}
>
  <h1>Best {label} Mortgage Rates in Canada</h1>
  <p class="muted">Updated {formatUpdatedAt(data.updated_at)}.</p>

  <TermIntro termSlug={slug as string} />

  <Disclaimer variant="rate" />

  {entries.length === 0 ? (
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
              <strong class="lender-row__discounted">{formatPercent(rate.discounted)}</strong>
            </td>
            <td>
              {lender.affiliate_url ? (
                <a class="cta" href={lender.affiliate_url} rel="sponsored noopener" target="_blank">Apply →</a>
              ) : (
                <a class="cta cta--secondary" href={lender.source_url} rel="noopener" target="_blank">Visit lender →</a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}

  <TermFaq items={faqItems} />

  <RelatedGuides slugs={relatedSlugs} />
</Base>

<style>
  .muted {
    color: var(--color-muted);
    font-size: 0.95rem;
  }
</style>
```

- [ ] **Step 3: PAUSE — user review FAQ content**

Surface the FAQ drafts (one set per term) for user review and rewrite. Do not commit until approved.

- [ ] **Step 4: Build and verify**

```bash
cd site && npm run build
```

Expected: build succeeds; every term page renders intro + table + FAQ + related guides.

- [ ] **Step 5: Commit**

```bash
git add site/src/pages/rates/[term].astro
git commit -m "feat(site): add intro, FAQ, and related guides to term pages"
```

---

## Task 18: Build `BreakEvenTool.astro`

**Files:**
- Create: `site/src/components/tools/BreakEvenTool.astro`

- [ ] **Step 1: Create the component**

Create `site/src/components/tools/BreakEvenTool.astro`:

```astro
---
import ToolFrame from "@components/ToolFrame.astro";
import { bestRateForTerm, loadRatesData } from "@lib/rates";

const data = await loadRatesData();
const bestFixed = bestRateForTerm(data, "5yr_fixed");
const bestVar = bestRateForTerm(data, "variable");
const defaultFixed = bestFixed?.rate.discounted ?? 4.79;
const defaultVar = bestVar?.rate.discounted ?? 4.20;
---

<ToolFrame title="Fixed vs variable break-even" toolId="break-even">
  <div slot="inputs">
    <form class="be-form" data-default-fixed={defaultFixed} data-default-var={defaultVar}>
      <label>Loan amount
        <input type="number" name="loanAmount" min="0" step="1000" value="500000" required />
      </label>
      <label>Amortization (years)
        <select name="amortizationYears">
          <option value="20">20</option>
          <option value="25" selected>25</option>
          <option value="30">30</option>
        </select>
      </label>
      <label>Fixed rate (%)
        <input type="number" name="fixedRate" min="0" max="20" step="0.01" value={defaultFixed} required />
      </label>
      <label>Variable rate (%)
        <input type="number" name="variableRate" min="0" max="20" step="0.01" value={defaultVar} required />
      </label>
      <label>Variable rate jumps (% pts)
        <input type="number" name="rateChangePct" min="-5" max="5" step="0.25" value="0" required />
      </label>
      <label>...at month
        <input type="number" name="rateChangeMonth" min="0" max="60" step="1" value="12" required />
      </label>
      <button type="button" class="tool__use-rates" data-action="use-rates">Use today's rates</button>
    </form>
  </div>

  <div slot="result">
    <p class="be-headline" data-result="headline">—</p>
    <p class="be-sub" data-result="sub"></p>
  </div>

  <div slot="details">
    <table class="be-detail">
      <tbody>
        <tr><td>Fixed payment</td><td data-detail="fixed-payment">—</td></tr>
        <tr><td>Variable initial payment</td><td data-detail="var-init">—</td></tr>
        <tr><td>Variable post-change payment</td><td data-detail="var-post">—</td></tr>
        <tr><td>Fixed total interest (5 yr)</td><td data-detail="fixed-int">—</td></tr>
        <tr><td>Variable total interest (5 yr)</td><td data-detail="var-int">—</td></tr>
      </tbody>
    </table>
  </div>
</ToolFrame>

<script>
  import { compareBreakEven } from "@lib/breakEven";
  import { formatCurrency } from "@lib/format";

  const form = document.querySelector<HTMLFormElement>(".be-form");
  if (!form) throw new Error("break-even form not found");
  const root = form.closest('[data-tool-id="break-even"]') as HTMLElement;

  function num(name: string): number {
    return parseFloat((form!.elements.namedItem(name) as HTMLInputElement).value);
  }
  function setText(sel: string, txt: string) {
    const el = root.querySelector(sel);
    if (el) el.textContent = txt;
  }

  function recalc() {
    const r = compareBreakEven({
      loanAmount: num("loanAmount"),
      amortizationYears: num("amortizationYears"),
      fixedRate: num("fixedRate"),
      variableRate: num("variableRate"),
      rateChangePct: num("rateChangePct"),
      rateChangeMonth: num("rateChangeMonth"),
      horizonMonths: 60,
    });
    const winner = r.winner === "tie" ? "tied" : r.winner;
    setText("[data-result='headline']", `${winner === "tied" ? "It's a tie" : capitalize(winner) + " wins"}`);
    setText(
      "[data-result='sub']",
      r.winner === "tie"
        ? "Total interest over 5 years is essentially equal."
        : `Saves ${formatCurrency(r.savingsAmount)} in interest over 5 years vs the other option.`,
    );
    setText("[data-detail='fixed-payment']", formatCurrency(r.fixedPayment, { cents: true }));
    setText("[data-detail='var-init']", formatCurrency(r.variableInitialPayment, { cents: true }));
    setText("[data-detail='var-post']", formatCurrency(r.variablePostChangePayment, { cents: true }));
    setText("[data-detail='fixed-int']", formatCurrency(r.fixedTotalInterest));
    setText("[data-detail='var-int']", formatCurrency(r.variableTotalInterest));
  }

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function applyTodaysRates() {
    (form!.elements.namedItem("fixedRate") as HTMLInputElement).value = form!.dataset.defaultFixed!;
    (form!.elements.namedItem("variableRate") as HTMLInputElement).value = form!.dataset.defaultVar!;
    recalc();
  }

  form.addEventListener("input", recalc);
  form.querySelector('[data-action="use-rates"]')?.addEventListener("click", applyTodaysRates);
  recalc();
</script>

<style>
  .be-headline {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 0 0 0.4rem;
  }
  .be-sub {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.9rem;
  }
  .be-detail {
    width: 100%;
    border-collapse: collapse;
  }
  .be-detail td {
    padding: 0.3rem 0;
    font-size: 0.9rem;
    border-bottom: 1px solid var(--color-border, #eee);
  }
  .be-detail td:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
```

- [ ] **Step 2: Build to verify it compiles**

```bash
cd site && npm run build
```

Expected: build succeeds (component is unused so far, but type-checks).

- [ ] **Step 3: Commit**

```bash
git add site/src/components/tools/BreakEvenTool.astro
git commit -m "feat(site): add BreakEvenTool component"
```

---

## Task 19: Build `AffordabilityTool.astro`

**Files:**
- Create: `site/src/components/tools/AffordabilityTool.astro`

- [ ] **Step 1: Create the component**

Create `site/src/components/tools/AffordabilityTool.astro`:

```astro
---
import ToolFrame from "@components/ToolFrame.astro";
import { bestRateForTerm, loadRatesData } from "@lib/rates";

const data = await loadRatesData();
const best = bestRateForTerm(data, "5yr_fixed");
const defaultRate = best?.rate.discounted ?? 5.0;
---

<ToolFrame title="How much can I afford?" toolId="affordability">
  <div slot="inputs">
    <form class="aff-form" data-default-rate={defaultRate}>
      <label>Gross annual income
        <input type="number" name="grossAnnualIncome" min="0" step="1000" value="120000" required />
      </label>
      <label>Monthly debts (cars, cards, loans)
        <input type="number" name="monthlyDebts" min="0" step="50" value="500" required />
      </label>
      <label>Monthly property tax
        <input type="number" name="estimatedPropertyTax" min="0" step="25" value="400" required />
      </label>
      <label>Monthly heat
        <input type="number" name="estimatedHeat" min="0" step="10" value="100" required />
      </label>
      <label>Monthly condo fees (0 if none)
        <input type="number" name="estimatedCondoFees" min="0" step="50" value="0" required />
      </label>
      <label>Down payment
        <input type="number" name="downPayment" min="0" step="1000" value="80000" required />
      </label>
      <label>Contract rate (%)
        <input type="number" name="contractRate" min="0" max="20" step="0.01" value={defaultRate} required />
      </label>
      <label>Amortization (years)
        <select name="amortizationYears">
          <option value="25" selected>25</option>
          <option value="30">30</option>
        </select>
      </label>
      <button type="button" class="tool__use-rates" data-action="use-rates">Use today's rates</button>
    </form>
  </div>

  <div slot="result">
    <p class="aff-label">Maximum purchase price</p>
    <p class="aff-headline" data-result="price">—</p>
    <p class="aff-sub" data-result="sub"></p>
  </div>

  <div slot="details">
    <table class="aff-detail">
      <tbody>
        <tr><td>Qualifying rate (stress test)</td><td data-detail="qualify">—</td></tr>
        <tr><td>Max mortgage by GDS (39%)</td><td data-detail="gds">—</td></tr>
        <tr><td>Max mortgage by TDS (44%)</td><td data-detail="tds">—</td></tr>
        <tr><td>Max mortgage (binding)</td><td data-detail="max-mort">—</td></tr>
      </tbody>
    </table>
  </div>
</ToolFrame>

<script>
  import { calculateAffordability } from "@lib/affordability";
  import { formatCurrency, formatPercent } from "@lib/format";

  const form = document.querySelector<HTMLFormElement>(".aff-form");
  if (!form) throw new Error("affordability form not found");
  const root = form.closest('[data-tool-id="affordability"]') as HTMLElement;

  function num(name: string): number {
    return parseFloat((form!.elements.namedItem(name) as HTMLInputElement).value);
  }
  function setText(sel: string, txt: string) {
    const el = root.querySelector(sel);
    if (el) el.textContent = txt;
  }

  function recalc() {
    const r = calculateAffordability({
      grossAnnualIncome: num("grossAnnualIncome"),
      monthlyDebts: num("monthlyDebts"),
      estimatedPropertyTax: num("estimatedPropertyTax"),
      estimatedHeat: num("estimatedHeat"),
      estimatedCondoFees: num("estimatedCondoFees"),
      downPayment: num("downPayment"),
      contractRate: num("contractRate"),
      amortizationYears: num("amortizationYears"),
    });
    setText("[data-result='price']", formatCurrency(r.maxPurchasePrice));
    setText("[data-result='sub']",
      `Bound by ${r.bindingConstraint.toUpperCase()}; max mortgage ${formatCurrency(r.maxMortgage)}.`);
    setText("[data-detail='qualify']", formatPercent(r.qualifyingRate));
    setText("[data-detail='gds']", formatCurrency(r.maxMortgageGds));
    setText("[data-detail='tds']", formatCurrency(r.maxMortgageTds));
    setText("[data-detail='max-mort']", formatCurrency(r.maxMortgage));
  }

  function applyTodaysRates() {
    (form!.elements.namedItem("contractRate") as HTMLInputElement).value = form!.dataset.defaultRate!;
    recalc();
  }

  form.addEventListener("input", recalc);
  form.querySelector('[data-action="use-rates"]')?.addEventListener("click", applyTodaysRates);
  recalc();
</script>

<style>
  .aff-label {
    font-size: 0.85rem;
    color: var(--color-muted);
    margin: 0;
  }
  .aff-headline {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0.2rem 0 0.4rem;
  }
  .aff-sub {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.9rem;
  }
  .aff-detail {
    width: 100%;
    border-collapse: collapse;
  }
  .aff-detail td {
    padding: 0.3rem 0;
    font-size: 0.9rem;
    border-bottom: 1px solid var(--color-border, #eee);
  }
  .aff-detail td:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
```

- [ ] **Step 2: Build to verify**

```bash
cd site && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add site/src/components/tools/AffordabilityTool.astro
git commit -m "feat(site): add AffordabilityTool component"
```

---

## Task 20: Write fixed-vs-variable guide MDX (USER REVIEW REQUIRED)

**Files:**
- Create: `site/src/content/guides/fixed-vs-variable.mdx`

- [ ] **Step 1: Generate the structured outline**

Outline structure:
- H1: equivalent to title in frontmatter
- H2: How fixed and variable rates differ
- H2: When fixed wins
- H2: When variable wins
- H2: Try the break-even tool *(MDX import + `<BreakEvenTool/>`)*
- H2: How most Canadians actually choose
- H2: Common questions

- [ ] **Step 2: PAUSE — user reviews outline**

Surface the outline for user approval. User may revise H2 structure or add points before drafting.

- [ ] **Step 3: Draft prose against approved outline**

Create `site/src/content/guides/fixed-vs-variable.mdx`:

```mdx
---
title: "Fixed vs variable mortgage: which to pick in Canada"
description: "Variable rates are usually cheaper today, but fixed locks in certainty. A break-even framing makes the choice explicit."
tool_id: "break-even"
related_guides: ["affordability"]
related_terms: ["5-year-fixed", "variable"]
last_reviewed_at: "2026-04-28"
---
import BreakEvenTool from "@components/tools/BreakEvenTool.astro";

[1500–2500 word draft covering the H2 sections from step 1.
 Embed `<BreakEvenTool />` after the "When variable wins" section.]
```

- [ ] **Step 4: PAUSE — user rewrites for voice and fact-checks**

Per hybrid workflow. User edits prose; Claude applies edits.

- [ ] **Step 5: Final SEO pass**

After user approves the prose, run the final pass:
- Verify H2/H3 structure is logical
- Check meta description is 150–160 chars
- Verify internal links resolve (link to `/rates/5-year-fixed`, `/rates/variable`, `/guides/affordability`)
- Verify the `<BreakEvenTool />` import path resolves and the component renders inline

- [ ] **Step 6: Build and verify**

```bash
cd site && npm run build
```

Expected: `/guides/fixed-vs-variable` builds (note: page template comes in Task 22; for now verify the content file validates against the schema).

- [ ] **Step 7: Commit**

```bash
git add site/src/content/guides/fixed-vs-variable.mdx
git commit -m "feat(site): add fixed-vs-variable guide content"
```

---

## Task 21: Write affordability guide MDX (USER REVIEW REQUIRED)

**Files:**
- Create: `site/src/content/guides/affordability.mdx`

Same workflow as Task 20 (outline → user review → draft → user rewrite → SEO pass → commit).

- [ ] **Step 1: Generate outline**

Outline:
- H2: What "affordability" means in Canada
- H2: GDS, TDS, and the 39/44 ratios
- H2: The federal stress test
- H2: Down payment and CMHC mechanics
- H2: Try the affordability calculator *(`<AffordabilityTool/>`)*
- H2: How banks differ from brokers in qualification
- H2: Common questions

- [ ] **Step 2: PAUSE — user reviews outline**

- [ ] **Step 3: Draft prose**

Create `site/src/content/guides/affordability.mdx`:

```mdx
---
title: "How much mortgage can I afford in Canada?"
description: "Affordability is bound by GDS/TDS ratios, the federal stress test, and your down payment. Here's how to back into your real number."
tool_id: "affordability"
related_guides: ["fixed-vs-variable"]
related_terms: ["5-year-fixed"]
last_reviewed_at: "2026-04-28"
---
import AffordabilityTool from "@components/tools/AffordabilityTool.astro";

[1500–2500 word draft. Embed `<AffordabilityTool />` after the
 down-payment / CMHC section.]
```

- [ ] **Step 4: PAUSE — user rewrite + fact-check**

- [ ] **Step 5: Final SEO pass**

- [ ] **Step 6: Build and verify**

```bash
cd site && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add site/src/content/guides/affordability.mdx
git commit -m "feat(site): add affordability guide content"
```

---

## Task 22: Build `/guides/[slug].astro` page template

**Files:**
- Create: `site/src/pages/guides/[slug].astro`

- [ ] **Step 1: Create the page template**

Create `site/src/pages/guides/[slug].astro`:

```astro
---
import { getCollection, render } from "astro:content";
import Base from "@layouts/Base.astro";
import AuthorByline from "@components/AuthorByline.astro";
import AffiliateDisclosure from "@components/AffiliateDisclosure.astro";
import RelatedGuides from "@components/RelatedGuides.astro";

export async function getStaticPaths() {
  const guides = await getCollection("guides");
  return guides.map((g) => ({ params: { slug: g.slug }, props: { entry: g } }));
}

const { entry } = Astro.props as { entry: import("@lib/guides").Guide };
const { Content } = await render(entry);

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: entry.data.title,
  description: entry.data.description,
  datePublished: entry.data.last_reviewed_at,
  dateModified: entry.data.last_reviewed_at,
  author: {
    "@type": "Organization",
    name: "Mortgage Rates Canada editorial team",
    url: "https://canadianrates.ca/about",
  },
  publisher: {
    "@type": "Organization",
    name: "Canadian Rates",
    url: "https://canadianrates.ca",
  },
};
---

<Base
  title={entry.data.title}
  description={entry.data.description}
  canonical={`https://canadianrates.ca/guides/${entry.slug}`}
>
  <script type="application/ld+json" set:html={JSON.stringify(articleSchema)} />

  <article class="guide">
    <h1>{entry.data.title}</h1>
    <AuthorByline lastReviewedAt={entry.data.last_reviewed_at} />
    <AffiliateDisclosure />
    <Content />
  </article>

  <RelatedGuides slugs={entry.data.related_guides} />
</Base>

<style>
  .guide {
    line-height: 1.65;
  }
  .guide :global(h2) {
    margin-top: 2rem;
  }
  .guide :global(h3) {
    margin-top: 1.5rem;
  }
  .guide :global(p) {
    margin: 0 0 1rem;
  }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
cd site && npm run build
```

Expected: `/guides/fixed-vs-variable` and `/guides/affordability` both build with their tools embedded.

- [ ] **Step 3: Smoke-test in preview**

```bash
cd site && npm run preview
```

Open `http://localhost:4321/guides/fixed-vs-variable` and `http://localhost:4321/guides/affordability` in a browser. Verify:
- Title, byline, disclosure render
- Tool inputs work and update the result
- "Use today's rates" button populates inputs
- Related guides block shows the sibling guide

Stop preview with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add site/src/pages/guides/[slug].astro
git commit -m "feat(site): add /guides/[slug] page template with JSON-LD schema"
```

---

## Task 23: Build `/guides/index.astro`

**Files:**
- Create: `site/src/pages/guides/index.astro`

- [ ] **Step 1: Create the index page**

Create `site/src/pages/guides/index.astro`:

```astro
---
import Base from "@layouts/Base.astro";
import GuideCard from "@components/GuideCard.astro";
import { getAllGuides } from "@lib/guides";

const guides = await getAllGuides();
guides.sort((a, b) => a.data.title.localeCompare(b.data.title));
---

<Base
  title="Mortgage Guides"
  description="Plain-English explainers on Canadian mortgages — fixed vs variable, affordability, the stress test, and more."
  canonical="https://canadianrates.ca/guides"
>
  <h1>Mortgage Guides</h1>
  <p class="muted">Researched and written by the Mortgage Rates Canada editorial team.</p>

  <div class="guides-grid">
    {guides.map((g) => (
      <GuideCard
        href={`/guides/${g.slug}`}
        title={g.data.title}
        description={g.data.description}
      />
    ))}
  </div>
</Base>

<style>
  .muted {
    color: var(--color-muted);
    font-size: 0.95rem;
  }
  .guides-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
cd site && npm run build
```

Expected: `/guides/` renders both guide cards.

- [ ] **Step 3: Commit**

```bash
git add site/src/pages/guides/index.astro
git commit -m "feat(site): add guides index page"
```

---

## Task 24: Add "Guides" to header navigation

**Files:**
- Modify: `site/src/layouts/Base.astro`

- [ ] **Step 1: Find the existing nav block**

Open `site/src/layouts/Base.astro`. Locate the header `<nav>` element.

- [ ] **Step 2: Add the Guides link**

Add a `<a href="/guides">Guides</a>` link in the nav, positioned between any "Rates" link and "Calculator" link. Match the existing link styling exactly.

- [ ] **Step 3: Build and verify**

```bash
cd site && npm run build && npm run preview
```

Open the preview and verify the Guides link is present and clickable on every page. Stop preview.

- [ ] **Step 4: Commit**

```bash
git add site/src/layouts/Base.astro
git commit -m "feat(site): add Guides link to header navigation"
```

---

## Task 25: Add "Learn" section to home page

**Files:**
- Modify: `site/src/pages/index.astro`

- [ ] **Step 1: Add the Learn section**

In `site/src/pages/index.astro`, after the existing rates-section and before the Calculator section, add:

```astro
import GuideCard from "@components/GuideCard.astro";
import { getAllGuides } from "@lib/guides";
// ...
const guides = await getAllGuides();
// ...
```

In the body, between the rates section and the calculator section:

```astro
<section class="learn-section">
  <h2>Learn before you choose</h2>
  <p class="muted">Plain-English guides covering the decisions every Canadian homeowner faces.</p>
  <div class="learn-grid">
    {guides.map((g) => (
      <GuideCard
        href={`/guides/${g.slug}`}
        title={g.data.title}
        description={g.data.description}
      />
    ))}
  </div>
  <p><a href="/guides">All guides →</a></p>
</section>
```

Add matching CSS:

```css
.learn-section {
  margin: 2rem 0;
}
.learn-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}
```

- [ ] **Step 2: Build and verify**

```bash
cd site && npm run build && npm run preview
```

Verify the home page shows the Learn section with guide cards. Stop preview.

- [ ] **Step 3: Commit**

```bash
git add site/src/pages/index.astro
git commit -m "feat(site): add Learn section to home page"
```

---

## Task 26: Add "How we write our guides" to methodology page

**Files:**
- Modify: `site/src/pages/methodology.astro`

- [ ] **Step 1: Append the new section**

At the end of `site/src/pages/methodology.astro`, before `</Base>`, add:

```astro
  <h2>How we write our guides</h2>
  <p>
    Each guide is researched against primary sources — the Bank of Canada, OSFI,
    CMHC, lender rate sheets, and federal mortgage regulations — then drafted,
    edited for clarity, and reviewed before publication. The math behind every
    interactive tool is implemented as pure functions with unit tests, so the
    same calculation runs in the browser and in our test suite.
  </p>
  <p>
    We commit to reviewing each guide every quarter and updating it whenever
    underlying rules change (for example, a CMHC premium tier change or a
    federal stress-test rule update). Every guide has a "Last reviewed" date
    visible at the top of the page.
  </p>
```

- [ ] **Step 2: Commit**

```bash
git add site/src/pages/methodology.astro
git commit -m "feat(site): add 'how we write our guides' to methodology page"
```

---

## Task 27: Add "Editorial team" section to about page

**Files:**
- Modify: `site/src/pages/about.astro`

- [ ] **Step 1: Append the new section**

At the end of `site/src/pages/about.astro`, before `</Base>`, add:

```astro
  <h2>Editorial team</h2>
  <p>
    Guides on this site are written by the Mortgage Rates Canada editorial
    team. Content is researched against primary sources (Bank of Canada,
    OSFI, CMHC, lender rate sheets), drafted, edited, and reviewed before
    publication. We do not publish ghostwritten content under fictional
    bylines, and we don't claim credentials we don't have.
  </p>
  <p>
    Every guide shows a "Last reviewed" date. We commit to reviewing each
    guide every quarter and updating immediately when underlying rules change.
    See our <a href="/methodology">methodology</a> for the full process.
  </p>
```

- [ ] **Step 2: Commit**

```bash
git add site/src/pages/about.astro
git commit -m "feat(site): add editorial team section to about page"
```

---

## Task 28: End-to-end acceptance verification

**Files:** none modified.

This task runs the acceptance checklist from the spec and surfaces any gaps to fix before declaring Phase 1 done.

- [ ] **Step 1: Verify no `yourdomain.ca` remains**

```bash
grep -r "yourdomain" site/ docs/ || echo "(none found — expected)"
```

Expected: only doc references in older specs/plans (those are historical and OK).

- [ ] **Step 2: Run full CI suite**

```bash
cd site && npm run check && npm run build && npm run test
cd ../scraper && uv run pytest
```

Expected: all green.

- [ ] **Step 3: Verify content collection coverage**

```bash
ls site/src/content/term-intros/ | wc -l
ls site/src/content/guides/ | wc -l
```

Expected: 8 term-intros, 2 guides.

- [ ] **Step 4: Verify lender YAML coverage**

Run a small node check that every `slug` in `rates.sample.json` has an entry in `lenders.yaml`:

```bash
cd site && node -e "
const fs = require('fs');
const yaml = require('js-yaml');
const rates = JSON.parse(fs.readFileSync('src/data/rates.sample.json'));
const lf = yaml.load(fs.readFileSync('src/data/lenders.yaml', 'utf8'));
const missing = rates.lenders.map(l => l.slug).filter(s => !lf.lenders[s]);
if (missing.length) { console.error('MISSING:', missing); process.exit(1); }
console.log('all lenders covered');
"
```

Expected: `all lenders covered`.

- [ ] **Step 5: Smoke-test every Phase 1 page in preview**

```bash
cd site && STAGING=true npm run build && npm run preview
```

Open each in a browser and verify no console errors:
- `/`
- `/guides/`
- `/guides/fixed-vs-variable`
- `/guides/affordability`
- `/rates/5-year-fixed` (representative term page)
- `/rates/variable`
- `/lenders/rbc` (representative lender page)
- `/about`
- `/methodology`

For each guide page, also verify:
- Tool inputs respond to typing
- "Use today's rates" populates inputs from rates data
- Related guides block renders

Stop preview.

- [ ] **Step 6: Lighthouse SEO audit**

For each of the 4 critical URLs (`/`, `/guides/fixed-vs-variable`, `/rates/5-year-fixed`, `/lenders/rbc`):

In Chrome DevTools → Lighthouse → "SEO" category → "Analyze page load".

Acceptance: SEO score ≥ 95 on each.

If a page falls below 95, fix the flagged issues (typically meta description length, heading order, or alt text) and re-run.

- [ ] **Step 7: Mobile rendering check (375px)**

In DevTools, set viewport to 375px width and verify on each guide page:
- Tool inputs and result panel stack vertically
- No horizontal scroll
- Text is readable (≥14px)

- [ ] **Step 8: Manual broken-link check**

```bash
cd site && npm run build
npx linkinator dist --recurse --skip "https?://"
```

Expected: 0 broken internal links.

- [ ] **Step 9: Update spec status**

Modify the spec frontmatter at `docs/superpowers/specs/2026-04-28-content-and-tools-phase-1-design.md`:

Change `**Status:** Approved (pending user review of this written spec)` to `**Status:** Implemented (YYYY-MM-DD)` (use today's date).

- [ ] **Step 10: Commit final status update**

```bash
git add docs/superpowers/specs/2026-04-28-content-and-tools-phase-1-design.md
git commit -m "docs(spec-4): mark Phase 1 design as implemented"
git push origin main
```

- [ ] **Step 11: Sign off**

Phase 1 is complete. The site can now flip the staging gate to public:
1. In Cloudflare Pages dashboard, change `STAGING` env var → `false`
2. Edit `site/public/robots.txt`: `Disallow: /` → `Allow: /`, add `Sitemap: https://canadianrates.ca/sitemap.xml`
3. Remove `_headers` X-Robots-Tag line (or update it for production caching headers)
4. Add `canadianrates.ca` as a custom domain in Cloudflare Pages
5. Configure DNS (CNAME → `mortgage-rates-canada.pages.dev`) at your domain registrar
6. Submit sitemap to Google Search Console

Those launch steps are intentionally out of scope for this implementation plan — they require credentials and DNS access.

---

## Self-Review Checklist (for the executing agent)

After completing all tasks, verify:

- [ ] No `yourdomain.ca` references remain in `site/`
- [ ] `lib/breakEven.ts` and `lib/affordability.ts` have ≥90% test coverage
- [ ] `lenders.yaml` covers every slug in `rates.json`
- [ ] 8 term-intros files exist and validate against the schema
- [ ] `/guides/fixed-vs-variable` and `/guides/affordability` build and embed working tools
- [ ] Header nav has "Guides" link
- [ ] Home page has "Learn" section above Calculator
- [ ] Methodology page has "How we write our guides" section
- [ ] About page has "Editorial team" section
- [ ] Lighthouse SEO ≥ 95 on all 4 critical URLs
- [ ] All CI checks pass
- [ ] Spec status updated to `Implemented`

If any line above is unchecked, the plan is not complete.
