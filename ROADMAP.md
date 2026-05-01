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

## Up next (review-driven follow-ups, May 2026)

The full-site review on 2026-05-01 surfaced 12 concrete improvements. Grouped into phases below; Phase A first since it closes the biggest gaps with the smallest diff.

### Phase A — Sitewide UI gaps
- **A.1** Open Graph + Twitter Card tags in `Base.astro` with a default `og:image` in `/public`. Single edit, all 48 pages.
- **A.2** Mobile nav: `@media (max-width: 720px)` block, click-toggle on dropdowns, and fix the "Rates ▾" trigger that currently points to `/` instead of a rates index.

### Phase B — Content corrections + meta polish
- **B.1** Content fixes: NS non-resident DTT history (reduced 2024, not repealed 2023); BC 20% Additional PTT geographic qualifier; Big 6 prepayment 15/15–20/20; 2025 GST rebate expansion mention; QC LTT $5,732.50 example correction; "as of 2025" → 2026; "5×" → "3–5×".
- **B.2** Trim 11 over-length titles (target ≤43 chars page-supplied — auto-append eats 17); tighten 8 over-length meta descriptions to 150–160 chars; beef up 5 thin utility-page descriptions.

### Phase C — Hub pages + structure
- **C.1** Build `/rates/index.astro` and `/lenders/index.astro` (auto-fixes the breadcrumb URL/name mismatch).
- **C.2** Build `/calculators/index.astro` listing all 5 tools.
- **C.3** Visible breadcrumb component on province/term/lender/guide pages; consume the same array the JSON-LD builder uses.

### Phase D — Discoverability + cross-linking
- **D.1** Cross-link lender pages: "Compare with other major banks" + "Best [term] rates" blocks. Add NBC dual-channel editorial note (retail concentrated in QC, broker channel national) and parallel callouts on BC/AB/ON province pages.
- **D.2** Auto-link glossary terms in MDX (first occurrence of IRD/GDS/TDS/CMHC/posted rate/stress test → `<a href="/glossary#…">`).

### Phase E — Trust + UX polish
- **E.1** `Article` `image` field on guide schemas; enrich `Organization` with `sameAs`/`description`; `FAQPage` schema on `/rates/other-terms`; homepage canonical slash-less.
- **E.2** Calculator page (`/calculator`) expanded to ~400+ words + `WebApplication` JSON-LD.
- **E.3** Form UX: `aria-live="polite"` on result regions; help text on AffordabilityTool tax/heat and PenaltyTool `postedSpread`; "Last reviewed" date on calculator/methodology/about/glossary/province/term pages; server-side correct `data-fixed-only` rendering; visible validation on negative/empty inputs.

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
