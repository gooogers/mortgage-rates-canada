"""Abstract base for per-lender scrapers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone

from core.models import Lender, LenderType, Rate


class LenderScraper(ABC):
    """One subclass per lender. The runner discovers and calls these.

    Subclasses MUST set the class attributes (slug, name, type, source_url,
    affiliate_url) and implement fetch() and parse(). Provincial lenders
    must also set `provinces` so the site can filter them by region.
    """

    slug: str
    name: str
    type: LenderType
    source_url: str
    affiliate_url: str | None
    # ISO 3166-2 subdivision codes (e.g. ["ON"]). None = national lender.
    provinces: list[str] | None = None

    @abstractmethod
    def fetch(self) -> str:
        """HTTP GET the source page; return raw HTML."""

    @abstractmethod
    def parse(self, html: str) -> list[Rate]:
        """Parse HTML into a list of Rate objects (posted only)."""

    def to_lender(self, rates: list[Rate]) -> Lender:
        """Wrap parsed rates with this lender's metadata into a Lender model."""
        return Lender(
            slug=self.slug,
            name=self.name,
            type=self.type,
            source_url=self.source_url,
            affiliate_url=self.affiliate_url,
            scraped_at=datetime.now(timezone.utc).replace(microsecond=0),
            rates=rates,
            provinces=self.provinces,
        )
