# myfireplan.ca — Phase 1 Design

**Date:** 2026-04-30
**Status:** Draft for review
**Domain:** `myfireplan.ca` (to be purchased)
**Repo:** new repo (separate from `mortgage-rates-canada`)

## Background and motivation

The existing `mortgage-rates-canada` site has no traffic and a difficult monetization path: Canadian mortgages are dominated by aggregator competitors and most lenders do not run public affiliate programs. Rather than invest further in monetizing zero-traffic mortgage content, we are pivoting to a focused **calculator-first FIRE planning site under `myfireplan.ca`**.

The pivot reuses the underlying competence (Astro + Cloudflare Pages + calculator framework + content workflow) but targets a different audience (Canadian FIRE / personal finance enthusiasts) and a different revenue model (online-brokerage affiliate referrals, where payouts are real and approval is straightforward).

The existing mortgage rate site is **mothballed**, not migrated: scrapers continue running on the existing deployment, but no new features are added. Only the FIRE-relevant subset of mortgage *content* (the "invest vs. pay down mortgage" decision) carries over conceptually.

## Goal

Ship a focused, calculator-first FIRE planning site for Canadians, anchored by three hero calculators with tax-accurate Canadian logic and contextual brokerage affiliate CTAs.

Specifically:
- 3 hero calculators with verified Canadian tax math
- 3 long-form guides (one per calculator)
- A `/plan` hub page that ties the calculators together as a guided sequence
- A `/best-brokerage-for-you` recommender (replaces a generic comparison table)
- Affiliate redirect plumbing usable across all CTAs
- An `/about` and `/disclosure` page reusing existing patterns

Not goals for Phase 1: HISA / GIC rate tracking, credit cards, newsletter, account aggregation, additional calculators beyond the hero set, paid plans.

## Brand and positioning

**Brand:** `myfireplan.ca` — a personal FIRE planning site for Canadians.

**Voice:** Direct, math-forward, tax-accurate, opinionated where the math justifies an opinion. Not preachy. Not US-centric.

**Wedge:** Canadian-tax-aware calculators that other Canadian FIRE blogs hand-wave on. Specifically, the "invest vs. pay down mortgage" calculator with proper RRSP-deduction-recycling, prepayment privilege caps, and marginal tax rate handling. No competing calculator does this well.

**Out of brand:** Commodity rate-tracking (mortgages, HISAs, GICs, credit cards). Those belong on a different domain if they are ever built.

## Pages and IA

```
/                         hub: pitch + 3 calculators teased + plan CTA
/plan                     guided sequence linking the 3 calculators
/calculators/
  invest-vs-paydown-mortgage    hero calculator #1
  coast-fire-canada             hero calculator #2
  rrsp-vs-tfsa                  hero calculator #3
  mortgage-payment              ported from existing site
/guides/
  should-i-invest-or-pay-down-mortgage   companion to #1
  coast-fire-canada                       companion to #2
  rrsp-vs-tfsa-canada                     companion to #3
/best-brokerage-for-you   3-4 question recommender, outputs a brokerage + affiliate CTA
/about
/disclosure               affiliate disclosure (existing pattern)
/privacy
/terms
/go/[slug]                affiliate redirect (Cloudflare Pages Function)
```

**Top nav:** `My Plan` (→ `/plan`) | `Calculators` (→ `/calculators/`) | `Guides` (→ `/guides/`) | `Brokerage` (→ `/best-brokerage-for-you`) | `About` (→ `/about`)

## Hero calculators

All three share a **calculator framework**: same input components, same output/chart components, same expandable "explain the math" section, same affiliate CTA slot at the bottom, same disclaimer block.

### 1. Invest vs. pay down mortgage

**URL:** `/calculators/invest-vs-paydown-mortgage`

**Inputs:**
- Mortgage balance (CAD)
- Mortgage interest rate (%)
- Years remaining on amortization
- Annual prepayment privilege (% of original balance)
- Available extra cash flow per year (CAD)
- Investor's marginal tax rate (%)
- Expected nominal annual investment return (%)
- Account type: RRSP / TFSA / non-registered
- Time horizon (years)

**Outputs:**
- Net worth at horizon under each strategy: pure paydown, pure invest, 50/50 split
- Mortgage balance trajectory over time (chart)
- Portfolio trajectory over time (chart)
- Sensitivity table: net worth delta as expected return varies from 4% to 10%

**Math notes:**
- RRSP contributions generate a tax refund that is **assumed reinvested** (RRSP-deduction-recycling). Surface this assumption explicitly with a toggle.
- Non-registered investments incur annual tax drag at the marginal rate × distribution yield assumption (default 2%).
- TFSA assumed tax-free.
- Prepayment privilege caps annual extra payments. Excess goes to investments.
- Mortgage rate assumed constant over the time horizon (v1 simplification — flagged in the assumptions block).

### 2. Coast FIRE Canada

**URL:** `/calculators/coast-fire-canada`

