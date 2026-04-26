# Private Staging Deployment — Design Spec (Plan 3)

**Date:** 2026-04-26
**Status:** Approved (pending user review of this written spec)
**Parent spec:** [2026-04-25-canadian-mortgage-rates-site-design.md](2026-04-25-canadian-mortgage-rates-site-design.md) — §11 Branch & Deploy Wiring is the source of truth for steady-state production wiring; this addendum captures the staging phase decisions and concrete coordinates.

---

## 1. Goal

Take the v1 site and scraper (already built and verified locally — see [Plan 1](../plans/2026-04-25-scraper-implementation.md), [Plan 2](../plans/2026-04-25-site-implementation.md)) and stand up the full deploy pipeline against a private staging URL. The pipeline matches the eventual production wiring exactly, but the resulting site lives at an unguessable `*.pages.dev` URL with `noindex` directives so search engines won't surface it before launch.

**Why staging-first:** the most failure-prone integration is the cron → data branch → Cloudflare deploy hook → rebuild round trip. We want to validate that loop end-to-end with the 3 working banks (RBC, TD, National Bank) before committing operator effort to the manual-fixture flow for Scotia/BMO/CIBC.

**v1 deploy success looks like:**
- Public GitHub repo at `gooogers/mortgage-rates-canada`
- Daily cron successfully scrapes and pushes `rates.json` to a `data` branch
- Cloudflare Pages rebuilds and serves the site at `mortgage-rates-canada.pages.dev`
- Search engines cannot index the URL (`noindex` is multi-layered)
- Scrape failures open or update a GitHub issue with the run log
- CI workflow runs scraper tests and Astro build on every PR
- Total ongoing cost: $0 (Cloudflare Pages, GitHub Actions, both free tiers)

---

## 2. Locked-in Decisions

| Item | Choice | Rationale |
|---|---|---|
| Staging strategy | `<random>.pages.dev` URL with multi-layer `noindex` | Free, exercises full prod pipeline, flips to public by removing one env var + adding DNS |
| Repo visibility | Public | No-auth raw URL for `fetch-rates.mjs`; unlimited free Actions minutes; data is public anyway |
| GitHub coords | `gooogers/mortgage-rates-canada` | User choice |
| Build host | Cloudflare Pages with its GitHub integration | Per parent spec §11 |
| Cron schedule | `0 10 * * *` (6am ET / 10:00 UTC daily) | Per parent spec §11 |
| Failure notification | Open or update a single GitHub issue with run log | Per parent spec §11; lowest-friction (no email/webhook setup) |
| Branch rename | `master` → `main` as Task 1 | Spec/plans assume `main`; current repo is on `master` |
| CF Pages project name | `mortgage-rates-canada` | Matches repo name |
| Cloudflare account | User creates manually before plan execution | One-time signup; not automatable |

---

## 3. Architecture & Data Flow

```
┌─────────────────────┐
│ GitHub repo (main)  │── push ──▶ CF Pages GitHub integration
│ gooogers/           │                       │
│ mortgage-rates-     │                       │ build main
│ canada (public)     │                       ▼
│                     │            site/scripts/fetch-rates.mjs
│ master → main       │            └── reads DATA_BRANCH_URL ──┐
│ rename in task 1    │                                        │
└─────────────────────┘                                        ▼
        ▲                          raw.githubusercontent.com/gooogers/
        │                          mortgage-rates-canada/data/rates.json
        │                                        │
        │ daily 10:00 UTC                        │
        │                                        │
┌───────┴──────────────┐                          │
│ .github/workflows/   │                          │
│ scrape.yml           │── push ──▶ data branch ──┘
│ (Actions cron)       │       (orphan; rates.json + history/)
│                      │
│ on success: POST to  │── deploy hook ──▶ CF Pages rebuild
│ CF deploy hook       │
│ on failure: open or  │
│ update issue         │
└──────────────────────┘
                                       ▼
                          mortgage-rates-canada.pages.dev
                          (noindex, no custom domain)
```

The architecture is identical to parent spec §11 in production behavior. The only difference is the absence of a custom domain and the presence of staging guards (`STAGING=true` env var driving `noindex` directives).

---

## 4. Components Introduced by This Plan

