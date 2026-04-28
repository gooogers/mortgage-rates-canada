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
    const r = compareBreakEven({ ...base, variableRateTargetChange: 0, paceMonths: 0 });
    expect(r.winner).toBe("variable");
    expect(r.savingsAmount).toBeGreaterThan(0);
    expect(r.variableTotalInterest).toBeLessThan(r.fixedTotalInterest);
  });

  it("fixed wins when variable rises sharply and immediately", () => {
    const r = compareBreakEven({ ...base, variableRateTargetChange: 2.0, paceMonths: 0 });
    expect(r.winner).toBe("fixed");
    expect(r.fixedTotalInterest).toBeLessThan(r.variableTotalInterest);
  });

  it("ending payment reflects new rate after a rise", () => {
    const r = compareBreakEven({ ...base, variableRateTargetChange: 1.0, paceMonths: 12 });
    expect(r.variableEndingPayment).toBeGreaterThan(r.variableInitialPayment);
  });

  it("ending payment equals initial when target change is zero", () => {
    const r = compareBreakEven({ ...base, variableRateTargetChange: 0, paceMonths: 0 });
    expect(r.variableEndingPayment).toEqual(r.variableInitialPayment);
  });

  it("gradual rise costs less interest than the same rise applied immediately", () => {
    const gradual = compareBreakEven({ ...base, variableRateTargetChange: 1.5, paceMonths: 24 });
    const immediate = compareBreakEven({ ...base, variableRateTargetChange: 1.5, paceMonths: 0 });
    expect(gradual.variableTotalInterest).toBeLessThan(immediate.variableTotalInterest);
  });

  it("gradual cuts save more than immediate cuts only at the start", () => {
    const gradualCut = compareBreakEven({ ...base, variableRateTargetChange: -1.0, paceMonths: 24 });
    const immediateCut = compareBreakEven({ ...base, variableRateTargetChange: -1.0, paceMonths: 0 });
    // Immediate cut means variable is lower for longer — saves more interest overall.
    expect(immediateCut.variableTotalInterest).toBeLessThan(gradualCut.variableTotalInterest);
  });

  it("zero loan returns zero interest", () => {
    const r = compareBreakEven({ ...base, loanAmount: 0, variableRateTargetChange: 0, paceMonths: 0 });
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
