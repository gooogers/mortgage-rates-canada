import { describe, expect, it } from "vitest";
import {
  affordabilityRateSensitivity,
  calculateAffordability,
  qualifyingRate,
} from "@lib/affordability";

describe("qualifyingRate", () => {
  it("uses contract + 2 when above floor", () => {
    expect(qualifyingRate(5.0)).toBeCloseTo(7.0);
  });
  it("uses 5.25 floor when contract is low", () => {
    expect(qualifyingRate(2.5)).toBe(5.25);
  });
  it("uses contract + 2 right at the boundary", () => {
    expect(qualifyingRate(3.25)).toBe(5.25);
    expect(qualifyingRate(3.26)).toBeCloseTo(5.26);
  });
});

describe("calculateAffordability", () => {
  const base = {
    grossAnnualIncome: 120_000,
    monthlyDebts: 500,
    estimatedPropertyTax: 400,
    estimatedHeat: 100,
    estimatedCondoFees: 0,
    downPayment: 80_000,
    contractRate: 5.0,
    amortizationYears: 25,
  };

  it("returns positive max mortgage for typical input", () => {
    const r = calculateAffordability(base);
    expect(r.maxMortgage).toBeGreaterThan(0);
    expect(r.maxPurchasePrice).toBeGreaterThan(r.maxMortgage);
  });

  it("uses qualifying rate, not contract rate, to size mortgage", () => {
    const r = calculateAffordability(base);
    expect(r.qualifyingRate).toBeCloseTo(7.0);
  });

  it("identifies binding constraint correctly when GDS limits", () => {
    const r = calculateAffordability({ ...base, monthlyDebts: 0 });
    expect(r.bindingConstraint).toBe("gds");
  });

  it("identifies TDS as binding when debts are large", () => {
    const r = calculateAffordability({ ...base, monthlyDebts: 2000 });
    expect(r.bindingConstraint).toBe("tds");
  });

  it("returns 0 mortgage when housing already exceeds GDS", () => {
    const r = calculateAffordability({
      ...base,
      grossAnnualIncome: 30_000,
      estimatedPropertyTax: 2000,
    });
    expect(r.maxMortgage).toBe(0);
  });

  it("counts 50% of condo fees in housing costs", () => {
    const noCondo = calculateAffordability(base);
    const withCondo = calculateAffordability({ ...base, estimatedCondoFees: 600 });
    expect(withCondo.maxMortgage).toBeLessThan(noCondo.maxMortgage);
  });
});

describe("affordabilityRateSensitivity", () => {
  const base = {
    grossAnnualIncome: 120_000,
    monthlyDebts: 500,
    estimatedPropertyTax: 400,
    estimatedHeat: 100,
    estimatedCondoFees: 0,
    downPayment: 80_000,
    contractRate: 5.0,
    amortizationYears: 25,
  };

  it("returns one point per offset and flags the user's contract rate", () => {
    const points = affordabilityRateSensitivity(base);
    expect(points).toHaveLength(6);
    const current = points.filter((p) => p.current);
    expect(current).toHaveLength(1);
    expect(current[0].contractRate).toBeCloseTo(5.0);
  });

  it("max purchase price decreases monotonically as rate rises", () => {
    const points = affordabilityRateSensitivity(base);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].maxPurchasePrice).toBeLessThanOrEqual(
        points[i - 1].maxPurchasePrice + 1e-6,
      );
    }
  });

  it("clamps negative rates to zero", () => {
    const points = affordabilityRateSensitivity({ ...base, contractRate: 1.0 }, [-3, 0]);
    expect(points[0].contractRate).toBe(0);
  });
});
