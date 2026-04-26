# Mortgage Rates Scraper

Daily-run Python scraper that fetches Canadian Big 6 bank posted mortgage rates,
applies a discount formula, validates, and writes `rates.json`.

## Usage

```bash
cd scraper
uv sync
uv run python -m core.cli --dry-run   # prints proposed rates.json
uv run python -m core.cli             # writes data/rates.json
uv run pytest                          # runs tests
```

## Adding a new lender

1. Save a snapshot of the lender's rate page to `tests/fixtures/<slug>.html`.
2. Create `lenders/<slug>.py` implementing `LenderScraper`.
3. Add a parametrized test entry in `tests/test_lenders.py`.
4. The runner auto-discovers the new module.

## Manual-source lenders

Some bank sites are protected by WAFs that block headless scrapers. For those
lenders we use a manual capture workflow: an operator opens the page in a
visible browser, waits for it to render, and saves the HTML.

### Adding a manual fixture

```bash
cd scraper
uv run python scripts/manual_capture.py <slug> --url <RATE_PAGE_URL>
```

This launches a visible Chromium window. Wait for the rates to fully load
(solve any cookie banners or bot challenges), then return to the terminal and
press Enter. The HTML is saved to `data/manual/<slug>.html`.

Manual fixtures are gitignored; each operator maintains their own.

### How the runner uses manual fixtures

`ManualLenderScraper.fetch()` reads `data/manual/<slug>.html`. If the file is
missing, fetch() raises `ManualFixtureMissingError` and the runner skips that
lender for this run (preserving previous data via the runner's
retain-on-failure behaviour). The runner logs a warning if the manual fixture
is older than 7 days.
