# Scraper Implementation Plan (v1, Big 6 Banks)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python scraper that fetches posted mortgage rates from the Big 6 Canadian banks (RBC, TD, Scotia, BMO, CIBC, National Bank), applies a configurable discount formula to estimate broker-channel rates, validates the results, and writes them to a single `rates.json` file matching the schema in the spec.

**Architecture:** One Python module per lender implementing a `LenderScraper` ABC with `fetch()` and `parse()` methods. A runner orchestrates all lenders, applies discounts, validates, and assembles the final JSON. A separate publisher handles writing the file to disk and (in deploy plan) pushing to the `data` branch and triggering Cloudflare. Heavy use of HTML fixture files so scraper logic is fully testable without network. TDD throughout for pure logic; fixture-based tests for parsers.

**Tech Stack:** Python 3.12, `uv` for dependency management, `httpx` for HTTP, `beautifulsoup4` + `lxml` for parsing, `pytest` for tests, `PyYAML` for config, `pydantic` for typed models.

**Spec reference:** [docs/superpowers/specs/2026-04-25-canadian-mortgage-rates-site-design.md](../specs/2026-04-25-canadian-mortgage-rates-site-design.md) — Sections 6 (data model), 7 (scraper design), 12 (decisions).

**File structure produced by this plan:**

```
scraper/
├── pyproject.toml
├── README.md
├── config/
│   └── discounts.yaml
├── lenders/
│   ├── __init__.py
│   ├── base.py             # Rate, Term, LenderScraper ABC
│   ├── rbc.py
│   ├── td.py
│   ├── scotia.py
│   ├── bmo.py
│   ├── cibc.py
│   └── national.py
├── core/
│   ├── __init__.py
│   ├── models.py           # Lender, RatesData pydantic models
│   ├── discount.py         # apply_discount()
│   ├── validator.py        # validate_rate(), validate_run()
│   ├── runner.py           # build_rates_data()
│   ├── publisher.py        # write_rates_json()
│   └── cli.py              # argparse entry point with --dry-run
└── tests/
    ├── conftest.py
    ├── fixtures/
    │   ├── rbc.html
    │   ├── td.html
    │   ├── scotia.html
    │   ├── bmo.html
    │   ├── cibc.html
    │   └── national.html
    ├── test_base.py
    ├── test_discount.py
    ├── test_validator.py
    ├── test_runner.py
    ├── test_publisher.py
    └── test_lenders.py     # parametrized over all 6 lenders
```

---

## Task 1: Initialize scraper project

**Files:**
- Create: `scraper/pyproject.toml`
- Create: `scraper/README.md`
- Create: `scraper/lenders/__init__.py` (empty)
- Create: `scraper/core/__init__.py` (empty)
- Create: `scraper/tests/conftest.py`
- Create: `scraper/tests/fixtures/.gitkeep` (empty)

- [ ] **Step 1: Create `scraper/pyproject.toml`**

```toml
[project]
name = "mortgage-rates-scraper"
version = "0.1.0"
description = "Scrapes Canadian mortgage posted rates and emits rates.json"
requires-python = ">=3.12"
dependencies = [
    "httpx>=0.27",
    "beautifulsoup4>=4.12",
    "lxml>=5.0",
    "pydantic>=2.6",
    "PyYAML>=6.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]

[tool.uv]
package = false
```

- [ ] **Step 2: Create `scraper/README.md`**

```markdown
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
```

- [ ] **Step 3: Create empty package init files**

Create `scraper/lenders/__init__.py` (empty file).
Create `scraper/core/__init__.py` (empty file).

- [ ] **Step 4: Create `scraper/tests/conftest.py`**

```python
"""Test configuration."""
import sys
from pathlib import Path

# Make scraper package importable as if scraper/ were the root
sys.path.insert(0, str(Path(__file__).parent.parent))
```

- [ ] **Step 5: Create fixture directory placeholder**

```bash
touch scraper/tests/fixtures/.gitkeep
```

- [ ] **Step 6: Install dependencies**

Run: `cd scraper && uv sync`
Expected: creates `.venv/` and `uv.lock`, installs all deps without error.

- [ ] **Step 7: Verify pytest works (no tests yet)**

Run: `cd scraper && uv run pytest`
Expected: `no tests ran` (exit code 5 is OK at this stage).

- [ ] **Step 8: Commit**

```bash
git add scraper/
git commit -m "chore(scraper): initialize Python project with uv"
```

---

## Task 2: Define core models (Term, Rate, Lender, RatesData)

**Files:**
- Create: `scraper/core/models.py`
- Create: `scraper/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

Create `scraper/tests/test_models.py`:

```python
"""Tests for core data models."""
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from core.models import Lender, LenderType, RatesData, Rate, Term


def test_term_enum_values():
    assert Term.FIVE_YEAR_FIXED.value == "5yr_fixed"
    assert Term.VARIABLE.value == "variable"
    assert Term.HELOC.value == "heloc"


def test_rate_accepts_valid_values():
    rate = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69, discounted=4.19)
    assert rate.posted == 5.69
    assert rate.discounted == 4.19


def test_rate_allows_null_discounted():
    rate = Rate(term=Term.HELOC, posted=7.20, discounted=None)
    assert rate.discounted is None


def test_rate_rejects_negative_posted():
    with pytest.raises(ValidationError):
        Rate(term=Term.FIVE_YEAR_FIXED, posted=-1.0, discounted=None)


def test_lender_minimal():
    lender = Lender(
        slug="rbc",
        name="RBC Royal Bank",
        type=LenderType.BIG6,
        source_url="https://example.com",
        affiliate_url=None,
        scraped_at=datetime(2026, 4, 25, tzinfo=timezone.utc),
        rates=[Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69, discounted=4.19)],
    )
    assert lender.slug == "rbc"
    assert len(lender.rates) == 1


