# Content and Interactive Tools — Phase 1 Design

**Status:** Implemented (2026-04-28) — automated verification complete; user-review gates (Tasks 14, 15, 20, 21) and Lighthouse/mobile audits pending before launch
**Date:** 2026-04-28
**Domain:** canadianrates.ca

## Goal

Build the content and interactive-tool layer that lets `canadianrates.ca` launch publicly with enough topical depth and trust signals to compete in Canadian mortgage SEO. Phase 1 ships before the staging gate flips to public; Phases 2 and 3 ship post-launch as separate sub-specs.

## Background

The site currently has a daily-updated rate table, individual lender pages, individual term pages, and a working mortgage calculator — strong functional bones but zero editorial content. Term pages are just `<h1>` + table; lender pages are just `<h1>` + table. There are no guides, no comparison tools beyond the basic calculator, and no author/E-E-A-T signals.

Mortgage content is YMYL ("Your Money or Your Life") under Google's quality guidelines. Sites without expertise signals, depth, and internal topical clustering struggle to rank no matter how accurate their rate data is. Launching a thin site is worse than launching slightly later with credible content, because Google's first impression of a site is hard to recover from.

## Non-goals

- Building all 6 interactive tools at launch (4 of them are deferred to Phases 2 and 3)
- Adding a blog or news section
- Location pages (Ontario, BC, Alberta, etc.) — separate future spec
- Paid expert reviewer / licensed-broker fact-check program — deferred to Phase 3 if commercial momentum justifies
- Multilingual content (French) — out of scope
- Real-time rate hold or pre-approval flows — out of scope

## Phasing summary

| Phase | When | Content |
|---|---|---|
| **1** *(this spec)* | Pre-launch (~3 weeks) | Infra + term/lender prose + 2 guides+tools + author/trust layer |
| **2** | Post-launch weeks 1–4 (sub-spec) | Stress test guide+tool; renewal stay-vs-switch guide+tool |
| **3** | Post-launch weeks 4–8 (sub-spec) | Prepayment guide+tool; 25-vs-30 amortization guide+tool. Re-prioritized based on Search Console data. |

Phase 1 hero pair: **Fixed-vs-variable** and **Affordability**. Together they cover the two largest Canadian mortgage search intents (rate-shopping and pre-purchase).

## Architecture

### URL structure

New URLs:

- `/guides/` — index page listing all guides with summary cards
- `/guides/fixed-vs-variable` — combined article + break-even tool
- `/guides/affordability` — combined article + affordability calculator

Modified URLs:

- `/` — adds a "Learn" section above the calculator with 2 guide cards
- `/rates/[term]` — adds intro prose above the table, contextual FAQ below, related-guide block at the bottom
- `/lenders/[slug]` — adds template-driven intro above the table, lender facts table, related-guide block at the bottom
- `/methodology` — adds a "How we write our guides" section
- `/about` — gets an "Editorial team" section describing the byline used on guides

### Page templates

**Term page (`/rates/[term]`):**
1. H1 + last-updated date
2. Disclaimer (existing)
3. **NEW:** 200–400 word intro from the term-intros content collection
4. Existing rate table
5. **NEW:** 3–5 question contextual FAQ ("Why are 5-yr rates higher than 3-yr today?", etc.)
6. **NEW:** Related-guide block linking to one or two guides

**Lender page (`/lenders/[slug]`):**
1. H1 + source URL + last-updated date
2. Disclaimer (existing)
3. **NEW:** Template-rendered intro paragraph from `lenders.yaml` (founded, regulator, channels, prepayment policy, broker availability, notable quirks)
4. Existing rate table
5. **NEW:** Lender facts data table from YAML
6. **NEW:** Related-guide block

**Guide page (`/guides/[slug]`):**
1. H1 + meta title + meta description
2. Author byline component: "By Mortgage Rates Canada editorial team · Last reviewed YYYY-MM-DD"
3. Inline affiliate disclosure
4. MDX prose (~1500–2500 words) with embedded tool component at the natural insertion point (`<BreakEvenTool/>` or `<AffordabilityTool/>`)
5. Related-guide block at the bottom

### Tool framework

Every tool is built on a shared `ToolFrame.astro` component to keep UI, accessibility, and behavior consistent across the 6 eventual tools. Anatomy:

1. **Inputs panel** — 3–6 form fields, same styling conventions as the existing Calculator component
2. **Result panel** — headline insight as a sentence with bolded key numbers (e.g. "Variable wins unless prime rises **0.85%** within **14 months**")
3. **Detail toggle** — optional `<details>`-style expand revealing the supporting numbers and intermediate calculations
4. **URL state sync** — input values encoded in query params, mirroring the pattern in `Calculator.astro`, so users can deep-link or share scenarios
5. **"Use today's rates" button** — pre-fills inputs from `rates.json` for the relevant term. This is what makes the tools feel fresh and live-data-backed, and the bridge that ties guide content to the rate table