**Inputs:**
- Current age
- Target retirement age
- Current portfolio (CAD)
- Expected real annual return (%)
- Annual retirement spending in today's dollars (CAD)
- Optional: include CPP / OAS in retirement income? (yes/no)
- Optional: years of CPP contributions (for CPP estimate)

**Outputs:**
- Coast FIRE number (portfolio size at which you can stop contributing and still hit retirement target)
- Years until you reach Coast FIRE
- Projected portfolio at retirement (chart)
- Required savings rate to reach Coast FIRE by various target ages

**Math notes:**
- Uses 4% safe withdrawal rate by default, configurable.
- CPP estimate uses simplified formula (max benefit × (years contributed / 39)) — flagged as approximation.
- OAS estimate uses standard maximum × (years residency after 18 / 40), capped at residency assumption.

### 3. RRSP vs TFSA optimizer

**URL:** `/calculators/rrsp-vs-tfsa`

**Inputs:**
- Pre-tax contribution amount (CAD)
- Current marginal tax rate (%)
- Expected withdrawal marginal tax rate (%)
- Years until withdrawal
- Expected annual return (%)

**Outputs:**
- After-tax dollars at withdrawal under RRSP, TFSA, and split strategies
- Recommendation with one-sentence reason
- Sensitivity table: after-tax outcome as withdrawal tax rate varies

**Math notes:**
- Assumes RRSP refund is reinvested in a non-registered account at the same return (with tax drag), unless toggled off.
- Both accounts assumed to grow tax-free internally.
- Surfaces the principle: "RRSP wins if withdrawal rate < contribution rate; TFSA wins otherwise; refund-recycling tilts further toward RRSP."

## `/plan` hub page

A single page that tells visitors how the three calculators fit together as a sequence:

1. **Where am I now?** → links to a quick net-worth calculator (Phase 2 — for now, links to a guide)
2. **When can I FIRE?** → Coast FIRE calculator
3. **Should I pay down or invest?** → invest-vs-paydown calculator
4. **Which account?** → RRSP vs TFSA calculator
5. **Where do I open the account?** → `/best-brokerage-for-you`

Each step has a one-paragraph framing and a CTA to the relevant page. This is the on-brand expression of "myfireplan" — a guided plan, not a comparison hub.

## `/best-brokerage-for-you` recommender

Asks 3–4 questions and recommends one brokerage with an affiliate CTA. Replaces a generic comparison table.

**Questions:**
1. Are you a self-directed investor or do you want a robo-advisor managing your portfolio?
2. What's your typical portfolio size?
3. Do you trade frequently (>5 trades/month) or buy-and-hold?
4. Do you need US-dollar accounts (e.g., for VTI, VOO)?

