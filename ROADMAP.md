# Roadmap

Tracks committed-but-not-yet-built improvements. Items here are decided; the prioritization is fixed unless the user revises it.

## Done

### 1. Rate history charts ✅

Daily snapshots aggregated by `snapshot-rates.mjs` into `rates-history.json`; SVG line chart on home page (5/3/variable) and per-term pages (single line). Empty-state until ≥2 days; methodology page documents the no-synthesised-history rule. Shipped in commit `a458a9f`.

### 2. Province landing pages ✅

`/provinces/[slug]` for all 10 provinces, plus a `/provinces` index. Each page surfaces best rates within the province scope (national + provincial lenders), the full provincial rate table with "Local" tags on credit unions, LTT summary with municipal add-ons (Toronto MLTT, Halifax HRM, Montreal), provincial first-time buyer programs, and local notes (BC PTT exemption, Ontario MLTT, Quebec notary system, etc.). Provinces link added to global nav.

## In progress

(none)

## Up next

### 3. Land transfer tax + closing cost calculator

Province-aware. Computes:
- Provincial LTT (ON, BC, MB, NB, NS, PE, QC) with FTHB rebates where applicable
- Toronto municipal LTT
- Legal/title insurance (~$1,500 typical)
- Inspection (~$500 typical)
- Total closing costs

High search volume; very few good Canadian implementations online. Pairs with the affordability tool.

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
