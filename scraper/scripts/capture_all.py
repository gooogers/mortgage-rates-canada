"""One-off: capture all Big 6 fixtures with per-site tuning.

This is a diagnostic / setup tool, not part of the production scraper. It exists
because each bank's site has different rendering behavior (some have persistent
analytics that block networkidle, some have slow third-party assets that block
load, etc.). For each bank, we:
  1. Navigate with `commit` (returns immediately when URL begins)
  2. Wait for a custom amount of time for JS to render rates
  3. Optionally wait for a CSS selector that confirms rates are present
  4. Save the rendered HTML

Usage:
    cd scraper
    uv run python scripts/capture_all.py            # capture everything missing
    uv run python scripts/capture_all.py rbc td     # capture only the named slugs
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright

# Pure Chrome User-Agent (no bot suffix) — some bank sites block obvious bots.
PURE_CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

# Per-lender capture config: url + post-navigation render wait (ms) + chromium args.
TARGETS: dict[str, dict] = {
    "rbc": {
        "url": "https://www.rbcroyalbank.com/mortgages/mortgage-rates.html",
        "render_wait_ms": 5_000,
        "browser_args": [],
    },
    "td": {
        "url": "https://www.td.com/ca/en/personal-banking/products/mortgages/mortgage-rates",
        "render_wait_ms": 8_000,
        "browser_args": [],
    },
    "scotia": {
        "url": "https://www.scotiabank.com/ca/en/personal/rates-prices/mortgage-rates",
        "render_wait_ms": 15_000,
        "browser_args": [],
    },
    "bmo": {
        "url": "https://www.bmo.com/main/personal/mortgages/mortgage-rates/",
        "render_wait_ms": 12_000,
        "browser_args": [],
    },
    "cibc": {
        # Force HTTP/1.1 — Playwright's bundled Chromium has known HTTP/2 issues
        # with some Akamai-fronted sites including cibc.com.
        "url": "https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html",
        "render_wait_ms": 12_000,
        "browser_args": ["--disable-http2"],
    },
    "national": {
        "url": "https://www.nbc.ca/personal/mortgages.html",
        "render_wait_ms": 8_000,
        "browser_args": [],
    },
}

NAV_TIMEOUT_MS = 90_000
FIXTURE_DIR = Path(__file__).parent.parent / "tests" / "fixtures"


def capture(slug: str, cfg: dict) -> tuple[bool, str]:
    out_path = FIXTURE_DIR / f"{slug}.html"
    print(f"[{slug}] -> {cfg['url']}", file=sys.stderr)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=cfg.get("browser_args", []),
        )
        try:
            context = browser.new_context(user_agent=PURE_CHROME_UA)
            page = context.new_page()
            try:
                page.goto(cfg["url"], timeout=NAV_TIMEOUT_MS, wait_until="commit")
            except Exception as exc:
                return False, f"goto failed: {exc}"
            # Give the page time to render rates after JS bootstraps.
            page.wait_for_timeout(cfg["render_wait_ms"])
            html = page.content()
            out_path.write_text(html, encoding="utf-8")
            return True, f"{len(html):,} bytes"
        finally:
            browser.close()


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    slugs = argv if argv else list(TARGETS.keys())
    failures: list[str] = []
    for slug in slugs:
        if slug not in TARGETS:
            print(f"[{slug}] unknown — skipping", file=sys.stderr)
            failures.append(slug)
            continue
        try:
            ok, msg = capture(slug, TARGETS[slug])
        except Exception as exc:
            ok, msg = False, f"exception: {exc}"
        status = "OK " if ok else "ERR"
        print(f"  {status} {slug}: {msg}", file=sys.stderr)
        if not ok:
            failures.append(slug)
    if failures:
        print(f"\nFailed: {failures}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
