import { describe, expect, it } from "vitest";
import { buildAmortization, calculateMortgage, cmhcPremiumRate } from "@lib/calculator";

describe("cmhcPremiumRate", () => {
  it("returns 0 when down payment is 20% or more", () => {
    expect(cmhcPremiumRate(0.20)).toBe(0);
    expect(cmhcPremiumRate(0.50)).toBe(0);
  });

  it("returns 4.00% when down payment is between 5% and 9.99%", () => {
    expect(cmhcPremiumRate(0.05)).toBe(0.04);
    expect(cmhcPremiumRate(0.0999)).toBe(0.04);
  });

  it("returns 3.10% when down payment is 10–14.99%", () => {
    expect(cmhcPremiumRate(0.10)).toBe(0.031);
    expect(cmhcPremiumRate(0.149)).toBe(0.031);
  });

  it("returns 2.80% when down payment is 15–19.99%", () => {
    expect(cmhcPremiumRate(0.15)).toBe(0.028);
    expect(cmhcPremiumRate(0.1999)).toBe(0.028);
  });

  it("throws when down payment is below the 5% minimum", () => {
    expect(() => cmhcPremiumRate(0.04)).toThrow();
  });
});

describe("calculateMortgage", () => {
  // Reference scenario: $500k home, 20% down, 5% rate, 25yr, monthly.
  // Loan = $400k. Per Canadian convention (semi-annual compounding,
  // monthly payments), monthly payment = $2,326.42 (verified against
  // Bank of Canada and major bank calculators).
  it("computes monthly payment for a 20% down conventional mortgage", () => {
    const result = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "monthly",
    });
    expect(result.cmhcPremium).toBe(0);
    expect(result.principal).toBe(400_000);
    expect(result.totalLoan).toBe(400_000);
    expect(result.payment).toBeCloseTo(2326.42, 1);
    expect(result.totalPaid).toBeCloseTo(2326.42 * 12 * 25, -2);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - 400_000, -2);
  });

  // Insured scenario: $500k home, 5% down, 5% rate, 25yr, monthly.
  // Down = $25k. Loan-before-CMHC = $475k. CMHC = 4% × $475k = $19,000.
  // Total loan = $494,000. Monthly payment = $2,873.13.
  it("adds CMHC insurance to the loan when down payment is below 20%", () => {
    const result = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.05,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "monthly",
    });
    expect(result.cmhcPremium).toBe(19_000);
    expect(result.totalLoan).toBe(494_000);
    expect(result.payment).toBeCloseTo(2873.13, 1);
  });

  // Bi-weekly: 26 payments per year. Payment is computed from the bi-weekly
  // periodic rate, NOT as monthly × 12/26 (that approximation drifts under
  // semi-annual compounding). Reference: $400k, 5%, 25yr, biweekly = $1,072.54.
  it("computes bi-weekly payment correctly (26 payments per year)", () => {
    const result = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "biweekly",
    });
    expect(result.paymentsPerYear).toBe(26);
    expect(result.payment).toBeCloseTo(1072.54, 1);
  });

  it("supports accelerated bi-weekly frequency (monthly / 2)", () => {
    const monthly = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "monthly",
    });
    const accelerated = calculateMortgage({
      homePrice: 500_000,
      downPaymentPct: 0.20,
      annualRatePct: 5.0,
      amortizationYears: 25,
      frequency: "accelerated_biweekly",
    });
    // Accelerated bi-weekly is exactly monthly / 2 by definition.
    expect(accelerated.payment).toBeCloseTo(monthly.payment / 2, 2);
  });

  it("handles a 0% rate as straight division of principal by number of payments", () => {
    const result = calculateMortgage({
      homePrice: 240_000,
      downPaymentPct: 0.20,
      annualRatePct: 0,
      amortizationYears: 20,
      frequency: "monthly",
    });
    // Loan = 192,000; payments = 240; per payment = 800
    expect(result.principal).toBe(192_000);
    expect(result.payment).toBeCloseTo(800, 2);
    expect(result.totalInterest).toBeCloseTo(0, 2);
  });
});

describe("buildAmortization", () => {
  const baseInput = {
    homePrice: 500_000,
    downPaymentPct: 0.20,
    annualRatePct: 5.0,
    amortizationYears: 25,
    frequency: "monthly" as const,
  };

  it("starts at the loan amount and ends near zero", () => {
    const sched = buildAmortization(baseInput);
    expect(sched.balance).toHaveLength(301); // 25 * 12 + 1
    expect(sched.balance[0]).toBe(400_000);
    expect(sched.balance[sched.balance.length - 1]).toBeCloseTo(0, 1);
  });

  it("cumulative interest matches calculateMortgage's total interest", () => {
    const sched = buildAmortization(baseInput);
    const result = calculateMortgage(baseInput);
    expect(sched.cumulativeInterest[0]).toBe(0);
    expect(sched.cumulativeInterest[sched.cumulativeInterest.length - 1]).toBeCloseTo(
      result.totalInterest,
      0,
    );
  });

  it("balance is monotonically non-increasing across the schedule", () => {
    const sched = buildAmortization(baseInput);
    for (let i = 1; i < sched.balance.length; i++) {
      expect(sched.balance[i]).toBeLessThanOrEqual(sched.balance[i - 1] + 1e-6);
    }
  });

  it("handles bi-weekly frequency with 26 periods per year", () => {
    const sched = buildAmortization({ ...baseInput, frequency: "biweekly" });
    expect(sched.paymentsPerYear).toBe(26);
    expect(sched.balance).toHaveLength(25 * 26 + 1);
    expect(sched.balance[sched.balance.length - 1]).toBeCloseTo(0, 1);
  });
});
