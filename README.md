# data branch

This orphan branch is updated by `.github/workflows/scrape.yml`.
It contains:

- `rates.json` — the latest scraped rates, consumed by the site's `prebuild` step via `raw.githubusercontent.com`.
- `history/YYYY-MM-DD.json` — daily snapshots, one per successful scrape.

Do not merge this branch into `main`. Do not push to it manually.
