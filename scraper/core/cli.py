"""Command-line entry point: `python -m core.cli [--dry-run] [--output PATH]`."""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from core.discount import load_discount_formula
from core.publisher import load_previous_rates, write_rates_json
from core.runner import build_rates_data
from lenders.base import LenderScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.td import TDScraper

log = logging.getLogger("scraper")

# Repo root is .../MortgageWebsite (worktree root). The scraper writes
# rates.json into <repo-root>/data/rates.json by default.
_SCRAPER_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _SCRAPER_DIR.parent
DEFAULT_OUTPUT = _REPO_ROOT / "data" / "rates.json"
DEFAULT_DISCOUNTS = _SCRAPER_DIR / "config" / "discounts.yaml"


def all_scrapers() -> list[LenderScraper]:
    """Return all configured lender scrapers, in display order."""
    return [
        RBCScraper(),
        TDScraper(),
        NationalScraper(),
        # Scotia/BMO/CIBC deferred to v1.1 — see scraper/README.md "Manual-source lenders"
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run all lender scrapers.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print proposed rates.json to stdout; do not write a file.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output path (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--discounts",
        type=Path,
        default=DEFAULT_DISCOUNTS,
        help=f"Discount formula YAML (default: {DEFAULT_DISCOUNTS}).",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose logging.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    formula = load_discount_formula(args.discounts)
    previous = load_previous_rates(args.output)
    data = build_rates_data(all_scrapers(), formula, previous=previous)

    json_output = json.dumps(data.model_dump(mode="json"), indent=2)
    if args.dry_run:
        print(json_output)
        return 0

    write_rates_json(data, args.output)
    log.info("wrote %d lenders to %s", len(data.lenders), args.output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