def test_rates_data_serializes_to_spec_shape():
    data = RatesData(
        updated_at=datetime(2026, 4, 25, 10, 0, tzinfo=timezone.utc),
        discount_formula={"fixed": 1.50, "variable": 1.00, "heloc": None},
        lenders=[],
    )
    json_dict = data.model_dump(mode="json")
    assert json_dict["updated_at"] == "2026-04-25T10:00:00Z"
    assert json_dict["discount_formula"]["heloc"] is None
    assert json_dict["lenders"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scraper && uv run pytest tests/test_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.models'`.

- [ ] **Step 3: Implement `scraper/core/models.py`**

```python
"""Pydantic models for the rates data shape (matches spec Section 6)."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class Term(str, Enum):
    ONE_YEAR_FIXED = "1yr_fixed"
    TWO_YEAR_FIXED = "2yr_fixed"
    THREE_YEAR_FIXED = "3yr_fixed"
    FOUR_YEAR_FIXED = "4yr_fixed"
    FIVE_YEAR_FIXED = "5yr_fixed"
    SEVEN_YEAR_FIXED = "7yr_fixed"
    TEN_YEAR_FIXED = "10yr_fixed"
    VARIABLE = "variable"
    HELOC = "heloc"


class LenderType(str, Enum):
    BIG6 = "big6"
    MONOLINE = "monoline"
    CREDIT_UNION = "credit_union"


# Posted rates are non-negative and reasonably bounded; validator enforces
# tighter sanity limits at run time.
NonNegRate = Annotated[float, Field(ge=0.0, le=25.0)]


class Rate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    term: Term
    posted: NonNegRate
    discounted: NonNegRate | None = None


class Lender(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str
    type: LenderType
    source_url: str
    affiliate_url: str | None = None
    scraped_at: datetime
    rates: list[Rate]

    @field_serializer("scraped_at")
    def _serialize_scraped_at(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class RatesData(BaseModel):
    updated_at: datetime
    discount_formula: dict[str, float | None]
    lenders: list[Lender]

    @field_serializer("updated_at")
    def _serialize_updated_at(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_models.py -v`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/core/models.py scraper/tests/test_models.py
git commit -m "feat(scraper): add Term, Rate, Lender, RatesData models"
```

---

## Task 3: Define LenderScraper base class

**Files:**
- Create: `scraper/lenders/base.py`
- Create: `scraper/tests/test_base.py`

- [ ] **Step 1: Write the failing test**

Create `scraper/tests/test_base.py`:

```python
"""Tests for LenderScraper abstract base class."""
import pytest

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper


class FakeLender(LenderScraper):
    slug = "fake"
    name = "Fake Bank"
    type = LenderType.BIG6
    source_url = "https://example.com/rates"
    affiliate_url = None

    def fetch(self) -> str:
        return "<html><body>5.69%</body></html>"

    def parse(self, html: str) -> list[Rate]:
        return [Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)]


def test_subclass_must_implement_fetch_and_parse():
    """Cannot instantiate without fetch and parse."""
    with pytest.raises(TypeError):

        class Incomplete(LenderScraper):
            slug = "x"
            name = "X"
            type = LenderType.BIG6
            source_url = "https://example.com"
            affiliate_url = None

        Incomplete()


def test_concrete_subclass_works():
    lender = FakeLender()
    html = lender.fetch()
    rates = lender.parse(html)
    assert len(rates) == 1
    assert rates[0].posted == 5.69


def test_to_lender_assembles_lender_object():
    """to_lender(rates) wraps parsed rates in a Lender model with metadata."""
    fake = FakeLender()
    rates = [Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)]
    lender = fake.to_lender(rates)
    assert lender.slug == "fake"
    assert lender.name == "Fake Bank"
    assert lender.type == LenderType.BIG6.value
    assert lender.source_url == "https://example.com/rates"
    assert lender.affiliate_url is None
    assert lender.rates == rates
    # scraped_at is set to "now"; just check it's populated
    assert lender.scraped_at is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scraper && uv run pytest tests/test_base.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'lenders.base'`.

- [ ] **Step 3: Implement `scraper/lenders/base.py`**

```python
"""Abstract base for per-lender scrapers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone

from core.models import Lender, LenderType, Rate


class LenderScraper(ABC):
    """One subclass per lender. The runner discovers and calls these.

    Subclasses MUST set the class attributes (slug, name, type, source_url,
    affiliate_url) and implement fetch() and parse().
    """

    slug: str
    name: str
    type: LenderType
    source_url: str
    affiliate_url: str | None

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
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_base.py -v`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/lenders/base.py scraper/tests/test_base.py
git commit -m "feat(scraper): add LenderScraper abstract base class"
```

---

## Task 4: Implement discount formula

**Files:**
- Create: `scraper/config/discounts.yaml`
- Create: `scraper/core/discount.py`
- Create: `scraper/tests/test_discount.py`

- [ ] **Step 1: Create `scraper/config/discounts.yaml`**

```yaml
# Estimated broker-channel discount applied to posted rates, in percentage points.
# A null value means "do not compute a discount" (site shows posted only).
# These are domain-knowledge defaults; tune per market conditions.
fixed: 1.50
variable: 1.00
heloc: null
```

- [ ] **Step 2: Write the failing test**

Create `scraper/tests/test_discount.py`:

```python
"""Tests for discount formula application."""
from pathlib import Path

import pytest

from core.discount import DiscountFormula, apply_discount, load_discount_formula
from core.models import Rate, Term


def test_load_discount_formula_from_yaml(tmp_path: Path):
    yaml_path = tmp_path / "discounts.yaml"
    yaml_path.write_text("fixed: 1.50\nvariable: 1.00\nheloc: null\n")
    formula = load_discount_formula(yaml_path)
    assert formula.fixed == 1.50
    assert formula.variable == 1.00
    assert formula.heloc is None


def test_apply_discount_to_fixed_rate():
    formula = DiscountFormula(fixed=1.50, variable=1.00, heloc=None)
    posted = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)
    discounted = apply_discount(posted, formula)
    assert discounted.posted == 5.69
    assert discounted.discounted == pytest.approx(4.19, abs=0.001)


def test_apply_discount_to_variable_rate():
    formula = DiscountFormula(fixed=1.50, variable=1.00, heloc=None)
    posted = Rate(term=Term.VARIABLE, posted=6.20)
    discounted = apply_discount(posted, formula)
    assert discounted.discounted == pytest.approx(5.20, abs=0.001)


def test_apply_discount_heloc_returns_null():
    formula = DiscountFormula(fixed=1.50, variable=1.00, heloc=None)
    posted = Rate(term=Term.HELOC, posted=7.20)
    discounted = apply_discount(posted, formula)
    assert discounted.discounted is None


def test_apply_discount_never_below_zero():
    """Even a huge discount can't drop a rate below 0%."""
    formula = DiscountFormula(fixed=10.0, variable=1.00, heloc=None)
    posted = Rate(term=Term.ONE_YEAR_FIXED, posted=5.0)
    discounted = apply_discount(posted, formula)
    assert discounted.discounted == 0.0
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd scraper && uv run pytest tests/test_discount.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.discount'`.

