import { describe, expect, it } from "vitest";
import { calculatePenalty } from "@lib/penalty";

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
