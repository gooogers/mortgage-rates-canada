# Private Staging Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the full deploy pipeline (GitHub repo → cron-driven scrape → `data` branch → Cloudflare Pages rebuild) against a private `*.pages.dev` URL with multi-layer `noindex` directives, so we can validate end-to-end before launch.

**Architecture:** Cloudflare Pages builds `main` on every push via its GitHub integration. A daily GitHub Actions cron runs the scraper, commits `rates.json` to an orphan `data` branch, and POSTs to a CF deploy hook to trigger a rebuild. The site's `prebuild` step fetches `rates.json` from `raw.githubusercontent.com` (no auth — repo is public). Staging-only `noindex` is enforced at three layers: HTML meta, HTTP header, and `robots.txt`.

**Tech Stack:** GitHub Actions (cron + CI), Cloudflare Pages (host), `gh` CLI (repo creation + label/secret management), existing scraper stack (Python 3.12 + `uv` + Playwright), existing site stack (Astro 4 + TypeScript + Vitest).

**Spec reference:** [docs/superpowers/specs/2026-04-26-private-staging-deployment-design.md](../specs/2026-04-26-private-staging-deployment-design.md)

**Prerequisites the operator must complete before starting:**
- `gh` CLI installed and authenticated as a user with write access to the `gooogers` GitHub org (`gh auth status`).
- A Cloudflare account exists at cloudflare.com (free tier; no payment method needed). Account email and password recorded.

---

## Task 1: Rename `master` → `main` locally

**Files:** none (branch metadata only)

- [ ] **Step 1: Verify clean working tree on `master`**

Run:
```bash
git status
git branch --show-current
```

Expected: `nothing to commit, working tree clean` and `master`. If dirty, stop and resolve before continuing.

- [ ] **Step 2: Rename the branch**

Run:
```bash
git branch -m master main
```

- [ ] **Step 3: Verify rename**

Run:
```bash
git branch --show-current
git log --oneline -3
```

Expected: branch is `main`; the three most recent commits are intact (the spec commits + plan-2 docs commit).

- [ ] **Step 4: No commit needed**

This is a metadata change with no working-tree diff. Move on.

---

## Task 2: Create the GitHub repo and push

**Files:** none committed in this task; existing history is pushed.

- [ ] **Step 1: Confirm `gh` auth**

Run:
```bash
gh auth status
```

Expected: shows logged-in user with `read:org`, `repo`, and `workflow` scopes. If the `workflow` scope is missing, run `gh auth refresh -s workflow` and retry.

- [ ] **Step 2: Create the repo and push current branch**

Run from repo root:
```bash
gh repo create gooogers/mortgage-rates-canada \
  --public \
  --description "Canadian mortgage rates comparison site (Astro + Python scraper)" \
  --source=. \
  --remote=origin \
  --push
```

Expected output ends with: `* [new branch]      main -> main`. The command both creates the GitHub repo and pushes the current `main` branch.

- [ ] **Step 3: Verify the remote**

Run:
```bash
git remote -v
gh repo view gooogers/mortgage-rates-canada --json url,visibility,defaultBranchRef
```

Expected: `origin` points to `https://github.com/gooogers/mortgage-rates-canada.git`; visibility is `PUBLIC`; default branch is `main`.

- [ ] **Step 4: Create the `cron-failure` label**

The scrape workflow opens an issue with this label on failure. Create it once now so the workflow doesn't need to:

```bash
gh label create cron-failure \
  --color B60205 \
  --description "Auto-opened by daily scrape failure" \
  -R gooogers/mortgage-rates-canada
```

Expected: `✓ Label "cron-failure" created`.

- [ ] **Step 5: Set branch protection on `main` (optional but recommended)**

