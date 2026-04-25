# Canadian Mortgage Rates Site — Design Spec

**Date:** 2026-04-25
**Status:** Approved (pending user review of this written spec)
**Project:** A Canadian mortgage rate comparison website monetized via affiliate links and display ads, paired with an automated scraper that updates rates daily.

---

## 1. Goals & Success Criteria

Build a Canadian mortgage rates website with three product surfaces:

1. **Rate display** (primary) — a homepage that shows posted bank rates alongside an estimated discounted rate, helping visitors understand that posted rates are typically negotiable through a broker.
2. **Mortgage calculator** — a standard payment calculator covering down payment, payment frequency, CMHC insurance, and total interest.
3. **Informational articles** — out of scope for v1; reserved for a later phase.

**Monetization:** affiliate "Apply →" links per lender plus reserved display-ad slots (AdSense / Mediavine) baked into the layout from day one.

**v1 success looks like:**

- Homepage live with the Big 6 banks' posted and discounted rates updated daily.
- A working calculator that produces shareable scenarios via URL params.
- All required legal pages live (privacy, terms, disclosure, methodology).
- Total ongoing cost: $0 (only the domain registration is paid).

---

## 2. Scope & Phasing

The user requested coverage of Big 6 + monolines + credit unions, but that is 30+ scrapers and would push v1 by months. The site ships at full quality on day one; the scraper is built to make adding lenders trivial and is phased.

**v1 (this spec):**
- Full site (homepage, calculator, supporting pages, all dynamic per-term and per-lender pages)
- Scraper covering the **Big 6 banks only** (RBC, TD, Scotia, BMO, CIBC, National Bank)
- Daily GitHub Actions cron updating `data/rates.json`
- All legal disclaimers live

**v1.1 (future spec):** add 5–8 monoline lenders (MCAP, First National, Strive, RFA, CMLS, etc.).

**v1.2 (future spec):** credit unions (regional and fragmented — needs its own design pass) and historical rate charts.

The `LenderScraper` interface is designed so adding a lender = one new Python module + one HTML fixture, with no other code changes.

---

## 3. Architecture & Data Flow

Two decoupled components communicating through a single `rates.json` file held on a dedicated `data` branch.

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Python Scraper         │  cron   │  GitHub Actions          │
│  (lives in /scraper)    │◄────────┤  (daily 6am ET)          │
│                         │         └──────────────────────────┘
│  - One module per       │                     │
│    lender               │                     │ git push to data branch
│  - Common interface     │                     ▼
│  - Discount formula     │         ┌──────────────────────────┐
│  - Validation           │────────►│  data branch             │
└─────────────────────────┘         │  rates.json + history/   │
                                    └──────────────────────────┘
                                                 │
                                                 │ POST deploy hook
                                                 ▼
                                    ┌──────────────────────────┐
                                    │  Cloudflare Pages        │
                                    │  (Astro static rebuild   │
                                    │   off main branch;       │
                                    │   prebuild fetches       │
                                    │   rates.json from data)  │
                                    └──────────────────────────┘
                                                 │
                                                 ▼
                                    ┌──────────────────────────┐
                                    │  yourdomain.ca           │
                                    │  (static HTML, fast)     │
                                    └──────────────────────────┘
