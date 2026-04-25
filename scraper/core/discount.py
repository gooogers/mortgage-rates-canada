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
