# Roadmap

Tracks committed-but-not-yet-built improvements. Items here are decided; the prioritization is fixed unless the user revises it.

## In progress

### 1. Rate history charts

Show how 5-year fixed, 3-year fixed, and variable rates have moved over the last 12–24 months on the home page and per-term pages. Single biggest feature differentiator versus other Canadian rate-comparison sites.

**Data plan**: scraper writes a daily snapshot (best discounted + average discounted per term) to `site/src/data/rates-history.json`. Site renders an SVG line chart from the time series.

**Status**: building.

## Up next

### 2. Province landing pages

`/provinces/ontario`, `/provinces/bc`, `/provinces/quebec`, etc. Each surfaces:
- Provincial credit unions first in the rate table
- Province-specific land transfer tax notes
- First-time-home-buyer programs available in that province
- Local notes (e.g. BC speculation tax, Quebec notary system, Toronto LTT)

Major SEO multiplier — Canadian mortgage searches frequently include the province.

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