```

**Why this shape:**

- **Static site** → free hosting (Cloudflare Pages, no bandwidth cap), fast global CDN, strong SEO posture for finance content.
- **JSON in git** → free historical record (every rate change is a commit), no DB required for v1.2 history charts.
- **Separate `data` branch** → keeps `main` history free of automated commits.
- **GitHub Actions cron** → free, easy to debug (every run has a log), no infrastructure to maintain.
- **Total ongoing cost:** $0 + ~$15/year for the domain.

---

## 4. Site Pages

| Path | Purpose | Notes |
|---|---|---|
| `/` | Homepage — featured hero (best 5-yr fixed and best variable) plus full lender comparison table | The product. Layout C from brainstorming. |
| `/calculator` | Standalone mortgage payment calculator | SEO target: "mortgage payment calculator canada" |
| `/rates/[term]` | Per-term ranking page (e.g. `/rates/5-year-fixed`) | Auto-generated from `rates.json`. SEO long-tail. |
| `/lenders/[slug]` | Per-lender page (e.g. `/lenders/rbc`) | Auto-generated from `rates.json`. Per-lender affiliate placement. |
| `/about` | What this site is, who runs it, methodology summary | Trust signal (E-E-A-T) |
| `/methodology` | Full discount-formula transparency, source URLs, update cadence | Honesty + SEO + legal cover |
| `/disclosure` | Affiliate disclosure | Required under Canada's Competition Act |
| `/privacy` | Privacy policy | Required by AdSense, affiliate networks, and PIPEDA |
| `/terms` | Terms of use + "not financial advice" | Boilerplate financial disclaimer |

The per-term and per-lender pages are auto-generated from `rates.json` at build time — no manual page creation as lenders are added.

---

## 5. Calculator

**Inputs:**
- Home price ($)
- Down payment (% with 5/10/20% quick buttons, or $ amount)
- Mortgage rate (% — defaults to the current best **discounted** 5-yr fixed from `rates.json`, editable)
- Amortization (years — 25 default, dropdown 5–30)
- Payment frequency (monthly, bi-weekly, accelerated bi-weekly)

**Outputs:**
- Per-period payment (matches selected frequency)
- CMHC insurance premium (auto-calculated using current rates: 4.00% / 3.10% / 2.80% based on down payment %; only applies when down payment < 20%)
- Total mortgage amount (principal + CMHC if applicable)
- Total interest paid over amortization
- Total cost (principal + interest + CMHC)

**Implementation notes:**
- Pure client-side JavaScript; no backend.
- Bookmarkable / shareable via URL params: `?price=600000&down=10&rate=4.09&am=25&freq=biweekly`. Supports both initial-load population from URL and updating URL as inputs change.
- Math lives in `site/src/lib/calculator.ts` as pure functions, unit-tested.
- Embedded as a smaller widget on the homepage below the rate table; full version lives at `/calculator`.

---

## 6. Data Model

`data/rates.json` (lives on the `data` branch):

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
      "affiliate_url": "https://...",
      "source_url": "https://www.rbcroyalbank.com/mortgages/...",
      "scraped_at": "2026-04-25T10:00:00Z",
      "rates": [
        {"term": "1yr_fixed",  "posted": 6.84, "discounted": 5.34},
        {"term": "2yr_fixed",  "posted": 5.99, "discounted": 4.49},
        {"term": "3yr_fixed",  "posted": 5.84, "discounted": 4.34},
        {"term": "4yr_fixed",  "posted": 5.79, "discounted": 4.29},
        {"term": "5yr_fixed",  "posted": 5.69, "discounted": 4.19},
        {"term": "variable",   "posted": 6.20, "discounted": 5.20},
        {"term": "heloc",      "posted": 7.20, "discounted": null}
      ]
    }
  ]
}
```

**Notes:**

- `discounted` is computed by the scraper at write time (not at site build time), so the website is dumb and just renders.
- Discount values live in `scraper/config/discounts.yaml`; changing a number applies on the next scrape. A `null` formula entry (e.g. `heloc`) means "do not compute a discount" — the site renders only the posted rate for that term.
- A `history/YYYY-MM-DD.json` snapshot is also written on the `data` branch each day for explicit historical access (in addition to the implicit history in git log).

**Term enum:** `1yr_fixed`, `2yr_fixed`, `3yr_fixed`, `4yr_fixed`, `5yr_fixed`, `7yr_fixed`, `10yr_fixed`, `variable`, `heloc`. A lender may omit terms it does not offer; the site renders `—` for missing terms.

---

## 7. Scraper Design

```
scraper/
├── pyproject.toml          # uv-managed
├── config/
│   └── discounts.yaml      # Per-term discount values
├── lenders/
│   ├── base.py             # LenderScraper abstract base class
│   ├── rbc.py
│   ├── td.py
│   ├── scotia.py
│   ├── bmo.py
│   ├── cibc.py
│   └── national.py
├── core/
│   ├── runner.py           # Orchestrates scrapers, builds rates.json
│   ├── discount.py         # Applies discount formula
│   ├── validator.py        # Sanity checks
│   └── publisher.py        # Writes rates.json, commits to data branch, calls deploy hook
└── tests/
    ├── fixtures/           # Saved HTML snapshots per lender
    └── test_lenders.py     # Each scraper tested against its fixture
```

