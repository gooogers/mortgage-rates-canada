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
