"""Orchestrate all lender scrapers into a single RatesData."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.discount import DiscountFormula
from core.models import Lender, RatesData
from core.validator import (
    RateValidationError,
    validate_against_previous,
    validate_rates_set,
)
from lenders.base import LenderScraper

log = logging.getLogger(__name__)


def build_rates_data(
    scrapers: list[LenderScraper],
    formula: DiscountFormula,
    *,
    previous: RatesData | None = None,
) -> RatesData:
    """Run every scraper, apply discount, validate, and assemble RatesData.

    On per-lender failure: log the error. If a previous run exists for that
    lender, keep its data; otherwise drop the lender from this run.
    """
    previous_by_slug: dict[str, Lender] = (
        {l.slug: l for l in previous.lenders} if previous else {}
    )
    out: list[Lender] = []
    for scraper in scrapers:
        try:
            lender = _run_one(scraper, formula, previous_by_slug.get(scraper.slug))
            out.append(lender)
        except Exception as exc:  # noqa: BLE001 — per-lender errors must not crash the run
            log.error("scraper %s failed: %s", scraper.slug, exc)
            fallback = previous_by_slug.get(scraper.slug)
            if fallback is not None:
                log.warning("retaining previous data for %s", scraper.slug)
                out.append(fallback)

    return RatesData(
        updated_at=datetime.now(timezone.utc).replace(microsecond=0),
        discount_formula=formula.to_dict(),
        lenders=out,
    )


def _run_one(
    scraper: LenderScraper,
    formula: DiscountFormula,
    previous: Lender | None,
) -> Lender:
    html = scraper.fetch()
    raw_rates = scraper.parse(html)
    validate_rates_set(raw_rates)

    if previous is not None:
        prev_by_term = {
            (r.term if isinstance(r.term, str) else r.term.value): r
            for r in previous.rates
        }
        for new in raw_rates:
            term_key = new.term if isinstance(new.term, str) else new.term.value
            try:
                validate_against_previous(new, prev_by_term.get(term_key))
            except RateValidationError as exc:
                # Treat per-rate jump failure as scraper failure for this lender
                raise RateValidationError(f"{scraper.slug}: {exc}") from exc

    return scraper.to_lender(raw_rates)