**`LenderScraper` interface** — every lender module implements:

```python
class LenderScraper(ABC):
    slug: str
    name: str
    type: Literal["big6", "monoline", "credit_union"]
    source_url: str
    affiliate_url: str | None  # may be None until program is approved

    def fetch(self) -> str: ...                   # HTTP GET via httpx, returns HTML
    def parse(self, html: str) -> list[Rate]: ... # BeautifulSoup, returns rates
```

The runner discovers all lender modules, runs `fetch()` then `parse()` for each, applies the discount formula, validates, and assembles the final `rates.json`.

**Reliability safeguards:**

- **Validator** — every scraped rate must be 0 ≤ rate ≤ 15 and within ±2% of the previous run's value for that term. Failed lenders are logged and skipped; the previous good rate is retained.
- **Per-lender `last_successful_scrape` timestamp** — site shows a "stale (last updated X days ago)" badge when > 7 days old.
- **HTML fixtures in tests** — when a lender's site changes structure, the test breaks before production breaks. CI runs scraper tests on every PR.
- **Failure notification** — on scraper failure, the workflow opens (or appends a comment to) a GitHub issue with the log.
- **No anti-bot evasion** — we use a polite user-agent, request once per day, and respect 429/403 by skipping. Sites that block us are dropped, not fought.

---

## 8. Legal & Compliance

The site displays Canadian financial information and earns affiliate commissions, both of which carry compliance obligations. All are cheap to address up front.

**Required content (built into footer + dedicated pages):**

- **"Not financial advice" disclaimer** — site footer on every page + full text on `/terms`. Keeps the site out of advisor-licensing territory.
- **Affiliate disclosure** — required under Canada's Competition Act (Competition Bureau 2023 deceptive marketing guidance). Plain language: "We earn a commission when you apply through some lender links." Lives on `/disclosure` and is noted near every affiliate CTA.
- **Rate accuracy disclaimer** — "Rates are estimates updated daily; actual rates require lender approval and may differ." Above the rate table and on `/methodology`.
- **Discount methodology transparency** — `/methodology` publicly explains the discount formula.
- **Privacy policy** — required by AdSense, most affiliate networks, and PIPEDA. v1 collects no personal data, but the policy still must exist.

**Explicitly NOT in v1** (would expand scope into regulated activity or add significant work):

- Brokerage referral form (regulated activity in most provinces)
- Pre-qualification tool (regulated mortgage agent territory)
- Direct lender API integrations (none of the Big 6 offer one)
- User accounts / saved scenarios (calculator URL params handle the share use case)

**Scraping legal posture:** publicly published commercial rate information, scraped at low frequency (daily) with a respectful user-agent. Aggregators have done this without issue for many years; risk is low but non-zero. Mitigation: comply immediately with any takedown letter.

---

## 9. Monetization Integration Points

Designed in from day one so they can be enabled without layout shift.

- **Affiliate CTAs:** each lender row gets an "Apply →" button using `affiliate_url` from `rates.json`. The hero "best rate" cards on the homepage get prominent "Get this rate" buttons. Affiliate URLs are configurable per-lender via the JSON.
- **Display ads:** AdSense / Mediavine slots reserved as empty placeholders in the layout — above-the-fold banner, in-content rectangle on calculator and lender pages, sidebar on lender pages. No layout shift when ads go live.
- **Email capture (v1.1):** not built in v1, but the homepage reserves a slot for "Notify me when rates drop."

---

## 10. Repository Structure

