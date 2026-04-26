"""One-off CLI: capture a rendered HTML fixture for a lender's rate page.

Usage:
    cd scraper
    uv run python scripts/capture_fixture.py URL OUTPUT_PATH [--wait-for SELECTOR]

Example:
    uv run python scripts/capture_fixture.py \\
        https://www.rbcroyalbank.com/mortgages/mortgage-rates.html \\
        tests/fixtures/rbc.html \\
        --wait-for "table"
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Make the scraper package importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from lenders._playwright import render_page


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("output_path", type=Path)
    parser.add_argument(
        "--wait-for",
        dest="wait_for",
        help="CSS selector to wait for after navigation (e.g. 'table').",
    )
    parser.add_argument(
        "--wait-until",
        dest="wait_until",
        default="domcontentloaded",
        choices=["load", "domcontentloaded", "networkidle", "commit"],
        help="Playwright goto() wait condition (default: domcontentloaded).",
    )
    parser.add_argument(
        "--timeout-ms",
        type=int,
        default=30_000,
        help="Navigation/wait timeout in milliseconds (default 30000).",
    )
    args = parser.parse_args(argv)

    print(f"Rendering {args.url} ...", file=sys.stderr)
    html = render_page(
        args.url,
        wait_for_selector=args.wait_for,
        wait_until=args.wait_until,
        timeout_ms=args.timeout_ms,
    )
    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    args.output_path.write_text(html, encoding="utf-8")
    print(f"Wrote {len(html)} bytes to {args.output_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