```bash
gh api -X PUT repos/gooogers/mortgage-rates-canada/branches/main/protection \
  -f required_status_checks=null \
  -f enforce_admins=false \
  -f required_pull_request_reviews=null \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

Expected: 200 response with the protection config. This prevents accidental `git push --force` from clobbering history but does not require PRs (you can still push directly to `main` since you're solo).

---

## Task 3: Bootstrap the orphan `data` branch

**Files:**
- Create: `data` branch with `rates.json`, `history/.gitkeep`, `README.md`

Cloudflare Pages's first build (Task 8) needs a `rates.json` to fetch, so we bootstrap the branch with the sample fixture as a placeholder. The first cron run will overwrite it with live data.

This task uses a fresh sibling clone so the orphan branch is built in a clean directory — no risk of accidentally committing main's files and no cruft left in the main worktree.

- [ ] **Step 1: Confirm we are on `main` with a clean tree**

Run:
```bash
git branch --show-current
git status
```

Expected: `main`, working tree clean.

- [ ] **Step 2: Clone the just-pushed repo into a sibling directory**

Run from the repo root:
```bash
cd ..
gh repo clone gooogers/mortgage-rates-canada mortgage-data-bootstrap
cd mortgage-data-bootstrap
```

Expected: clone succeeds; you are in a fresh checkout of `main`.

- [ ] **Step 3: Create the orphan `data` branch**

Run:
```bash
git checkout --orphan data
git rm -rf .
```

Expected: `Switched to a new branch 'data'`, then a list of `rm '...'` lines. The working tree is now empty.

- [ ] **Step 4: Populate the `data` branch contents**

Run:
```bash
cp ../MortgageWebsite/site/src/data/rates.sample.json rates.json
mkdir history
touch history/.gitkeep
cat > README.md <<'EOF'
# data branch

This orphan branch is updated by `.github/workflows/scrape.yml`.
It contains:

- `rates.json` — the latest scraped rates, consumed by the site's `prebuild` step via `raw.githubusercontent.com`.
- `history/YYYY-MM-DD.json` — daily snapshots, one per successful scrape.

Do not merge this branch into `main`. Do not push to it manually.
EOF
```

- [ ] **Step 5: Stage and verify**

Run:
```bash
git add rates.json history/.gitkeep README.md
git status
```

Expected:
```
On branch data
No commits yet

Changes to be committed:
  new file:   README.md
  new file:   history/.gitkeep
  new file:   rates.json
```

If anything else is staged, stop and investigate — the orphan setup went wrong.

- [ ] **Step 6: Commit and push**

Run:
```bash
git commit -m "chore(data): bootstrap orphan data branch with sample rates"
git push -u origin data
```

Expected: a commit appears on the `data` branch with 3 files; push succeeds with `* [new branch]      data -> data`.

- [ ] **Step 7: Clean up the bootstrap clone**

Run:
```bash
cd ../MortgageWebsite
rm -rf ../mortgage-data-bootstrap
git status
```

Expected: working tree clean on `main` in the original repo.

- [ ] **Step 8: Verify `data` branch is reachable via raw URL**

Run:
```bash
curl -fsI https://raw.githubusercontent.com/gooogers/mortgage-rates-canada/data/rates.json | head -1
```

Expected: `HTTP/2 200`. (May take 30-60 seconds after push for raw.githubusercontent.com to propagate. Retry if it returns 404.)

---

## Task 4: Add CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

Write `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  scraper:
    name: Scraper tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: scraper
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - uses: astral-sh/setup-uv@v3

      - name: Install dependencies
        run: uv sync

      - name: Run pytest
        run: uv run pytest

  site:
    name: Site build + tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: site
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: site/package-lock.json

      - run: npm ci

      - run: npm run check

      - run: npm run build

      - run: npm run test
```

- [ ] **Step 2: Commit and push**

Run:
```bash
git add .github/workflows/ci.yml
git commit -m "ci: add scraper pytest + site build workflow"
git push origin main
```

- [ ] **Step 3: Watch the run**

Run:
```bash
gh run watch
```

Expected: both `scraper` and `site` jobs go green. If either fails, fix the cause before continuing — Task 5+ assumes CI works.

---

## Task 5: Add the `isStaging` helper (TDD)

**Files:**
- Create: `site/src/lib/staging.ts`
- Create: `site/src/lib/staging.test.ts`

The helper exists so we can unit-test the staging gate; without it the gate logic is only verifiable via the end-to-end smoke test.

- [ ] **Step 1: Write the failing test**

Create `site/src/lib/staging.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { isStaging } from "@lib/staging";