### 4.1 GitHub repo creation
- `gh repo create gooogers/mortgage-rates-canada --public --source=. --push`
- Existing local history (`master` branch with all of Plans 1 + 2) is pushed in a single shot.
- After push, rename default branch `master` → `main` via `gh api` or web UI; update local tracking.

### 4.2 `data` branch bootstrap
- Created as an orphan branch locally so it shares no history with `main`.
- Initial commit contains:
  - `rates.json` — a copy of `scraper/rates.json` from the most recent local run (placeholder until first cron success).
  - `history/.gitkeep` — empty placeholder so the directory exists.
  - `README.md` — one-paragraph explanation that this branch is auto-updated by the cron and should not be merged.
- Pushed to `origin/data` and then never touched manually again.

### 4.3 `.github/workflows/scrape.yml`
- Triggers: `schedule: cron('0 10 * * *')` and `workflow_dispatch` (manual run for smoke testing).
- Permissions: `contents: write` (for pushing to `data` branch via built-in `GITHUB_TOKEN`).
- Steps mirror parent spec §11 with one refinement — uses a separate worktree (`git worktree add`) for the data branch checkout to avoid mutating `main`'s working tree.
- Final step: POST to `CF_DEPLOY_HOOK_URL` (GitHub Actions secret).
- `if: failure()` step uses `actions/github-script` to upsert a single open issue titled "Scraper failure: <YYYY-MM-DD>" with a link to the failed run and the last 200 lines of scraper log.

### 4.4 `.github/workflows/ci.yml`
- Triggers: `pull_request` and `push` (any branch except `data`).
- Two parallel jobs:
  - **scraper** — Python 3.12 + uv + `uv run pytest`
  - **site** — Node 20 + `cd site && npm install && npm run build` (build implies `astro check` typecheck via existing config)
- Catches drift in either component before it lands on `main` and breaks cron.

### 4.5 `DATA_BRANCH_URL` configuration
- Set as a Cloudflare Pages dashboard environment variable (production scope), value `https://raw.githubusercontent.com/gooogers/mortgage-rates-canada/data/rates.json`.
- `fetch-rates.mjs` is a raw Node script invoked by `npm run prebuild`, so it inherits `DATA_BRANCH_URL` from the build shell (CF Pages exposes dashboard env vars to the build process).
- Local dev continues to fall back to `rates.sample.json` when the env var is absent (existing behavior in `fetch-rates.mjs`). No committed `.env` file — keeps a single source of truth for the URL (CF dashboard) and avoids the asymmetry of one env var in a file (`DATA_BRANCH_URL`) and one only in dashboard (`STAGING`).

### 4.6 Staging `noindex` (three layers)
- **Layer 1 (HTML):** `Base.astro` includes `<meta name="robots" content="noindex, nofollow">` when `import.meta.env.STAGING === "true"`.
- **Layer 2 (HTTP header):** `site/public/_headers` (Cloudflare Pages convention) with `/*\n  X-Robots-Tag: noindex, nofollow`.
- **Layer 3 (robots.txt):** `site/public/robots.txt` set to `User-agent: *\nDisallow: /` when staging; flipped to allow-all at launch.
- Belt-and-suspenders: each of the three is independently sufficient. Launch = flip `STAGING=false` in CF env vars + remove `Disallow: /` from `robots.txt`.

### 4.7 Issue-based failure notification
- Implemented as the final step of `scrape.yml` using `actions/github-script@v7`.
- Logic: search for an open issue labeled `cron-failure`. If one exists, append a comment with the run link and recent log. If none, create one. This avoids issue-spam if the cron is broken for multiple days.
- Auto-close on next successful run (a `if: success()` step at the end of the workflow that closes any open `cron-failure` issue with a "resolved by run X" comment).

