import { describe, expect, it } from "vitest";
import { calculateClosingCosts } from "@lib/closingCosts";

describe("calculateClosingCosts — Ontario", () => {
  it("computes provincial LTT for a $1M Toronto home plus MLTT", () => {
    const r = calculateClosingCosts({
      price: 1_000_000,
      province: "ON",
      city: "toronto",
      firstTimeBuyer: false,
    });
    // Provincial brackets: 0.5%×55k + 1%×195k + 1.5%×150k + 2%×600k
    // = 275 + 1950 + 2250 + 12000 = 16,475
    expect(r.ltt.provincial).toBeCloseTo(16_475, 0);
    expect(r.ltt.municipal).toBeCloseTo(16_475, 0);
    expect(r.ltt.fthbRebate).toBe(0);
    expect(r.ltt.net).toBeCloseTo(32_950, 0);
  });

  it("applies the FTHB rebate (provincial $4k + Toronto MLTT $4,475) on a $400k Toronto home", () => {
    const r = calculateClosingCosts({
      price: 400_000,
      province: "ON",
      city: "toronto",
      firstTimeBuyer: true,
    });
    // Provincial = 0.5%×55k + 1%×195k + 1.5%×150k = 4475
    // Capped rebate provincial = $4,000; Toronto MLTT $4,475 (full).
    expect(r.ltt.provincial).toBeCloseTo(4_475, 0);
    expect(r.ltt.municipal).toBeCloseTo(4_475, 0);
    expect(r.ltt.fthbRebate).toBeCloseTo(8_475, 0);
    expect(r.ltt.net).toBeCloseTo(475, 0);
  });

  it("does not charge MLTT outside Toronto", () => {
    const r = calculateClosingCosts({
      price: 600_000,
      province: "ON",
      city: "ottawa",
      firstTimeBuyer: false,
    });
    expect(r.ltt.municipal).toBe(0);
  });
});

describe("calculateClosingCosts — BC", () => {
  it("computes the standard PTT on a $1M home", () => {
    const r = calculateClosingCosts({
      price: 1_000_000,
      province: "BC",
      firstTimeBuyer: false,
    });
    // 1%×200k + 2%×800k = 2000 + 16000 = 18,000
    expect(r.ltt.provincial).toBeCloseTo(18_000, 0);
  });

  it("fully exempts a $400k resale for first-time buyers", () => {
    const r = calculateClosingCosts({
      price: 400_000,
      province: "BC",
      firstTimeBuyer: true,
    });
    // Full exemption to $500k. Provincial = 1%×200k + 2%×200k = 6000.
    expect(r.ltt.provincial).toBeCloseTo(6_000, 0);
    expect(r.ltt.fthbRebate).toBeCloseTo(6_000, 0);
    expect(r.ltt.net).toBeCloseTo(0, 0);
  });

  it("partially exempts a $700k resale for first-time buyers", () => {
    const r = calculateClosingCosts({
      price: 700_000,
      province: "BC",
      firstTimeBuyer: true,
    });
    // Phase-out between $500k and $835k, so partial rebate.
    expect(r.ltt.fthbRebate).toBeGreaterThan(0);
    expect(r.ltt.fthbRebate).toBeLessThan(r.ltt.provincial);
  });

  it("denies any rebate above the phase-out cap", () => {
    const r = calculateClosingCosts({
      price: 900_000,
      province: "BC",
      firstTimeBuyer: true,
    });
    expect(r.ltt.fthbRebate).toBe(0);
  });

  it("uses the new-build exemption schedule when newBuild is set", () => {
    const r = calculateClosingCosts({
      price: 1_000_000,
      province: "BC",
      firstTimeBuyer: true,
      newBuild: true,
    });
    expect(r.ltt.fthbRebate).toBeGreaterThan(0);
  });
});

describe("calculateClosingCosts — no-LTT provinces", () => {
  it("Alberta charges only registration fees, not LTT", () => {
    const r = calculateClosingCosts({
      price: 500_000,
      province: "AB",
      firstTimeBuyer: false,
    });
    // 50 + ceil(500000/5000)*2 = 50 + 200 = 250
    expect(r.ltt.provincial).toBe(250);
    expect(r.ltt.municipal).toBe(0);
  });

  it("Saskatchewan also charges only registration fees", () => {
    const r = calculateClosingCosts({
      price: 400_000,
      province: "SK",
      firstTimeBuyer: false,
    });
    expect(r.ltt.provincial).toBeLessThan(500);
  });
});

describe("calculateClosingCosts — flat-rate provinces", () => {
  it("New Brunswick charges flat 1%", () => {
    const r = calculateClosingCosts({
      price: 300_000,
      province: "NB",
      firstTimeBuyer: false,
    });
    expect(r.ltt.provincial).toBeCloseTo(3_000, 0);
  });

  it("PEI fully exempts first-time buyers from the 1% RPTT", () => {
    const r = calculateClosingCosts({
      price: 300_000,
      province: "PE",
      firstTimeBuyer: true,
    });
    expect(r.ltt.provincial).toBeCloseTo(3_000, 0);
    expect(r.ltt.fthbRebate).toBeCloseTo(3_000, 0);
    expect(r.ltt.net).toBe(0);
  });
});

describe("calculateClosingCosts — Quebec", () => {
  it("computes the welcome tax on a $500k home", () => {
    const r = calculateClosingCosts({
      price: 500_000,
      province: "QC",
      firstTimeBuyer: false,
    });
    // 0.5%×58.9k + 1%×235.7k + 1.5%×205.4k = 294.5 + 2357 + 3081 = 5,732.50
    expect(r.ltt.provincial).toBeCloseTo(5_732.5, 0);
  });

  it("Montreal applies higher upper brackets above $1.1M", () => {
    const standard = calculateClosingCosts({
      price: 2_500_000,
      province: "QC",
      firstTimeBuyer: false,
    });
    const montreal = calculateClosingCosts({
      price: 2_500_000,
      province: "QC",
      city: "montreal",
      firstTimeBuyer: false,
    });
    expect(montreal.ltt.provincial).toBeGreaterThan(standard.ltt.provincial);
  });
});

describe("calculateClosingCosts — totals and overrides", () => {
  it("includes default legal/title/inspection fees in the total", () => {
    const r = calculateClosingCosts({
      price: 500_000,
      province: "AB",
      firstTimeBuyer: false,
    });
    expect(r.legalFees).toBe(1500);
    expect(r.titleInsurance).toBe(250);
    expect(r.inspection).toBe(500);
    expect(r.total).toBeCloseTo(r.ltt.net + 1500 + 250 + 500, 1);
  });

  it("respects user overrides for fees", () => {
    const r = calculateClosingCosts({
      price: 500_000,
      province: "AB",
      firstTimeBuyer: false,
      legalFees: 2000,
      titleInsurance: 0,
      inspection: 0,
    });
    expect(r.legalFees).toBe(2000);
    expect(r.titleInsurance).toBe(0);
    expect(r.inspection).toBe(0);
  });
});