describe("isStaging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when STAGING is the string 'true'", () => {
    vi.stubEnv("STAGING", "true");
    expect(isStaging()).toBe(true);
  });

  it("returns false when STAGING is 'false'", () => {
    vi.stubEnv("STAGING", "false");
    expect(isStaging()).toBe(false);
  });

  it("returns false when STAGING is unset", () => {
    vi.stubEnv("STAGING", "");
    expect(isStaging()).toBe(false);
  });

  it("treats any non-'true' value as false", () => {
    vi.stubEnv("STAGING", "1");
    expect(isStaging()).toBe(false);
    vi.stubEnv("STAGING", "yes");
    expect(isStaging()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run:
```bash
cd site && npm run test -- staging
```

Expected: failure with `Cannot find module '@lib/staging'` or similar.

- [ ] **Step 3: Implement the helper**

Create `site/src/lib/staging.ts`:

```ts
export function isStaging(): boolean {
  return import.meta.env.STAGING === "true";
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run:
```bash
cd site && npm run test -- staging
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/staging.ts site/src/lib/staging.test.ts
git commit -m "feat(site): add isStaging() helper for staging-only behavior"
git push origin main
```

---

## Task 6: Wire `isStaging` into `Base.astro`

**Files:**
- Modify: `site/src/layouts/Base.astro`

- [ ] **Step 1: Add the import and the conditional meta tag**

Edit `site/src/layouts/Base.astro`. The current frontmatter is:

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
```

Change to:

```astro
---
import Footer from "@components/Footer.astro";
import { isStaging } from "@lib/staging";
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
const staging = isStaging();
---
```

Then in `<head>`, after the existing `{canonical && ...}` line and before `<link rel="icon" ...>`, add:

```astro
    {staging && <meta name="robots" content="noindex, nofollow" />}
```

- [ ] **Step 2: Build with STAGING=true and verify the meta tag is present**

Run from `site/`:
```bash
STAGING=true npm run build
grep -l 'noindex' dist/index.html
grep 'noindex' dist/index.html
```

Expected: the file path is printed and the line `<meta name="robots" content="noindex, nofollow">` appears in the output.

- [ ] **Step 3: Build without STAGING and verify the meta tag is absent**

Run:
```bash
npm run build
grep 'noindex' dist/index.html || echo "noindex not present (expected)"
```

Expected: the literal text `noindex not present (expected)`.

- [ ] **Step 4: Commit**

```bash
git add site/src/layouts/Base.astro
git commit -m "feat(site): gate noindex meta tag on STAGING env"
git push origin main
```

---

## Task 7: Add `_headers` and update `robots.txt` for staging

**Files:**
- Create: `site/public/_headers`
- Modify: `site/public/robots.txt`

These two layers are static — they ship as-is and the operator manually flips them at launch (one file edit each). They cover the case where someone disables JavaScript or where the meta tag is somehow stripped.

- [ ] **Step 1: Create `_headers`**

Create `site/public/_headers`:

```
/*
  X-Robots-Tag: noindex, nofollow
```

(Cloudflare Pages reads `public/_headers` and applies the rules to all routes — `/*` matches everything.)

- [ ] **Step 2: Replace `robots.txt`**

The current contents are:
```
User-agent: *
Allow: /
Sitemap: https://yourdomain.ca/sitemap.xml
```

Replace with:
```
User-agent: *
Disallow: /
```

(The Sitemap line referenced a placeholder domain and is restored at launch alongside the real sitemap.)

- [ ] **Step 3: Verify both files via local preview**

Run:
```bash
cd site && npm run build && npm run preview
```

Then in another shell:
```bash
curl -sI http://localhost:4321/ | grep -i x-robots-tag || echo "(header set by CF Pages, not local preview — verify in Task 10)"
curl -s http://localhost:4321/robots.txt
```

Expected: `robots.txt` returns `User-agent: *\nDisallow: /`. The `X-Robots-Tag` header will only appear once Cloudflare Pages serves the site (local preview doesn't read `_headers`).

Stop the preview with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add site/public/_headers site/public/robots.txt
git commit -m "feat(site): add staging noindex via _headers + robots.txt"
git push origin main
```

---

## Task 8: Cloudflare Pages setup (operator runbook)

**Files:** none in this repo — Cloudflare Pages dashboard work plus one GitHub Actions secret.

This is manual; document exactly what you did so the runbook stays accurate.

- [ ] **Step 1: Sign in to Cloudflare**

Go to https://dash.cloudflare.com and sign in with the account from the prerequisites.

- [ ] **Step 2: Create the Pages project**

Workers & Pages → Pages tab → "Create a project" → "Connect to Git" → "GitHub" → install the Cloudflare Pages GitHub App on the `gooogers` org → grant access to the `mortgage-rates-canada` repo only (do not grant org-wide access).

Pick `gooogers/mortgage-rates-canada` from the list.

- [ ] **Step 3: Configure the build**

| Field | Value |
|---|---|
| Project name | `mortgage-rates-canada` |
| Production branch | `main` |
| Framework preset | Astro |
| Build command | `cd site && npm install && npm run build` |
| Build output directory | `site/dist` |
| Root directory (advanced) | leave blank |

Click "Environment variables" → add **two** variables for the **Production** environment:

| Name | Value |
|---|---|
| `STAGING` | `true` |
| `DATA_BRANCH_URL` | `https://raw.githubusercontent.com/gooogers/mortgage-rates-canada/data/rates.json` |

Click "Save and Deploy".

- [ ] **Step 4: Wait for the first build**

The build runs ~2-3 minutes. Watch the log. Expected milestones:
- `[fetch-rates] fetching https://raw.githubusercontent.com/...` — the prebuild fetched real data.
- `[fetch-rates] wrote NNNN bytes to ...rates.json`
- `astro build` succeeds with `Complete!` line.
- Cloudflare reports the deploy URL: `https://<random>.mortgage-rates-canada.pages.dev`.

If the build fails at the fetch step, verify the `data` branch is reachable (Task 3 Step 8) and the env var is exact.

- [ ] **Step 5: Capture the production URL**

In the project's "Deployments" view, the production URL is shown at the top (e.g., `https://mortgage-rates-canada.pages.dev`). Note it down.

- [ ] **Step 6: Verify staging directives are live**

Run from any shell:
```bash
PROD_URL="https://mortgage-rates-canada.pages.dev"

curl -sI "$PROD_URL/" | grep -i x-robots-tag
curl -s "$PROD_URL/" | grep 'name="robots"'
curl -s "$PROD_URL/robots.txt"
```

Expected:
- Header: `x-robots-tag: noindex, nofollow`
- HTML: `<meta name="robots" content="noindex, nofollow">`
- robots.txt: `User-agent: *\nDisallow: /`

If any of the three is missing, do not proceed — fix before Task 9.

- [ ] **Step 7: Create a deploy hook**

In the project: Settings → Builds & deployments → Deploy hooks → "Add deploy hook":
- Hook name: `scrape-cron`
- Branch to build: `main`

Copy the generated URL (looks like `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/<uuid>`).

- [ ] **Step 8: Store the deploy hook as a GitHub Actions secret**

Run (from the repo root):
```bash
gh secret set CF_DEPLOY_HOOK_URL -R gooogers/mortgage-rates-canada
```

When prompted, paste the hook URL and press Enter.

Verify:
```bash
gh secret list -R gooogers/mortgage-rates-canada
```

Expected: a row for `CF_DEPLOY_HOOK_URL`.

- [ ] **Step 9: Smoke-test the deploy hook**

Paste the deploy hook URL from Step 7 directly into a curl POST (GitHub does not allow reading secret values back, so we use the value you have on hand):

```bash
curl -fsSL -X POST "<paste-deploy-hook-url-here>"
```

Expected: a JSON response with `"id"` and `"created_on"` fields, and a new build appears in the CF Pages dashboard within ~10 seconds.

---

## Task 9: Add the `scrape.yml` cron workflow

**Files:**
- Create: `.github/workflows/scrape.yml`

- [ ] **Step 1: Create the workflow file**

Write `.github/workflows/scrape.yml`:

```yaml
name: Daily scrape

on:
  schedule:
    - cron: "0 10 * * *"
  workflow_dispatch:

permissions:
  contents: write
  issues: write

jobs:
  scrape:
    name: Scrape and publish
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - uses: astral-sh/setup-uv@v3

      - name: Install scraper deps
        working-directory: scraper
        run: uv sync

      - name: Install Playwright browsers
        working-directory: scraper
        run: uv run playwright install --with-deps chromium

      - name: Run scraper
        working-directory: scraper
        run: |
          set -o pipefail
          uv run python -m core.cli --output ../data/rates.json --verbose 2>&1 | tee scrape.log

      - name: Configure git identity
        run: |
          git config user.name "scrape-bot"
          git config user.email "scrape-bot@users.noreply.github.com"

      - name: Check out data branch in worktree
        run: |
          git fetch origin data
          git worktree add -B data data-branch origin/data

      - name: Update data branch
        run: |
          DATE=$(date -u +%Y-%m-%d)
          cp data/rates.json data-branch/rates.json
          mkdir -p data-branch/history
          cp data/rates.json "data-branch/history/${DATE}.json"
          cd data-branch
          git add rates.json history/
          if git diff --cached --quiet; then
            echo "No rate changes; skipping commit and deploy."
            exit 0
          fi
          git commit -m "chore(rates): update ${DATE}"
          git push origin data

      - name: Trigger Cloudflare Pages rebuild
        run: |
          curl -fsSL -X POST "${{ secrets.CF_DEPLOY_HOOK_URL }}"

      - name: Close any open scraper-failure issues
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            const issues = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: "open",
              labels: "cron-failure",
            });
            const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
            for (const issue of issues.data) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: issue.number,
                body: `Resolved by run ${runUrl}.`,
              });
              await github.rest.issues.update({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: issue.number,
                state: "closed",
              });
            }

      - name: Open or update failure issue
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require("fs");
            let log = "(no scrape.log captured)";
            try {
              const all = fs.readFileSync("scraper/scrape.log", "utf8").split("\n");
              log = all.slice(-200).join("\n");
            } catch (e) {}
            const today = new Date().toISOString().slice(0, 10);
            const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
            const body = `Run: ${runUrl}\n\nLast 200 log lines:\n\`\`\`\n${log}\n\`\`\``;
            const existing = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: "open",
              labels: "cron-failure",
            });
            if (existing.data.length > 0) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: existing.data[0].number,
                body,
              });
            } else {
              await github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: `Scraper failure: ${today}`,
                labels: ["cron-failure"],
                body,
              });
            }