### 4.8 Cloudflare Pages project setup (manual operator runbook)
- Documented as Task N in the implementation plan, not automated:
  1. Sign up at cloudflare.com (no payment method required for Pages free tier).
  2. Create new Pages project → "Connect to Git" → authorize Cloudflare GitHub App on `gooogers/mortgage-rates-canada` only.
  3. Build settings:
     - Production branch: `main`
     - Build command: `cd site && npm install && npm run build`
     - Build output: `site/dist`
     - Root directory: `/`
     - Environment variables (production): `STAGING=true`, `DATA_BRANCH_URL=https://raw.githubusercontent.com/gooogers/mortgage-rates-canada/data/rates.json`
  4. After first successful build, copy the `<random>.pages.dev` URL.
  5. Settings → Deploy hooks → create one named "scrape-cron"; copy URL.
  6. Store the deploy hook URL as the `CF_DEPLOY_HOOK_URL` GitHub Actions secret (`gh secret set CF_DEPLOY_HOOK_URL`).

---

## 5. Error Handling

| Failure | Detection | Behavior | Recovery |
|---|---|---|---|
| 1 lender of N fails | Existing runner logs and continues | `rates.json` updated with surviving lenders | Self-healing on next cron |
| All lenders fail | Runner exits non-zero | Workflow fails; data branch NOT updated; issue opened | Site continues serving last-good rates; operator investigates |
| Push to `data` fails | Git push exit code | Workflow fails; issue opened | Last-good rates served; next run retries |
| CF deploy hook returns 4xx/5xx | curl exit code in workflow step | Workflow fails; issue opened | data branch already updated, so any subsequent successful run rebuilds |
| `fetch-rates.mjs` fetch fails during CF build | Existing throw on non-200 | CF marks deploy failed; previous deploy stays live | No user-visible regression |
| `fetch-rates.mjs` gets corrupted JSON | Existing JSON parse + `lenders` array assertion | Same as above | No user-visible regression |
| `STAGING=true` accidentally left on after launch | Manual launch checklist | Site stays noindexed | Caught by checklist; flip env var |

The site's "last good rates" property holds because `rates.json` lives on a separate branch — a broken scrape never touches what CF Pages serves until a successful run rewrites that branch.

---

## 6. Testing & Verification

### Pre-merge (CI)
- `ci.yml` runs scraper pytest + Astro build on every PR.

### Pre-launch smoke (manual, part of plan execution)
1. Trigger `scrape.yml` via `gh workflow run scrape.yml`. Confirm:
   - Workflow completes green
   - `data` branch has a new commit `chore(rates): update YYYY-MM-DD`
   - `data:rates.json` has all 3 lenders × 8 terms = 24 rates
2. Confirm CF Pages auto-rebuilt (deploys list in CF dashboard) within ~2 min of deploy-hook POST.
3. `curl https://mortgage-rates-canada.pages.dev/` and grep for:
   - `<meta name="robots" content="noindex` in HTML
   - `X-Robots-Tag: noindex` in response headers (use `curl -I`)
   - `/robots.txt` returns `Disallow: /`
4. Manually break a selector on a branch, push, run workflow, confirm:
   - Workflow fails
   - Issue is opened with run link
   - Re-running cleanly closes the issue

### Launch checklist (separate document, not part of Plan 3 execution)
- Flip `STAGING=false` in CF env vars.
- Remove `Disallow: /` from `robots.txt`.
- Add custom domain in CF Pages → DNS at registrar.
- Submit sitemap to Google Search Console.

---

## 7. Out of Scope

- Custom domain registration / DNS configuration — separate launch task.
- Scotia / BMO / CIBC scrapers — deferred to v1.1 (manual-capture flow already exists; needs operator effort).
- Monolines / credit unions — v1.1+ / v1.2.
- Analytics (Plausible, CF Web Analytics) — separate task.
- Affiliate-link activation — already placeholdered in components; live activation is a content/business task, not deploy.
- Sitemap generation — defer until launch (no point indexing a noindexed site).

---

## 8. File Manifest

New files this plan creates:
```
.github/
└── workflows/
    ├── ci.yml
    └── scrape.yml

site/
├── src/
│   └── lib/
│       ├── staging.ts           # isStaging() helper (testable)
│       └── staging.test.ts
└── public/
    └── _headers                 # Cloudflare Pages convention; X-Robots-Tag: noindex
```

Files modified:
```
site/src/layouts/Base.astro      # adds STAGING-gated noindex meta
site/public/robots.txt           # change to Disallow: / for staging (currently Allow: /)
README.md                        # add deploy section pointing to this spec
```

Branches created:
```
data        # orphan; rates.json + history/
```

Branches renamed:
```
master → main
```
