"""Admin CLI: open a lender's rate page in a visible Chromium and save HTML when ready.

Usage:
    cd scraper
    uv run python scripts/manual_capture.py <slug> --url <URL> [--wait-seconds N]

Workflow:
    1. Launches Chromium in headed mode (you can see the window)
    2. Navigates to the URL
    3. Prompts you to wait for the rates to fully load (and solve any
       bot/cookie challenges), then press Enter in the terminal
    4. Captures the rendered HTML and writes to data/manual/<slug>.html

Example:
    uv run python scripts/manual_capture.py scotia \\
        --url https://www.scotiabank.com/ca/en/personal/rates-prices/mortgage-rates
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright

from lenders.manual_base import DEFAULT_MANUAL_DIR


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug", help="Lender slug (e.g. 'scotia')")
    parser.add_argument("--url", required=True, help="The rate page URL")
    parser.add_argument(
        "--manual-dir",
        type=Path,
        default=DEFAULT_MANUAL_DIR,
        help=f"Output directory (default: {DEFAULT_MANUAL_DIR})",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=120_000,
        help="Navigation timeout in milliseconds (default 120000)",
    )
    args = parser.parse_args(argv)

    out_path = args.manual_dir / f"{args.slug}.html"
    args.manual_dir.mkdir(parents=True, exist_ok=True)

    print(f"Launching headed Chromium for {args.slug} ...", file=sys.stderr)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        try:
            context = browser.new_context()
            page = context.new_page()
            print(f"Navigating to {args.url} ...", file=sys.stderr)
            try:
                page.goto(args.url, timeout=args.timeout_ms, wait_until="commit")
            except Exception as exc:
                print(f"goto failed: {exc}", file=sys.stderr)
                return 1
            print(
                "\n-> Browser is open. Wait for the rates table to fully render.\n"
                "-> Solve any cookie banners or bot challenges in the window.\n"
                "-> When the rates are visible, return here and press Enter to capture.",
                file=sys.stderr,
            )
            try:
                input()
            except KeyboardInterrupt:
                print("\nAborted.", file=sys.stderr)
                return 130
            html = page.content()
            out_path.write_text(html, encoding="utf-8")
            print(f"Wrote {len(html):,} bytes to {out_path}", file=sys.stderr)
        finally:
            browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