```

- [ ] **Step 2: Commit and push**

Run:
```bash
git add .github/workflows/scrape.yml
git commit -m "ci: add daily scrape cron workflow"
git push origin main
```

- [ ] **Step 3: Confirm the workflow registered**

Run:
```bash
gh workflow list -R gooogers/mortgage-rates-canada
```

Expected: a row for "Daily scrape" with state `active`.

---

## Task 10: Smoke-test the full pipeline

**Files:** none modified.

- [ ] **Step 1: Manually trigger the scrape workflow**

Run:
```bash
gh workflow run "Daily scrape" -R gooogers/mortgage-rates-canada
sleep 5
gh run watch -R gooogers/mortgage-rates-canada
```

Expected: workflow completes green in ~3-5 minutes (the Playwright browser install dominates runtime).

- [ ] **Step 2: Verify the `data` branch was updated**

Run:
```bash
git fetch origin data
git log origin/data --oneline -3
```

Expected: a new commit `chore(rates): update YYYY-MM-DD` from `scrape-bot`. The previous commit was the bootstrap from Task 3.

- [ ] **Step 3: Verify CF Pages rebuilt**

Open the CF Pages project's Deployments view. Expected: a new deploy started within ~10s of the workflow's "Trigger Cloudflare Pages rebuild" step and completed shortly after.

- [ ] **Step 4: Verify live site has fresh data**

Run:
```bash
PROD_URL="https://mortgage-rates-canada.pages.dev"
curl -s "$PROD_URL/" | grep -oE 'updated [^<]*' | head -1
```

Expected: an "updated <date>" string from today (or whenever the scrape ran).

- [ ] **Step 5: Re-verify all three noindex layers**

Run:
```bash
curl -sI "$PROD_URL/" | grep -i x-robots-tag
curl -s "$PROD_URL/" | grep 'name="robots"'
curl -s "$PROD_URL/robots.txt"
```

Expected (same as Task 8 Step 6):
- `x-robots-tag: noindex, nofollow`
- `<meta name="robots" content="noindex, nofollow">`
- `User-agent: *\nDisallow: /`

- [ ] **Step 6: (Optional) Force a failure to test the issue path**

This is optional — the issue logic is straightforward and reviewable, but if you want belt-and-suspenders verification:

```bash
git checkout -b test-failure
# break a CSS selector deliberately:
sed -i 's/data-rate-code/data-rate-code-BROKEN/' scraper/lenders/rbc.py
git commit -am "test: deliberately break RBC selector"
git push origin test-failure
gh workflow run "Daily scrape" -R gooogers/mortgage-rates-canada --ref test-failure
gh run watch -R gooogers/mortgage-rates-canada
```

Expected: workflow fails (RBC parse error). Then:
```bash
gh issue list -R gooogers/mortgage-rates-canada --label cron-failure
```
Expected: one open issue titled `Scraper failure: <today>` with the run link.

Now run the workflow again from `main` (which has the fix):
```bash
gh workflow run "Daily scrape" -R gooogers/mortgage-rates-canada --ref main
gh run watch -R gooogers/mortgage-rates-canada
gh issue list -R gooogers/mortgage-rates-canada --label cron-failure --state closed
```

Expected: workflow passes; the previously open issue is now closed with a "Resolved by run …" comment.

Clean up:
```bash
git checkout main
git push origin --delete test-failure
git branch -D test-failure
```

- [ ] **Step 7: Confirm the daily cron is scheduled**

Run:
```bash
gh workflow view "Daily scrape" -R gooogers/mortgage-rates-canada
```

Expected: shows `Schedule: 0 10 * * *` and the next run time.

---

## Task 11: Update the README with deploy info

**Files:**
- Modify: `README.md` (add a "Deployment" section)

- [ ] **Step 1: Add the section**

Append to the existing `README.md` (or create the section if it does not exist):

```markdown
## Deployment

