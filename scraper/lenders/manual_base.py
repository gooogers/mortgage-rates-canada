"""Manual-source variant of LenderScraper.

Some bank sites are protected by WAFs (Akamai/Imperva/Cloudflare Bot
Management) that block headless browsers. For those lenders, fetch() reads
a manually-maintained HTML snapshot from disk (typically saved using the
admin CLI: `scripts/manual_capture.py`).

Subclasses only need to implement parse().
"""
from __future__ import annotations

from abc import ABC
from datetime import datetime
from pathlib import Path

from lenders.base import LenderScraper

# Default location for manually-saved page snapshots.
DEFAULT_MANUAL_DIR = Path(__file__).resolve().parent.parent / "data" / "manual"


class ManualFixtureMissingError(FileNotFoundError):
    """Raised by fetch() when no manual fixture exists for this lender yet."""


class ManualLenderScraper(LenderScraper, ABC):
    """Reads HTML from a manually-maintained file rather than the network."""

    def __init__(self, *, manual_dir: Path | None = None) -> None:
        self.manual_dir = manual_dir or DEFAULT_MANUAL_DIR

    @property
    def fixture_path(self) -> Path:
        return self.manual_dir / f"{self.slug}.html"

    def fetch(self) -> str:
        path = self.fixture_path
        if not path.exists():
            raise ManualFixtureMissingError(
                f"No manual fixture for '{self.slug}'. Run "
                f"`uv run python scripts/manual_capture.py {self.slug}` "
                f"to save one to {path}."
            )
        return path.read_text(encoding="utf-8")

    def fixture_age_days(self) -> float | None:
        """Return how many days since the fixture file was last modified, or None."""
        path = self.fixture_path
        if not path.exists():
            return None
        mtime = datetime.fromtimestamp(path.stat().st_mtime)
        delta = datetime.now() - mtime
        return delta.total_seconds() / 86_400
