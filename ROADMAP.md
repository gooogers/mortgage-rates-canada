# Roadmap

Tracks committed-but-not-yet-built improvements. Items here are decided; the prioritization is fixed unless the user revises it.

## Done

### 1. Rate history charts ✅

Daily snapshots aggregated by `snapshot-rates.mjs` into `rates-history.json`; SVG line chart on home page (5/3/variable) and per-term pages (single line). Empty-state until ≥2 days; methodology page documents the no-synthesised-history rule. Shipped in commit `a458a9f`.

### 2. Province landing pages ✅

`/provinces/[slug]` for all 10 provinces, plus a `/provinces` index. Each page surfaces best rates within the province scope (national + provincial lenders), the full provincial rate table with "Local" tags on credit unions, LTT summary with municipal add-ons (Toronto MLTT, Halifax HRM, Montreal), provincial first-time buyer programs, and local notes (BC PTT exemption, Ontario MLTT, Quebec notary system, etc.). Provinces link added to global nav.

## Done

### 3. Land transfer tax + closing cost calculator ✅

Province-aware tool covering all 10 provinces with marginal-bracket schedules, Toronto/Halifax/Montreal municipal add-ons, and FTHB rebates for BC, ON, and PE. Pure math in `closingCosts.ts` with 16 unit tests; tool component in `ClosingCostsTool.astro`; `/guides/closing-costs` guide explains what's in/out of scope. Added to Calculators dropdown and home tools grid.

### 6. Glossary ✅

`/glossary` page with 28 plain-English Canadian mortgage term definitions (IRD, GDS, TDS, posted vs discounted, CMHC, stress test, etc.). Alphabetical, with jump-nav and anchor IDs for direct linking. Cross-links into related guides where applicable. Linked from the footer.

## In progress

(none)

## Up next

### 8. Lender review pages

Turn the existing rate-table-only `/lenders/[slug]` pages into opinionated short reviews:
- Penalty math (big-bank posted-rate IRD vs monoline)
- Prepayment privileges
- Notable perks or quirks
- Who they're best / worst for

E-E-A-T win for SEO; gives the site editorial weight beyond rate tables.

## Not on the roadmap (mentioned but not committed)

- Affiliate URL wiring + broker lead form (#4) — operational/business work, not coding
- Email rate alerts (#5)
- Glossary (#6)
- Dedicated calculator landing pages (#7)