- [ ] **Step 4: Implement `scraper/core/discount.py`**

```python
"""Apply a configurable discount formula to posted rates."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

from core.models import Rate, Term


@dataclass(frozen=True)
class DiscountFormula:
    """Discount in percentage points by rate category. None = no discount."""

    fixed: float | None
    variable: float | None
    heloc: float | None

    def for_term(self, term: Term | str) -> float | None:
        value = term.value if isinstance(term, Term) else term
        if value == Term.HELOC.value:
            return self.heloc
        if value == Term.VARIABLE.value:
            return self.variable
        # All other terms are fixed-rate variants
        return self.fixed

    def to_dict(self) -> dict[str, float | None]:
        return {"fixed": self.fixed, "variable": self.variable, "heloc": self.heloc}


def load_discount_formula(path: Path) -> DiscountFormula:
    """Load discount values from YAML config."""
    data = yaml.safe_load(path.read_text())
    return DiscountFormula(
        fixed=data.get("fixed"),
        variable=data.get("variable"),
        heloc=data.get("heloc"),
    )


def apply_discount(rate: Rate, formula: DiscountFormula) -> Rate:
    """Return a new Rate with the discounted field populated per the formula."""
    discount = formula.for_term(rate.term)
    if discount is None:
        return Rate(term=rate.term, posted=rate.posted, discounted=None)
    discounted = max(0.0, round(rate.posted - discount, 2))
    return Rate(term=rate.term, posted=rate.posted, discounted=discounted)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_discount.py -v`
Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scraper/config/discounts.yaml scraper/core/discount.py scraper/tests/test_discount.py
git commit -m "feat(scraper): add configurable discount formula"
```

---

## Task 5: Implement validator

**Files:**
- Create: `scraper/core/validator.py`
- Create: `scraper/tests/test_validator.py`

- [ ] **Step 1: Write the failing test**

Create `scraper/tests/test_validator.py`:

```python
"""Tests for rate validation."""
import pytest

from core.models import Rate, Term
from core.validator import (
    RateValidationError,
    validate_against_previous,
    validate_rate,
    validate_rates_set,
)


def test_validate_rate_accepts_normal_value():
    validate_rate(Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69))


def test_validate_rate_rejects_zero():
    with pytest.raises(RateValidationError, match="out of range"):
        validate_rate(Rate(term=Term.FIVE_YEAR_FIXED, posted=0.0))


def test_validate_rate_rejects_excessive():
    with pytest.raises(RateValidationError, match="out of range"):
        validate_rate(Rate(term=Term.FIVE_YEAR_FIXED, posted=20.0))


def test_validate_rates_set_requires_at_least_one_rate():
    with pytest.raises(RateValidationError, match="empty"):
        validate_rates_set([])


def test_validate_rates_set_rejects_duplicate_terms():
    rates = [
        Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69),
        Rate(term=Term.FIVE_YEAR_FIXED, posted=5.70),
    ]
    with pytest.raises(RateValidationError, match="duplicate"):
        validate_rates_set(rates)


def test_validate_against_previous_allows_small_change():
    prev = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)
    new = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.74)  # +0.05
    validate_against_previous(new, prev)


def test_validate_against_previous_rejects_huge_jump():
    prev = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)
    new = Rate(term=Term.FIVE_YEAR_FIXED, posted=8.50)  # +2.81 too big
    with pytest.raises(RateValidationError, match="changed"):
        validate_against_previous(new, prev)


def test_validate_against_previous_no_op_when_no_prev():
    new = Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69)
    validate_against_previous(new, None)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scraper && uv run pytest tests/test_validator.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.validator'`.

- [ ] **Step 3: Implement `scraper/core/validator.py`**

```python
"""Sanity checks on scraped rates per spec Section 7 ("Reliability safeguards")."""
from __future__ import annotations

from core.models import Rate

MIN_RATE = 0.01
MAX_RATE = 15.0
MAX_DELTA = 2.0  # max allowed change vs previous run, in percentage points


class RateValidationError(ValueError):
    """Raised when a rate fails sanity validation."""


def validate_rate(rate: Rate) -> None:
    """A single rate must be within sane absolute bounds."""
    if not (MIN_RATE <= rate.posted <= MAX_RATE):
        raise RateValidationError(
            f"{rate.term} posted={rate.posted}% out of range "
            f"[{MIN_RATE}, {MAX_RATE}]"
        )


def validate_rates_set(rates: list[Rate]) -> None:
    """A set of rates from one lender must be non-empty and have unique terms."""
    if not rates:
        raise RateValidationError("rates set is empty")
    terms_seen = set()
    for rate in rates:
        validate_rate(rate)
        term_value = rate.term if isinstance(rate.term, str) else rate.term.value
        if term_value in terms_seen:
            raise RateValidationError(f"duplicate term: {term_value}")
        terms_seen.add(term_value)


def validate_against_previous(new: Rate, previous: Rate | None) -> None:
    """A new rate must not jump more than MAX_DELTA from the previous run."""
    if previous is None:
        return
    delta = abs(new.posted - previous.posted)
    if delta > MAX_DELTA:
        raise RateValidationError(
            f"{new.term} changed by {delta:.2f}% "
            f"(prev={previous.posted}, new={new.posted}, max={MAX_DELTA})"
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_validator.py -v`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/core/validator.py scraper/tests/test_validator.py
git commit -m "feat(scraper): add rate validators (range, duplicates, delta)"
```

---

## Task 6: Capture RBC fixture and implement RBCScraper

**Files:**
- Create: `scraper/tests/fixtures/rbc.html`
- Create: `scraper/lenders/rbc.py`
- Create: `scraper/tests/test_lenders.py` (parametrized; will grow with each lender)

- [ ] **Step 1: Capture RBC's posted rates HTML**

Manual step. Open `https://www.rbcroyalbank.com/mortgages/mortgage-rates.html` in a browser. Save the full HTML to `scraper/tests/fixtures/rbc.html` (use "Save Page As" → "HTML only" or `curl -A "Mozilla/5.0 ..." <url> -o scraper/tests/fixtures/rbc.html`).