**Logic:** simple decision tree mapping answers to a brokerage. Initial mappings:
- Robo + small balance → Wealthsimple
- Self-directed + buy-and-hold + USD needed → Questrade or Qtrade (Norbert's Gambit story)
- Self-directed + frequent trader → Questrade or IBKR
- Robo + larger balance → Wealthsimple Premium or CI Direct Investing

Mappings live in YAML so they can be tuned without code changes. Each recommendation surfaces affiliate CTA + a "see why" expandable explanation.

## Brokerage data

**File:** `manual-brokerages.yaml` (same shape as the existing `manual-rates.yaml`)

**Fields per brokerage:**
- `slug`, `name`, `logo`
- `account_types` (RRSP, TFSA, FHSA, RESP, non-reg, USD-non-reg, etc.)
- `commission_per_trade` (CAD)
- `etf_fees` (free / partial / full)
- `account_fee` (CAD/year)
- `minimum_balance`
- `affiliate_url`, `affiliate_network`, `payout_notes`
- `recommender_tags` (e.g., `["robo", "small-balance"]` or `["self-directed", "frequent-trader", "usd"]`)

**Initial brokerages (~6–8):** Wealthsimple, Questrade, Qtrade, NBDB, Interactive Brokers Canada, CI Direct Investing, BMO InvestorLine.

Brokerage data does **not** drive a public comparison page. It powers the recommender + per-brokerage explanation cards on calculator output pages.

## Affiliate plumbing

**`/go/[slug]` redirect** (Cloudflare Pages Function):
- Looks up `slug` in a brokerages registry
- Logs the click (Cloudflare KV initially; D1 later if volume warrants)
- 302s to the affiliate URL with UTM params attached: `utm_source=myfireplan.ca`, `utm_medium=referral`, `utm_campaign=<page-slug>`, `utm_content=<cta-position>`
- Falls back to homepage if slug is unknown
- Robots-noindex on the redirect endpoint

**`AffiliateDisclosure.astro`** component:
- Identical pattern to the existing site
- Rendered on every page that has an affiliate link (all calculators, recommender, guides where CTAs appear, plan page)
- Links to `/disclosure`

**`/disclosure` page:**
- Plain-language explanation: which brokerages we have affiliate relationships with, that recommendations are based on user inputs not commission size, that revenue funds the site
- Lists every active affiliate partner

## Content / editorial

Three long-form guides at launch, each a companion to one calculator:

1. **`/guides/should-i-invest-or-pay-down-mortgage`** — the SEO goldmine. Walks through the framework, the tax mechanics, the behavioral considerations, with a CTA to the calculator. ~2000 words.
2. **`/guides/coast-fire-canada`** — explains Coast FIRE for Canadians, including CPP/OAS interactions. ~1500 words.
3. **`/guides/rrsp-vs-tfsa-canada`** — the canonical Canadian explainer with the actual math, not the hand-wave. ~1500 words.

Each guide ends with the calculator CTA and a brokerage CTA via `/go/[slug]`.

Use the existing `content/guides/` MDX pattern from the mortgage site (port the schema and `[slug].astro` page template).

## Repo and deployment

**New repo:** `myfireplan` (or similar) — separate from the existing `mortgage-rates-canada` repo.

**Stack:** Astro + Cloudflare Pages, identical to the existing site.

**Reused from existing site (copied, not shared library):**
- Astro + Tailwind / CSS variable setup
- The mortgage payment calculator (ported wholesale from `/calculator` to `/calculators/mortgage-payment`)
- Calculator scaffolding patterns extracted from the existing `/calculator` page
- `AffiliateDisclosure.astro`
- `RelatedGuides.astro`
- Content collection setup for guides
- `[slug].astro` page template patterns
- Cloudflare Pages config
- Vitest setup

**Not reused:** scraper code, lender data files, lender pages, rate-by-term pages, `manual-rates.yaml`.

**Existing site fate:** mothball. Deployment continues to run on Cloudflare Pages free tier. Scrapers continue running daily. No active development. Costs ~$0/month.

## Affiliate program signups (parallel manual task)

Apply for these in parallel with the build, since approvals take 1–4 weeks:
- Wealthsimple affiliate
- Questrade affiliate
- Qtrade affiliate
- Passiv affiliate (rebalancing tool, fits the audience)
- Interactive Brokers Canada referral program

Track approval status in a markdown file in the repo.

## Success criteria

Phase 1 ships when:
- 3 calculators live, with input/output/chart components working in browsers
- Each calculator has tested Canadian tax math, verified against at least 3 worked examples
- 3 guides published, each linking to its calculator and to `/go/[slug]` brokerage CTAs
- `/plan` hub page renders and links calculators in sequence
- `/best-brokerage-for-you` recommender returns a brokerage based on inputs
- `/go/[slug]` redirects work with UTM tagging and click logging
- `AffiliateDisclosure.astro` renders on every monetized page
- `/about`, `/disclosure`, `/privacy`, `/terms` all live
- At least 2 affiliate program approvals received and live affiliate URLs in `manual-brokerages.yaml`
- Domain `myfireplan.ca` purchased and pointing at the Cloudflare Pages deployment
- Site deployed to staging with `noindex` until launch decision

## Implementation risks

1. **Calculator math correctness is load-bearing.** A FIRE site with bad math is worse than nothing. Each calculator needs unit tests against worked examples, and a clearly stated assumptions block on the page. Tests in Vitest using the existing setup.
2. **Affiliate program approvals can take 1–4 weeks.** Start applications immediately, before code is written. Site can launch with placeholder CTAs in the few cases where approval lags.
3. **Brokerage fee data goes stale silently.** Add a quarterly review reminder: a GitHub Actions workflow that opens an issue on the first of every quarter prompting a fee data review.
4. **The "invest vs. pay down" calculator is genuinely complex.** RRSP-deduction-recycling, prepayment privilege caps, and varying mortgage rate over time are real edge cases. Ship v1 with stated assumptions (constant mortgage rate, default tax-drag rate, default refund-recycled), not a v1 that pretends to handle every scenario.
5. **The recommender can produce confident-but-wrong recommendations.** Mitigate by surfacing the "see why" explanation and noting alternatives. Add a "this isn't financial advice" disclaimer.
6. **Domain availability.** `myfireplan.ca` should be purchased before further work — if unavailable, the brand needs revisiting before the spec is final.

## Out of scope (Phase 2+ candidates)

- Newsletter / email capture
- TFSA/RRSP contribution-room tracker
- Net worth tracker / portfolio import (Wealthica-style)
- Additional calculators (RRIF withdrawal sequencer, FHSA optimizer, compound-interest-with-tax-drag)
- Spousal RRSP / income-splitting analysis
- HISA / GIC rate tables (different brand if ever)
- Credit card content (different brand if ever)
- Paid tier / subscription
- French-language version
- Account aggregation / progress tracking against the plan

## Open questions

None blocking. Decisions to make as part of implementation:
- Chart library choice (likely Chart.js or a lightweight Astro-friendly alternative)
- Color palette / visual identity for the new brand
- Click logging storage (Cloudflare KV initially; revisit if volume justifies D1)
