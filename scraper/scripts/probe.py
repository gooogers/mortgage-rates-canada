"""Headed probe: render a URL via Playwright and save HTML to data/manual/<slug>.html.

Usage:
    cd scraper
    uv run python scripts/probe.py <slug> <url> [--wait-seconds N]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright

REAL_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug")
    parser.add_argument("url")
    parser.add_argument("--wait-seconds", type=int, default=8)
    args = parser.parse_args()

    out = Path(__file__).resolve().parent.parent / "data" / "manual" / f"{args.slug}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"Rendering {args.url} (headed) ...", file=sys.stderr)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            try:
                context = browser.new_context(user_agent=REAL_UA, viewport={"width": 1280, "height": 900})
                page = context.new_page()
                page.goto(args.url, timeout=60_000, wait_until="domcontentloaded")
                page.wait_for_timeout(args.wait_seconds * 1000)
                html = page.content()
            finally:
                browser.close()
    except Exception as exc:
        print(f"FAILED: {exc!r}", file=sys.stderr)
        return 1
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {len(html):,} bytes to {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