If the actual URL or layout differs from the above, update `source_url` in `rbc.py` (Step 3) accordingly.

- [ ] **Step 2: Write the failing test**

Create `scraper/tests/test_lenders.py`:

```python
"""Per-lender parser tests against captured HTML fixtures.

Adding a lender = add an entry to LENDER_CASES below.
"""
from pathlib import Path

import pytest

from core.models import Term
from lenders.rbc import RBCScraper

FIXTURES = Path(__file__).parent / "fixtures"


LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
]


@pytest.mark.parametrize("scraper_cls,fixture_name", LENDER_CASES)
def test_parse_extracts_required_terms(scraper_cls, fixture_name):
    """Every Big 6 lender publishes 1/2/3/4/5-year fixed and a variable rate."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    terms = {r.term if isinstance(r.term, str) else r.term.value for r in rates}
    required = {
        Term.ONE_YEAR_FIXED.value,
        Term.THREE_YEAR_FIXED.value,
        Term.FIVE_YEAR_FIXED.value,
        Term.VARIABLE.value,
    }
    missing = required - terms
    assert not missing, f"{scraper_cls.__name__} missing terms: {missing}"


@pytest.mark.parametrize("scraper_cls,fixture_name", LENDER_CASES)
def test_parse_rates_are_in_sane_range(scraper_cls, fixture_name):
    """Posted rates should be in 1%–15%."""
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    for r in rates:
        assert 1.0 <= r.posted <= 15.0, f"{r.term} posted={r.posted} out of range"


@pytest.mark.parametrize("scraper_cls,fixture_name", LENDER_CASES)
def test_parse_no_duplicate_terms(scraper_cls, fixture_name):
    html = (FIXTURES / fixture_name).read_text(encoding="utf-8")
    scraper = scraper_cls()
    rates = scraper.parse(html)
    terms = [r.term if isinstance(r.term, str) else r.term.value for r in rates]
    assert len(terms) == len(set(terms)), f"{scraper_cls.__name__} returned duplicates"
```

- [ ] **Step 3: Implement `scraper/lenders/rbc.py`**

The exact CSS selectors / table structure depend on RBC's current page; inspect the saved fixture and adjust. The skeleton below shows the expected structure.

```python
"""RBC Royal Bank posted mortgage rates scraper."""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper

# Map RBC's term labels (as they appear on the page) to our Term enum.
# Inspect rbc.html and update this map to whatever RBC actually uses.
TERM_LABEL_MAP = {
    "1 year": Term.ONE_YEAR_FIXED,
    "2 year": Term.TWO_YEAR_FIXED,
    "3 year": Term.THREE_YEAR_FIXED,
    "4 year": Term.FOUR_YEAR_FIXED,
    "5 year": Term.FIVE_YEAR_FIXED,
    "7 year": Term.SEVEN_YEAR_FIXED,
    "10 year": Term.TEN_YEAR_FIXED,
    "variable": Term.VARIABLE,
}

PERCENT_RE = re.compile(r"(\d+\.\d+)\s*%")


class RBCScraper(LenderScraper):
    slug = "rbc"
    name = "RBC Royal Bank"
    type = LenderType.BIG6
    source_url = "https://www.rbcroyalbank.com/mortgages/mortgage-rates.html"
    affiliate_url = None

    USER_AGENT = "MortgageRatesBot/0.1 (+https://yourdomain.ca/methodology)"

    def fetch(self) -> str:
        with httpx.Client(
            headers={"User-Agent": self.USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            response = client.get(self.source_url)
            response.raise_for_status()
            return response.text

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: dict[Term, float] = {}

        # RBC publishes posted rates in a table. Iterate every row, find a label
        # cell that matches one of TERM_LABEL_MAP and a sibling cell with a percent.
        # Adjust the selector based on what's actually in rbc.html.
        for row in soup.find_all("tr"):
            cells = [c.get_text(" ", strip=True).lower() for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            label = cells[0]
            term = self._match_term(label)
            if term is None:
                continue
            for cell in cells[1:]:
                m = PERCENT_RE.search(cell)
                if m:
                    rates[term] = float(m.group(1))
                    break

        return [Rate(term=t, posted=v) for t, v in rates.items()]

    @staticmethod
    def _match_term(label: str) -> Term | None:
        for key, term in TERM_LABEL_MAP.items():
            if key in label:
                return term
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v`
Expected: 3 tests PASS (`rbc` parametrization).

If they fail, inspect the fixture and adjust the parser selectors and/or `TERM_LABEL_MAP` until the parser extracts the required terms with sane values.

- [ ] **Step 5: Commit**

```bash
git add scraper/lenders/rbc.py scraper/tests/test_lenders.py scraper/tests/fixtures/rbc.html
git commit -m "feat(scraper): add RBC scraper with fixture-based test"
```

---

## Task 7: Implement TDScraper

**Files:**
- Create: `scraper/tests/fixtures/td.html`
- Create: `scraper/lenders/td.py`
- Modify: `scraper/tests/test_lenders.py` (add `td` to `LENDER_CASES`)

- [ ] **Step 1: Capture TD's posted rates HTML**

Manual step. Save `https://www.td.com/ca/en/personal-banking/products/mortgages/mortgage-rates` to `scraper/tests/fixtures/td.html`.

- [ ] **Step 2: Add TD to the parametrized test list**

In `scraper/tests/test_lenders.py`, modify the imports and `LENDER_CASES`:

```python
from lenders.rbc import RBCScraper
from lenders.td import TDScraper

LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
]
```

