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