```
MortgageWebsite/
├── README.md
├── .gitignore                  # ignores .superpowers/, node_modules, .venv, site/src/data/rates.json
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-25-canadian-mortgage-rates-site-design.md
├── .github/
│   └── workflows/
│       ├── scrape.yml          # daily cron: runs scraper, pushes to data branch, hits CF deploy hook
│       └── ci.yml              # on PR: scraper tests + Astro typecheck/build
│
├── site/                       # Astro site
│   ├── astro.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   ├── public/
│   │   └── (favicon, robots.txt)
│   ├── scripts/
│   │   └── fetch-rates.mjs     # prebuild: fetches data/rates.json from data branch
│   └── src/
│       ├── data/
│       │   ├── rates.json      # gitignored; populated by fetch-rates.mjs at build
│       │   └── rates.sample.json # checked in; fallback for offline local dev
│       ├── lib/
│       │   ├── rates.ts        # typed loader for rates.json
│       │   ├── calculator.ts   # mortgage math (pure, unit-tested)
│       │   └── format.ts       # currency, %, date helpers
│       ├── components/
│       │   ├── RateTable.astro
│       │   ├── HeroFeaturedRates.astro
│       │   ├── Calculator.astro     # client-side island
│       │   ├── LenderRow.astro
│       │   ├── Disclaimer.astro
│       │   └── Footer.astro
│       ├── layouts/
│       │   └── Base.astro
│       ├── pages/
│       │   ├── index.astro                # Layout C homepage
│       │   ├── calculator.astro
│       │   ├── about.astro
│       │   ├── methodology.astro
│       │   ├── disclosure.astro
│       │   ├── privacy.astro
│       │   ├── terms.astro
│       │   ├── rates/[term].astro         # dynamic per-term pages
│       │   └── lenders/[slug].astro       # dynamic per-lender pages
│       └── styles/
│           └── global.css
│
└── scraper/                    # Python scraper
    ├── pyproject.toml          # uv-managed
    ├── README.md
    ├── config/
    │   └── discounts.yaml
    ├── lenders/
    │   ├── base.py
    │   ├── rbc.py
    │   ├── td.py
    │   ├── scotia.py
    │   ├── bmo.py
    │   ├── cibc.py
    │   └── national.py
    ├── core/
    │   ├── runner.py
    │   ├── discount.py
    │   ├── validator.py
    │   └── publisher.py
    └── tests/
        ├── fixtures/
        └── test_lenders.py
```

---

## 11. Branch & Deploy Wiring

- **`main` branch** — all human-authored code (site + scraper + spec). Cloudflare Pages production builds from this branch.
- **`data` branch** — orphan branch containing only `rates.json` and `history/YYYY-MM-DD.json`. Updated solely by the cron job. Never merged to main.
- **Build** — Cloudflare Pages builds `main`. The `prebuild` script in `site/package.json` runs `node scripts/fetch-rates.mjs`, which fetches `https://raw.githubusercontent.com/<owner>/<repo>/data/rates.json` into `site/src/data/rates.json` (gitignored). Astro then reads it like any local JSON.
- **Deploy trigger** — after the cron job pushes to `data`, the workflow POSTs to a Cloudflare Pages deploy hook URL (stored as a GitHub Actions secret) to kick off a `main` rebuild that pulls fresh data.

**Scraper cron workflow (`.github/workflows/scrape.yml`):**

```
schedule: cron('0 10 * * *')   # 6am ET daily (10 UTC)
steps:
  1. checkout main
  2. setup python (uv)
  3. install scraper deps
  4. run scraper → produces rates.json + summary log
  5. checkout data branch in worktree
  6. write rates.json + history/YYYY-MM-DD.json there
  7. commit ("chore(rates): update YYYY-MM-DD") + push to data
  8. POST to Cloudflare Pages deploy hook (secret)
  9. on failure: open or comment on a GitHub issue with the scraper log
```

**Local development:**

- `cd site && npm run dev` — runs Astro dev server. Calls `fetch-rates.mjs` first; falls back to `rates.sample.json` if offline.
- `cd scraper && uv run python -m core.runner --dry-run` — runs all scrapers, prints proposed `rates.json`, doesn't push or deploy.
- `cd scraper && uv run pytest` — runs scraper tests against fixtures (no network).

---

## 12. Decisions Captured (from brainstorming)

| Question | Decision |
|---|---|
| Rate coverage | Big 6 + monolines + credit unions overall; **Big 6 only in v1** with phased expansion |
| Discount source | **Fixed haircut formula** (configurable per term in `discounts.yaml`) |
| Calculator scope | **Standard** — payment, frequency, down payment %, CMHC, total interest |
| Articles | **Skip in v1** |
| Tech stack | **Astro (static) + Python scraper + JSON in git** |
| Scraper schedule & storage | **GitHub Actions daily cron, commits to `data` branch, triggers Cloudflare deploy hook** |
| Homepage layout | **Layout C** — featured hero ("best 5-yr fixed", "best variable") + full lender comparison table |
