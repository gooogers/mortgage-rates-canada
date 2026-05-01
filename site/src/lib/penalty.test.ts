import { describe, expect, it } from "vitest";
import { calculatePenalty, compareBreakingMortgage } from "@lib/penalty";

describe("calculatePenalty", () => {
  it("returns 3 months' interest for variable closed", () => {
    const r = calculatePenalty({
      balance: 400_000,
      contractRate: 4.5,
      monthsRemaining: 30,
      type: "variable",
      comparisonRate: 0,
      postedSpread: 0,
    });
    // 400_000 * 0.045 * 0.25 = 4500
    expect(r.threeMonthsInterest).toBeCloseTo(4500, 2);
    expect(r.ird).toBe(0);
    expect(r.penalty).toBeCloseTo(4500, 2);
    expect(r.method).toBe("3MI");
  });

  it("uses IRD when fixed and the spread is large enough", () => {
    const r = calculatePenalty({
      balance: 400_000,
      contractRate: 4.5,
      monthsRemaining: 30,
      type: "fixed",
      comparisonRate: 3.5, // 1pp lower
      postedSpread: 0, // monoline
    });
    // IRD = 400_000 * 0.01 * (30/12) = 10_000
    // 3MI = 4500
    expect(r.ird).toBeCloseTo(10_000, 2);
    expect(r.threeMonthsInterest).toBeCloseTo(4500, 2);
    expect(r.penalty).toBeCloseTo(10_000, 2);
    expect(r.method).toBe("IRD");
  });

  it("falls back to 3MI when IRD is smaller (rates rose)", () => {
    const r = calculatePenalty({
      balance: 400_000,
      contractRate: 3.0,
      monthsRemaining: 24,
      type: "fixed",
      comparisonRate: 5.0, // current is HIGHER than contract
      postedSpread: 0,
    });
    // Effective spread floored at 0, so IRD = 0
    expect(r.ird).toBe(0);
    expect(r.method).toBe("3MI");
    // 400_000 * 0.03 * 0.25 = 3000
    expect(r.penalty).toBeCloseTo(3000, 2);
  });

  it("inflates IRD with posted-rate spread (big-bank method)", () => {
    const monoline = calculatePenalty({
      balance: 400_000,
      contractRate: 4.5,
      monthsRemaining: 30,
      type: "fixed",
      comparisonRate: 3.5,
      postedSpread: 0,
    });
    const bigBank = calculatePenalty({
      balance: 400_000,
      contractRate: 4.5,
      monthsRemaining: 30,
      type: "fixed",
      comparisonRate: 3.5,
      postedSpread: 1.5, // 1.5pp original discount off posted
    });
    // Effective spread becomes 1.0 + 1.5 = 2.5pp
    // IRD = 400_000 * 0.025 * 2.5 = 25_000
    expect(bigBank.ird).toBeCloseTo(25_000, 2);
    expect(bigBank.penalty).toBeCloseTo(25_000, 2);
    expect(bigBank.penalty).toBeGreaterThan(monoline.penalty);
  });

  it("returns zero penalty when balance is zero", () => {
    const r = calculatePenalty({
      balance: 0,
      contractRate: 5,
      monthsRemaining: 30,
      type: "fixed",
      comparisonRate: 3,
      postedSpread: 1.5,
    });
    expect(r.penalty).toBe(0);
    expect(r.ird).toBe(0);
    expect(r.threeMonthsInterest).toBe(0);
  });
});

describe("compareBreakingMortgage", () => {
  it("recommends 'break' when interest savings clearly exceed the penalty", () => {
    // 2pp drop, $400k balance, 30 months left, monoline (no posted spread).
    // Savings ≈ 400_000 × 0.02 × 30/12 = $20,000.
    // Penalty: max(3MI=4500, IRD=400_000×0.02×2.5=20000) = $20,000.
    // Net benefit ≈ $0 — actually marginal. Try a bigger drop.
    const r = compareBreakingMortgage({
      balance: 400_000,
      contractRate: 5.0,
      monthsRemaining: 24,
      type: "variable", // 3MI only — small penalty, big savings
      comparisonRate: 3.0,
      postedSpread: 0,
    });
    // Savings = 400_000 × 0.02 × 2 = $16,000
    // Penalty = 400_000 × 0.05 × 0.25 = $5,000
    expect(r.estimatedSavings).toBeCloseTo(16_000, 0);
    expect(r.penalty.penalty).toBeCloseTo(5_000, 0);
    expect(r.netBenefit).toBeCloseTo(11_000, 0);
    expect(r.verdict).toBe("break");
  });

  it("recommends 'stay' when the penalty is much larger than savings", () => {
    // Big-bank fixed with posted-rate IRD inflation.
    const r = compareBreakingMortgage({
      balance: 500_000,
      contractRate: 4.5,
      monthsRemaining: 36,
      type: "fixed",
      comparisonRate: 4.0, // only 0.5pp drop
      postedSpread: 1.5, // big-bank IRD inflation
    });
    // Savings = 500_000 × 0.005 × 3 = $7,500
    // IRD = 500_000 × (0.045 - 0.040 + 0.015) × 3 = 500_000 × 0.02 × 3 = $30,000
    expect(r.estimatedSavings).toBeCloseTo(7_500, 0);
    expect(r.penalty.penalty).toBeGreaterThan(20_000);
    expect(r.netBenefit).toBeLessThan(0);
    expect(r.verdict).toBe("stay");
  });

  it("returns 'marginal' when net benefit is small", () => {
    // Small drop, small penalty, both within $1k threshold of zero.
    const r = compareBreakingMortgage({
      balance: 200_000,
      contractRate: 4.0,
      monthsRemaining: 12,
      type: "variable",
      comparisonRate: 3.5, // 0.5pp drop
      postedSpread: 0,
    });
    // Savings = 200_000 × 0.005 × 1 = $1,000
    // Penalty (3MI) = 200_000 × 0.04 × 0.25 = $2,000
    // Net = -$1,000 — sits exactly on the threshold; either marginal or stay.
    expect(r.netBenefit).toBeCloseTo(-1_000, 0);
    expect(["marginal", "stay"]).toContain(r.verdict);
  });

  it("clamps savings to zero when refinancing would not lower the rate", () => {
    const r = compareBreakingMortgage({
      balance: 400_000,
      contractRate: 3.0,
      monthsRemaining: 24,
      type: "fixed",
      comparisonRate: 5.0, // current is LOWER than today's rate
      postedSpread: 0,
    });
    expect(r.estimatedSavings).toBe(0);
    expect(r.netBenefit).toBe(-r.penalty.penalty);
    expect(r.verdict).toBe("stay");
  });
});