- [ ] **Step 3: Run tests to verify TD fails**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v`
Expected: TD parametrization FAILs with `ModuleNotFoundError: No module named 'lenders.td'`.

- [ ] **Step 4: Implement `scraper/lenders/td.py`**

Use the same pattern as `rbc.py`. Inspect `td.html` to find TD's rate-table structure and adjust selectors / label map.

```python
"""TD Bank posted mortgage rates scraper."""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper

TERM_LABEL_MAP = {
    "1 year": Term.ONE_YEAR_FIXED,
    "2 year": Term.TWO_YEAR_FIXED,
    "3 year": Term.THREE_YEAR_FIXED,
    "4 year": Term.FOUR_YEAR_FIXED,
    "5 year": Term.FIVE_YEAR_FIXED,
    "6 year": None,  # TD lists 6yr; we don't model it
    "7 year": Term.SEVEN_YEAR_FIXED,
    "10 year": Term.TEN_YEAR_FIXED,
    "variable": Term.VARIABLE,
}

PERCENT_RE = re.compile(r"(\d+\.\d+)\s*%")


class TDScraper(LenderScraper):
    slug = "td"
    name = "TD Bank"
    type = LenderType.BIG6
    source_url = "https://www.td.com/ca/en/personal-banking/products/mortgages/mortgage-rates"
    affiliate_url = None

    USER_AGENT = "MortgageRatesBot/0.1 (+https://yourdomain.ca/methodology)"

    def fetch(self) -> str:
        with httpx.Client(
            headers={"User-Agent": self.USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            response = client.get(self.source_url)
            response.raise_for_status()
            return response.text

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: dict[Term, float] = {}
        for row in soup.find_all("tr"):
            cells = [c.get_text(" ", strip=True).lower() for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            term = self._match_term(cells[0])
            if term is None:
                continue
            for cell in cells[1:]:
                m = PERCENT_RE.search(cell)
                if m:
                    rates[term] = float(m.group(1))
                    break
        return [Rate(term=t, posted=v) for t, v in rates.items()]

    @staticmethod
    def _match_term(label: str) -> Term | None:
        for key, term in TERM_LABEL_MAP.items():
            if term is None:
                continue
            if key in label:
                return term
        return None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k td`
Expected: TD parametrization PASSES.

If parsing fails, adjust selectors based on the actual HTML structure of `td.html`.

- [ ] **Step 6: Commit**

```bash
git add scraper/lenders/td.py scraper/tests/fixtures/td.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add TD scraper"
```

---

## Task 8: Implement ScotiaScraper

**Files:**
- Create: `scraper/tests/fixtures/scotia.html`
- Create: `scraper/lenders/scotia.py`
- Modify: `scraper/tests/test_lenders.py`

- [ ] **Step 1: Capture Scotiabank's posted rates HTML**

Manual step. Save `https://www.scotiabank.com/ca/en/personal/rates-prices/mortgage-rates.html` to `scraper/tests/fixtures/scotia.html`.

- [ ] **Step 2: Add Scotia to `LENDER_CASES`**

```python
from lenders.scotia import ScotiaScraper

LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(ScotiaScraper, "scotia.html", id="scotia"),
]
```

- [ ] **Step 3: Run tests to verify Scotia fails**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k scotia`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 4: Implement `scraper/lenders/scotia.py`**

Same pattern as TD. Copy `td.py`, change `slug`, `name`, `source_url`, and adjust `TERM_LABEL_MAP` and parser selectors based on `scotia.html`.

```python
"""Scotiabank posted mortgage rates scraper."""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper

TERM_LABEL_MAP = {
    "1 year": Term.ONE_YEAR_FIXED,
    "2 year": Term.TWO_YEAR_FIXED,
    "3 year": Term.THREE_YEAR_FIXED,
    "4 year": Term.FOUR_YEAR_FIXED,
    "5 year": Term.FIVE_YEAR_FIXED,
    "7 year": Term.SEVEN_YEAR_FIXED,
    "10 year": Term.TEN_YEAR_FIXED,
    "variable": Term.VARIABLE,
}

PERCENT_RE = re.compile(r"(\d+\.\d+)\s*%")


class ScotiaScraper(LenderScraper):
    slug = "scotia"
    name = "Scotiabank"
    type = LenderType.BIG6
    source_url = "https://www.scotiabank.com/ca/en/personal/rates-prices/mortgage-rates.html"
    affiliate_url = None

    USER_AGENT = "MortgageRatesBot/0.1 (+https://yourdomain.ca/methodology)"

    def fetch(self) -> str:
        with httpx.Client(
            headers={"User-Agent": self.USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            response = client.get(self.source_url)
            response.raise_for_status()
            return response.text

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: dict[Term, float] = {}
        for row in soup.find_all("tr"):
            cells = [c.get_text(" ", strip=True).lower() for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            term = self._match_term(cells[0])
            if term is None:
                continue
            for cell in cells[1:]:
                m = PERCENT_RE.search(cell)
                if m:
                    rates[term] = float(m.group(1))
                    break
        return [Rate(term=t, posted=v) for t, v in rates.items()]

    @staticmethod
    def _match_term(label: str) -> Term | None:
        for key, term in TERM_LABEL_MAP.items():
            if key in label:
                return term
        return None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k scotia`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scraper/lenders/scotia.py scraper/tests/fixtures/scotia.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add Scotiabank scraper"
```

---

## Task 9: Implement BMOScraper

**Files:**
- Create: `scraper/tests/fixtures/bmo.html`
- Create: `scraper/lenders/bmo.py`
- Modify: `scraper/tests/test_lenders.py`

- [ ] **Step 1: Capture BMO's posted rates HTML**

Save `https://www.bmo.com/main/personal/mortgages/mortgage-rates/` to `scraper/tests/fixtures/bmo.html`.

- [ ] **Step 2: Add BMO to `LENDER_CASES`**

```python
from lenders.bmo import BMOScraper

LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(ScotiaScraper, "scotia.html", id="scotia"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
]
```

- [ ] **Step 3: Run tests to verify BMO fails**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k bmo`
Expected: FAIL.

- [ ] **Step 4: Implement `scraper/lenders/bmo.py`**

Same skeleton as `scotia.py`. Update `slug` to `"bmo"`, `name` to `"BMO Bank of Montreal"`, `source_url` to BMO's URL, and inspect `bmo.html` to adjust parser/labels.

```python
"""BMO posted mortgage rates scraper."""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper

TERM_LABEL_MAP = {
    "1 year": Term.ONE_YEAR_FIXED,
    "2 year": Term.TWO_YEAR_FIXED,
    "3 year": Term.THREE_YEAR_FIXED,
    "4 year": Term.FOUR_YEAR_FIXED,
    "5 year": Term.FIVE_YEAR_FIXED,
    "7 year": Term.SEVEN_YEAR_FIXED,
    "10 year": Term.TEN_YEAR_FIXED,
    "variable": Term.VARIABLE,
}

PERCENT_RE = re.compile(r"(\d+\.\d+)\s*%")


class BMOScraper(LenderScraper):
    slug = "bmo"
    name = "BMO Bank of Montreal"
    type = LenderType.BIG6
    source_url = "https://www.bmo.com/main/personal/mortgages/mortgage-rates/"
    affiliate_url = None

    USER_AGENT = "MortgageRatesBot/0.1 (+https://yourdomain.ca/methodology)"

    def fetch(self) -> str:
        with httpx.Client(
            headers={"User-Agent": self.USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            response = client.get(self.source_url)
            response.raise_for_status()
            return response.text

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: dict[Term, float] = {}
        for row in soup.find_all("tr"):
            cells = [c.get_text(" ", strip=True).lower() for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            term = self._match_term(cells[0])
            if term is None:
                continue
            for cell in cells[1:]:
                m = PERCENT_RE.search(cell)
                if m:
                    rates[term] = float(m.group(1))
                    break
        return [Rate(term=t, posted=v) for t, v in rates.items()]

    @staticmethod
    def _match_term(label: str) -> Term | None:
        for key, term in TERM_LABEL_MAP.items():
            if key in label:
                return term
        return None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k bmo`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scraper/lenders/bmo.py scraper/tests/fixtures/bmo.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add BMO scraper"
```

---

## Task 10: Implement CIBCScraper

**Files:**
- Create: `scraper/tests/fixtures/cibc.html`
- Create: `scraper/lenders/cibc.py`
- Modify: `scraper/tests/test_lenders.py`

- [ ] **Step 1: Capture CIBC's posted rates HTML**

Save `https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html` to `scraper/tests/fixtures/cibc.html`.

- [ ] **Step 2: Add CIBC to `LENDER_CASES`**

```python
from lenders.cibc import CIBCScraper

LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(ScotiaScraper, "scotia.html", id="scotia"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(CIBCScraper, "cibc.html", id="cibc"),
]
```

- [ ] **Step 3: Run tests to verify CIBC fails**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k cibc`
Expected: FAIL.

- [ ] **Step 4: Implement `scraper/lenders/cibc.py`**

```python
"""CIBC posted mortgage rates scraper."""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper

TERM_LABEL_MAP = {
    "1 year": Term.ONE_YEAR_FIXED,
    "2 year": Term.TWO_YEAR_FIXED,
    "3 year": Term.THREE_YEAR_FIXED,
    "4 year": Term.FOUR_YEAR_FIXED,
    "5 year": Term.FIVE_YEAR_FIXED,
    "7 year": Term.SEVEN_YEAR_FIXED,
    "10 year": Term.TEN_YEAR_FIXED,
    "variable": Term.VARIABLE,
}

PERCENT_RE = re.compile(r"(\d+\.\d+)\s*%")


class CIBCScraper(LenderScraper):
    slug = "cibc"
    name = "CIBC"
    type = LenderType.BIG6
    source_url = "https://www.cibc.com/en/personal-banking/mortgages/mortgage-rates.html"
    affiliate_url = None

    USER_AGENT = "MortgageRatesBot/0.1 (+https://yourdomain.ca/methodology)"

    def fetch(self) -> str:
        with httpx.Client(
            headers={"User-Agent": self.USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            response = client.get(self.source_url)
            response.raise_for_status()
            return response.text

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: dict[Term, float] = {}
        for row in soup.find_all("tr"):
            cells = [c.get_text(" ", strip=True).lower() for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            term = self._match_term(cells[0])
            if term is None:
                continue
            for cell in cells[1:]:
                m = PERCENT_RE.search(cell)
                if m:
                    rates[term] = float(m.group(1))
                    break
        return [Rate(term=t, posted=v) for t, v in rates.items()]

    @staticmethod
    def _match_term(label: str) -> Term | None:
        for key, term in TERM_LABEL_MAP.items():
            if key in label:
                return term
        return None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k cibc`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scraper/lenders/cibc.py scraper/tests/fixtures/cibc.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add CIBC scraper"
```

---

## Task 11: Implement NationalScraper

**Files:**
- Create: `scraper/tests/fixtures/national.html`
- Create: `scraper/lenders/national.py`
- Modify: `scraper/tests/test_lenders.py`

- [ ] **Step 1: Capture National Bank's posted rates HTML**

Save `https://www.nbc.ca/personal/mortgages/mortgage-rates.html` to `scraper/tests/fixtures/national.html`.

- [ ] **Step 2: Add National to `LENDER_CASES`**

```python
from lenders.national import NationalScraper

LENDER_CASES = [
    pytest.param(RBCScraper, "rbc.html", id="rbc"),
    pytest.param(TDScraper, "td.html", id="td"),
    pytest.param(ScotiaScraper, "scotia.html", id="scotia"),
    pytest.param(BMOScraper, "bmo.html", id="bmo"),
    pytest.param(CIBCScraper, "cibc.html", id="cibc"),
    pytest.param(NationalScraper, "national.html", id="national"),
]
```

- [ ] **Step 3: Run tests to verify National fails**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k national`
Expected: FAIL.

- [ ] **Step 4: Implement `scraper/lenders/national.py`**

```python
"""National Bank of Canada posted mortgage rates scraper."""
from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup

from core.models import LenderType, Rate, Term
from lenders.base import LenderScraper

TERM_LABEL_MAP = {
    "1 year": Term.ONE_YEAR_FIXED,
    "2 year": Term.TWO_YEAR_FIXED,
    "3 year": Term.THREE_YEAR_FIXED,
    "4 year": Term.FOUR_YEAR_FIXED,
    "5 year": Term.FIVE_YEAR_FIXED,
    "7 year": Term.SEVEN_YEAR_FIXED,
    "10 year": Term.TEN_YEAR_FIXED,
    "variable": Term.VARIABLE,
}

PERCENT_RE = re.compile(r"(\d+\.\d+)\s*%")


class NationalScraper(LenderScraper):
    slug = "national"
    name = "National Bank of Canada"
    type = LenderType.BIG6
    source_url = "https://www.nbc.ca/personal/mortgages/mortgage-rates.html"
    affiliate_url = None

    USER_AGENT = "MortgageRatesBot/0.1 (+https://yourdomain.ca/methodology)"

    def fetch(self) -> str:
        with httpx.Client(
            headers={"User-Agent": self.USER_AGENT},
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            response = client.get(self.source_url)
            response.raise_for_status()
            return response.text

    def parse(self, html: str) -> list[Rate]:
        soup = BeautifulSoup(html, "lxml")
        rates: dict[Term, float] = {}
        for row in soup.find_all("tr"):
            cells = [c.get_text(" ", strip=True).lower() for c in row.find_all(["td", "th"])]
            if len(cells) < 2:
                continue
            term = self._match_term(cells[0])
            if term is None:
                continue
            for cell in cells[1:]:
                m = PERCENT_RE.search(cell)
                if m:
                    rates[term] = float(m.group(1))
                    break
        return [Rate(term=t, posted=v) for t, v in rates.items()]

    @staticmethod
    def _match_term(label: str) -> Term | None:
        for key, term in TERM_LABEL_MAP.items():
            if key in label:
                return term
        return None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v -k national`
Expected: PASS.

- [ ] **Step 6: Verify all 6 lenders pass together**

Run: `cd scraper && uv run pytest tests/test_lenders.py -v`
Expected: 18 PASS (3 tests × 6 lenders).

- [ ] **Step 7: Commit**

```bash
git add scraper/lenders/national.py scraper/tests/fixtures/national.html scraper/tests/test_lenders.py
git commit -m "feat(scraper): add National Bank scraper (Big 6 complete)"
```

---

## Task 12: Implement runner

**Files:**
- Create: `scraper/core/runner.py`
- Create: `scraper/tests/test_runner.py`

- [ ] **Step 1: Write the failing test**

Create `scraper/tests/test_runner.py`:

```python
"""Tests for the orchestration runner."""
from datetime import datetime, timezone
from pathlib import Path

from core.discount import DiscountFormula
from core.models import LenderType, Rate, RatesData, Term
from core.runner import build_rates_data
from lenders.base import LenderScraper


class StubLender(LenderScraper):
    slug = "stub"
    name = "Stub Lender"
    type = LenderType.BIG6
    source_url = "https://example.com"
    affiliate_url = None

    def fetch(self) -> str:
        return "<html/>"

    def parse(self, html: str) -> list[Rate]:
        return [
            Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69),
            Rate(term=Term.VARIABLE, posted=6.20),
        ]


class FailingLender(LenderScraper):
    slug = "failing"
    name = "Failing Lender"
    type = LenderType.BIG6
    source_url = "https://example.com"
    affiliate_url = None

    def fetch(self) -> str:
        raise RuntimeError("network down")

    def parse(self, html: str) -> list[Rate]:
        raise NotImplementedError


def test_build_rates_data_assembles_lenders():
    formula = DiscountFormula(fixed=1.50, variable=1.00, heloc=None)
    data = build_rates_data([StubLender()], formula)
    assert isinstance(data, RatesData)
    assert len(data.lenders) == 1
    rates = data.lenders[0].rates
    fixed = next(r for r in rates if (r.term if isinstance(r.term, str) else r.term.value) == "5yr_fixed")
    assert fixed.discounted == 4.19


def test_build_rates_data_skips_failed_lenders_with_no_previous():
    """A lender that errors and has no previous data is skipped (not crashed)."""
    formula = DiscountFormula(fixed=1.50, variable=1.00, heloc=None)
    data = build_rates_data([StubLender(), FailingLender()], formula)
    slugs = [lender.slug for lender in data.lenders]
    assert slugs == ["stub"]


def test_build_rates_data_retains_previous_for_failed_lender():
    """If a lender fails but we have a previous run, retain its previous data."""
    formula = DiscountFormula(fixed=1.50, variable=1.00, heloc=None)
    previous = RatesData(
        updated_at=datetime(2026, 4, 24, tzinfo=timezone.utc),
        discount_formula=formula.to_dict(),
        lenders=[
            StubLender().to_lender([
                Rate(term=Term.FIVE_YEAR_FIXED, posted=5.50, discounted=4.00),
            ]),
            FailingLender().to_lender([
                Rate(term=Term.FIVE_YEAR_FIXED, posted=5.99, discounted=4.49),
            ]),
        ],
    )
    data = build_rates_data([StubLender(), FailingLender()], formula, previous=previous)
    slugs = sorted(lender.slug for lender in data.lenders)
    assert slugs == ["failing", "stub"]
    failing = next(l for l in data.lenders if l.slug == "failing")
    # Previous data preserved
    assert failing.rates[0].posted == 5.99
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scraper && uv run pytest tests/test_runner.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.runner'`.

- [ ] **Step 3: Implement `scraper/core/runner.py`**

```python
"""Orchestrate all lender scrapers into a single RatesData."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.discount import DiscountFormula, apply_discount
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
        except Exception as exc:  # noqa: BLE001 — we want to swallow per-lender errors
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
                raise RateValidationError(
                    f"{scraper.slug}: {exc}"
                ) from exc

    discounted = [apply_discount(r, formula) for r in raw_rates]
    return scraper.to_lender(discounted)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_runner.py -v`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/core/runner.py scraper/tests/test_runner.py
git commit -m "feat(scraper): add runner with per-lender failure isolation"
```

---

## Task 13: Implement publisher (local file write)

**Files:**
- Create: `scraper/core/publisher.py`
- Create: `scraper/tests/test_publisher.py`

This task only handles writing the JSON file locally and reading the previous one. Pushing to the `data` branch and calling the Cloudflare deploy hook is in the deploy plan (plan 3) and uses GitHub Actions logic, not Python.

- [ ] **Step 1: Write the failing test**

Create `scraper/tests/test_publisher.py`:

```python
"""Tests for the JSON publisher."""
import json
from datetime import datetime, timezone
from pathlib import Path

from core.models import LenderType, Rate, RatesData, Term
from core.publisher import load_previous_rates, write_rates_json
from lenders.base import LenderScraper


class FakeLender(LenderScraper):
    slug = "fake"
    name = "Fake"
    type = LenderType.BIG6
    source_url = "https://example.com"
    affiliate_url = None

    def fetch(self) -> str:
        return ""

    def parse(self, html: str) -> list[Rate]:
        return []


def _sample_data() -> RatesData:
    rates = [Rate(term=Term.FIVE_YEAR_FIXED, posted=5.69, discounted=4.19)]
    lender = FakeLender().to_lender(rates)
    return RatesData(
        updated_at=datetime(2026, 4, 25, 10, 0, tzinfo=timezone.utc),
        discount_formula={"fixed": 1.50, "variable": 1.00, "heloc": None},
        lenders=[lender],
    )


def test_write_rates_json_creates_file_with_spec_shape(tmp_path: Path):
    output = tmp_path / "rates.json"
    write_rates_json(_sample_data(), output)
    assert output.exists()
    parsed = json.loads(output.read_text())
    assert parsed["updated_at"] == "2026-04-25T10:00:00Z"
    assert parsed["discount_formula"] == {"fixed": 1.50, "variable": 1.00, "heloc": None}
    assert parsed["lenders"][0]["slug"] == "fake"
    assert parsed["lenders"][0]["rates"][0]["posted"] == 5.69


def test_write_rates_json_creates_parent_dirs(tmp_path: Path):
    output = tmp_path / "data" / "nested" / "rates.json"
    write_rates_json(_sample_data(), output)
    assert output.exists()


def test_load_previous_rates_returns_none_when_missing(tmp_path: Path):
    assert load_previous_rates(tmp_path / "missing.json") is None


def test_load_previous_rates_roundtrips(tmp_path: Path):
    output = tmp_path / "rates.json"
    original = _sample_data()
    write_rates_json(original, output)
    loaded = load_previous_rates(output)
    assert loaded is not None
    assert loaded.lenders[0].slug == "fake"
    assert loaded.lenders[0].rates[0].posted == 5.69
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scraper && uv run pytest tests/test_publisher.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'core.publisher'`.

- [ ] **Step 3: Implement `scraper/core/publisher.py`**

```python
"""Read previous rates and write the new rates.json."""
from __future__ import annotations

import json
from pathlib import Path

from core.models import RatesData


def load_previous_rates(path: Path) -> RatesData | None:
    """Load previous rates.json if it exists; return None otherwise."""
    if not path.exists():
        return None
    return RatesData.model_validate_json(path.read_text())


def write_rates_json(data: RatesData, path: Path) -> None:
    """Write rates data to disk using the spec's JSON shape."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data.model_dump(mode="json"), indent=2) + "\n",
        encoding="utf-8",
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scraper && uv run pytest tests/test_publisher.py -v`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/core/publisher.py scraper/tests/test_publisher.py
git commit -m "feat(scraper): add JSON publisher with previous-load support"
```

---

## Task 14: Implement CLI entry point

**Files:**
- Create: `scraper/core/cli.py`

- [ ] **Step 1: Implement `scraper/core/cli.py`**

```python
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
from lenders.bmo import BMOScraper
from lenders.cibc import CIBCScraper
from lenders.national import NationalScraper
from lenders.rbc import RBCScraper
from lenders.scotia import ScotiaScraper
from lenders.td import TDScraper

log = logging.getLogger("scraper")

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent.parent / "data" / "rates.json"
DEFAULT_DISCOUNTS = Path(__file__).resolve().parent.parent / "config" / "discounts.yaml"


def all_scrapers() -> list[LenderScraper]:
    return [
        RBCScraper(),
        TDScraper(),
        ScotiaScraper(),
        BMOScraper(),
        CIBCScraper(),
        NationalScraper(),
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
```

- [ ] **Step 2: Verify CLI help works**

Run: `cd scraper && uv run python -m core.cli --help`
Expected: prints usage with `--dry-run`, `--output`, `--discounts`, `--verbose` flags.

- [ ] **Step 3: Add `data/` to `.gitignore`**

The CLI writes `data/rates.json` at the repo root for local dev. In production this file lives only on the `data` branch (set up in plan 3), so it must not be committed to `main`. Append to repo-root `.gitignore`:

```
# Scraper local output (lives on data branch in production)
/data/
```

Verify with: `cd .. && git check-ignore -v data/rates.json`
Expected: prints the matching `.gitignore` line.

- [ ] **Step 4: Manual end-to-end run (dry-run, network required)**

Run: `cd scraper && uv run python -m core.cli --dry-run --verbose`
Expected: hits all 6 lender pages, prints a JSON document with up to 6 lenders to stdout. Some lenders may be missing if their pages have changed; the run should not crash.

If a lender's parser fails, capture the new HTML to its fixture file, fix the parser, run its test, and re-run the dry-run.

- [ ] **Step 5: Run the full test suite**

Run: `cd scraper && uv run pytest -v`
Expected: all tests across all files PASS (models, base, discount, validator, runner, publisher, lenders).

- [ ] **Step 6: Commit**

```bash
git add scraper/core/cli.py .gitignore
git commit -m "feat(scraper): add CLI entry point with --dry-run"
```

---

## Verification (end of plan)

After Task 14, the scraper subsystem is complete and verifiable on its own:

- [ ] `cd scraper && uv run pytest -v` — all unit and fixture tests pass
- [ ] `cd scraper && uv run python -m core.cli --dry-run` — produces a valid `rates.json` document on stdout with the Big 6 banks
- [ ] `cd scraper && uv run python -m core.cli` — writes `data/rates.json` to the repo root
- [ ] The written `data/rates.json` matches the schema shown in the spec (Section 6)

The data file produced here is the input to plans 2 (site) and 3 (deploy wiring).
