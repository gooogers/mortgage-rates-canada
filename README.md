# Mortgage Rates Canada

Canadian mortgage rates comparison site — Astro frontend + Python scraper.

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