Math layer is pure TypeScript, fully unit-tested before any UI work touches it:

- `site/src/lib/calculator.ts` — already exists; reused for affordability and (eventually) amortization tools
- `site/src/lib/breakEven.ts` — new; pure functions for fixed-vs-variable break-even math
- `site/src/lib/affordability.ts` — new; pure functions for GDS/TDS-based max-mortgage calculation

Each math module has a sibling `*.test.ts` with unit tests covering happy paths and edge cases (0% rate, 5% down, max amortization, GDS/TDS at limit values).

### Content storage

- **Guides:** `site/src/content/guides/*.mdx` — Astro content collection, type-safe frontmatter (title, description, slug, last_reviewed_at, tool_id, related_guides). MDX so we can embed tool components inline at the right point in the prose.
- **Term intros:** `site/src/content/term-intros/*.md` — one file per term, frontmatter has `term` and `last_reviewed_at`.
- **Lender facts:** `site/src/data/lenders.yaml` — structured data. The page template reads this and renders templated prose. Avoids writing 30 unique lender essays.
- **Editorial config:** `site/src/data/editorial.ts` — exports the editorial team display name, the methodology summary text used on guides, and the standard affiliate disclosure snippet.

### Internal linking strategy

The point of phase 1's linking pattern is to tell Google that the rate tables, lender pages, and guides are one connected topical cluster — the cluster as a whole earns ranking, not individual pages competing.

- Each guide links to 1–3 relevant term pages and to 1–2 sibling guides
- Each term page links to 1–2 relevant guides ("Should I pick this term? See our [fixed vs variable guide]")
- Each lender page links to the affordability guide
- Home page "Learn" section links to all live guides
- Header navigation gains "Guides" link

### Trust layer (E-E-A-T)

Phase 1 ships the editorial-team framing (option B from brainstorming):

- **Byline component (`AuthorByline.astro`):** renders "By Mortgage Rates Canada editorial team · Last reviewed YYYY-MM-DD"
- **Methodology page additions:** explicit description of how guides are researched, drafted, edited, and reviewed; how the math behind tools is verified; how often content is reviewed (quarterly target)
- **About page additions:** "Editorial team" section explaining who contributes (without personal info), what their relationship to the content is, and the review process
- **Affiliate disclosure:** inline snippet at the top of every guide linking to `/disclosure`
- **Last-reviewed signal:** every guide and term-intro has `last_reviewed_at` in frontmatter; the byline renders this. Quarterly review cadence is documented but enforcement is out of scope (calendar reminder, not code).

Phase 3 may upgrade this to option C (paid licensed-broker reviewer) if commercial momentum justifies the cost.

### Domain housekeeping

Replace `yourdomain.ca` with `canadianrates.ca` in:

- `site/astro.config.mjs` — the `site` config used for sitemap, canonical URLs, and any future RSS
- All 9 page files using `canonical={"https://yourdomain.ca/..."}`

This must land before Phase 1 ships, since canonical URLs go in HTML and would actively harm rankings if the domain is wrong on launch.

## Authoring workflow

Hybrid: Claude drafts structure and prose; user fact-checks and rewrites for voice.

**Per guide:**
1. Claude generates a structured outline (H2/H3 skeleton, target keywords, FAQ candidates)
2. User reviews/revises outline
3. Claude drafts ~1500–2500 word prose against the approved outline
4. User rewrites in their voice, adds specifics/anecdotes/regional context, fact-checks numbers
5. Claude runs a final SEO hygiene pass (heading structure, internal links, meta description, JSON-LD schema markup)
6. Commit and merge

**Per term-page intro (8 pages):**
1. Claude drafts a 200–400 word intro from a shared template (term overview, who picks it, how to read the table)
2. User reviews and edits, fact-checks numbers
3. Each intro is one file in `site/src/content/term-intros/[term].md`

**Per lender page (~8–15 lenders):**
1. Claude generates structured `lenders.yaml` entries with founded, regulator, channels, prepayment policy, broker availability, notable quirks
2. User verifies the facts in a single sit-down (~30–60 min for all lenders)
3. Lender page renders prose deterministically from the YAML — no per-lender hand-writing

## Components and modules to build

### New components