This site deploys to Cloudflare Pages at https://mortgage-rates-canada.pages.dev (private staging — search engines are blocked via three layers of `noindex` directives).

**How it works:**

1. Pushes to `main` trigger a Cloudflare Pages build (via CF's GitHub integration). The build's `prebuild` step fetches the latest `rates.json` from the `data` branch.
2. A daily cron (`.github/workflows/scrape.yml`, 6am ET / 10:00 UTC) runs the scrapers, commits fresh rates to the `data` branch, and POSTs to a CF deploy hook to trigger a rebuild with the new data.
3. Scrape failures open a single GitHub issue labeled `cron-failure`. Successful runs auto-close the issue.

See [docs/superpowers/specs/2026-04-26-private-staging-deployment-design.md](docs/superpowers/specs/2026-04-26-private-staging-deployment-design.md) for the full design.

**Manual operations:**

- Force a deploy: `gh workflow run "Daily scrape" -R gooogers/mortgage-rates-canada`
- Watch CI: `gh run watch -R gooogers/mortgage-rates-canada`
- View open scrape failures: `gh issue list -R gooogers/mortgage-rates-canada --label cron-failure`

**Launching publicly (out of scope for this plan):**

1. In Cloudflare Pages dashboard, flip env var `STAGING` → `false`.
2. In `site/public/robots.txt`, change `Disallow: /` to `Allow: /` (and add `Sitemap:` line).
3. In Cloudflare Pages dashboard, attach a custom domain.
4. Submit sitemap to Google Search Console.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add deployment section to README"
git push origin main
```

- [ ] **Step 3: Update the spec status**

Edit the spec frontmatter at `docs/superpowers/specs/2026-04-26-private-staging-deployment-design.md`:

Change:
```
**Status:** Approved (pending user review of this written spec)
```

To:
```
**Status:** Implemented (YYYY-MM-DD)
```

(Replace YYYY-MM-DD with today's date.)

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-26-private-staging-deployment-design.md
git commit -m "docs(spec-3): mark as implemented"
git push origin main
```

---

## Self-Review Checklist (for the executing agent)

After completing all tasks, verify:

- [ ] `git remote -v` shows `origin` pointing to `github.com/gooogers/mortgage-rates-canada`
- [ ] Default branch is `main` (not `master`)
- [ ] `data` branch exists on remote and contains `rates.json` with at least 3 lenders
- [ ] CF Pages production URL serves the site with all three noindex layers active
- [ ] `gh workflow list` shows both `CI` and `Daily scrape` as `active`
- [ ] `gh secret list` shows `CF_DEPLOY_HOOK_URL`
- [ ] `gh label list` shows `cron-failure`
- [ ] One full successful end-to-end cron run is visible in Actions
- [ ] Site at `pages.dev` shows fresh rates from the latest cron run

If any line above is unchecked, the plan is not complete.
