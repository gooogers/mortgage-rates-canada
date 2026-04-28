import { describe, expect, it } from "vitest";
import { compareBreakEven, findBreakEvenRise } from "@lib/breakEven";

describe("compareBreakEven", () => {
  const base = {
    loanAmount: 500_000,
    amortizationYears: 25,
    fixedRate: 4.79,
    variableRate: 4.20,
    horizonMonths: 60,
  };

  it("variable wins when rates stay flat", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 0, rateChangeMonth: 0 });
    expect(r.winner).toBe("variable");
    expect(r.savingsAmount).toBeGreaterThan(0);
    expect(r.variableTotalInterest).toBeLessThan(r.fixedTotalInterest);
  });

  it("fixed wins when variable rises sharply early", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 2.0, rateChangeMonth: 1 });
    expect(r.winner).toBe("fixed");
    expect(r.fixedTotalInterest).toBeLessThan(r.variableTotalInterest);
  });

  it("rounds payment values consistently", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 0, rateChangeMonth: 0 });
    expect(r.fixedPayment).toBeGreaterThan(0);
    expect(r.variableInitialPayment).toBeGreaterThan(0);
    expect(r.variablePostChangePayment).toEqual(r.variableInitialPayment);
  });

  it("post-change payment reflects new rate", () => {
    const r = compareBreakEven({ ...base, rateChangePct: 1.0, rateChangeMonth: 12 });
    expect(r.variablePostChangePayment).toBeGreaterThan(r.variableInitialPayment);
  });

  it("zero loan returns zero interest", () => {
    const r = compareBreakEven({ ...base, loanAmount: 0, rateChangePct: 0, rateChangeMonth: 0 });
    expect(r.fixedTotalInterest).toBe(0);
    expect(r.variableTotalInterest).toBe(0);
  });
});

describe("findBreakEvenRise", () => {
  const base = {
    loanAmount: 500_000,
    amortizationYears: 25,
    fixedRate: 4.79,
    variableRate: 4.20,
    horizonMonths: 60,
    rateChangeMonth: 12,
  };

  it("finds a positive break-even when fixed > variable", () => {
    const rise = findBreakEvenRise(base);
    expect(rise).toBeGreaterThan(0);
    expect(rise).toBeLessThan(5);
  });

  it("returns 0 when fixed already <= variable", () => {
    const rise = findBreakEvenRise({ ...base, fixedRate: 3.0, variableRate: 4.0 });
    expect(rise).toBe(0);
  });
});