- `site/src/components/ToolFrame.astro` — shared input/result/detail UI scaffold
- `site/src/components/AuthorByline.astro` — renders editorial-team byline with last-reviewed date
- `site/src/components/GuideCard.astro` — used on `/guides/` index, home Learn section, related-guide blocks
- `site/src/components/RelatedGuides.astro` — renders the related-guide block at the bottom of pages
- `site/src/components/LenderFacts.astro` — renders the lender facts table from YAML data
- `site/src/components/TermIntro.astro` — wraps the term-intro content collection rendering
- `site/src/components/TermFaq.astro` — renders the contextual FAQ on term pages
- `site/src/components/AffiliateDisclosure.astro` — inline disclosure snippet
- `site/src/components/tools/BreakEvenTool.astro` — Phase 1 tool 1
- `site/src/components/tools/AffordabilityTool.astro` — Phase 1 tool 2

### New library modules

- `site/src/lib/breakEven.ts` + `breakEven.test.ts` — break-even math
- `site/src/lib/affordability.ts` + `affordability.test.ts` — GDS/TDS max-mortgage math
- `site/src/lib/guides.ts` — content collection helpers (load all guides, get-by-slug, get-related)
- `site/src/lib/lenderFacts.ts` — load and validate lenders.yaml

### New content / data files

- `site/src/content/config.ts` — Astro content collection schemas for `guides` and `term-intros`
- `site/src/content/guides/fixed-vs-variable.mdx`
- `site/src/content/guides/affordability.mdx`
- `site/src/content/term-intros/1yr-fixed.md` through `10yr-fixed.md`
- `site/src/content/term-intros/variable.md`
- `site/src/data/lenders.yaml`
- `site/src/data/editorial.ts`

### Modified pages

- `site/src/pages/index.astro` — add "Learn" section
- `site/src/pages/rates/[term].astro` — add intro, FAQ, related-guide block
- `site/src/pages/lenders/[slug].astro` — add intro, facts table, related-guide block
- `site/src/pages/methodology.astro` — add "How we write our guides" section
- `site/src/pages/about.astro` — add "Editorial team" section
- `site/src/layouts/Base.astro` — add "Guides" to header nav
- `site/astro.config.mjs` — replace `yourdomain.ca` with `canadianrates.ca`
- All 9 page files with hardcoded canonical URLs — replace domain

### New pages

- `site/src/pages/guides/index.astro`
- `site/src/pages/guides/[slug].astro`

## Acceptance criteria

Phase 1 is complete (and the staging gate can flip to public) when:

1. All Phase 1 pages pass Lighthouse SEO audit ≥ 95
2. All math modules have unit tests with ≥ 90% line coverage; tests run green in CI
3. Both tools function correctly with edge-case inputs: 0% rate, 5% down, max amortization, GDS/TDS at limit values
4. Both tools have a working "Use today's rates" button that pulls from `rates.json`
5. Internal links resolve in both directions (guides ↔ term pages ↔ home); broken-link CI check passes
6. CI passes the full site build with `STAGING=true`; type-check, build, and tests all green
7. Domain `canadianrates.ca` is baked into all canonical URLs and the Astro config; no `yourdomain.ca` remains in the repo (verified by `grep -r yourdomain site/`)
8. User has personally read and approved the prose on every page going public (8 term intros, all lender intros, 2 full guides, modified about/methodology sections)
9. Both tools render correctly on mobile (verified at 375px viewport)
10. JSON-LD schema markup present on guides (Article schema with author/datePublished/dateModified)

## Risks and mitigations

- **Risk:** Lender facts in YAML go stale (e.g. a lender changes prepayment policy). **Mitigation:** add `last_verified_at` to each YAML entry; render a small "verified YYYY-MM" note on the lender page; treat YAML as content under the same quarterly review cadence.
- **Risk:** Generated guide prose feels generic. **Mitigation:** the hybrid workflow specifically requires user rewrite for voice + specifics; user is the gate, not Claude.
- **Risk:** Tool math errors. **Mitigation:** TDD on math modules; tools shipping behind unit tests with edge-case coverage; cross-check affordability tool output against published bank affordability calculators on a few scenarios before shipping.
- **Risk:** YMYL ranking weakness without a real expert byline. **Mitigation:** ship Phase 1 with editorial-team framing; revisit Phase 3 expert-reviewer model if Search Console data shows the ceiling.

## Out of scope (explicit)

- Phase 2 and Phase 3 guide content (separate sub-specs)
- Author bio pages with personal info
- Paid licensed-broker reviewer relationships
- Location pages
- Localization / French content
- A/B testing infrastructure for guide variations
- Real-time bond yield / prime rate widgets
- User accounts, saved scenarios, or any backend-state features
