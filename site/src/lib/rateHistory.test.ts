import { describe, expect, it } from "vitest";
import {
  buildSnapshotFromRates,
  seriesForTerm,
  type RateHistory,
} from "@lib/rateHistory";

describe("buildSnapshotFromRates", () => {
  it("aggregates best and average discounted per term", () => {
    const snap = buildSnapshotFromRates("2026-05-01", [
      {
        rates: [
          { term: "5yr_fixed", posted: 6.09, discounted: 4.59 },
          { term: "variable", posted: 5.45, discounted: 4.45 },
        ],
      },
      {
        rates: [
          { term: "5yr_fixed", posted: 5.59, discounted: 3.94 },
          { term: "variable", posted: 4.45, discounted: 3.45 },
        ],
      },
    ]);
    const fiveYr = snap.terms["5yr_fixed"]!;
    expect(fiveYr.best_discounted).toBe(3.94);
    expect(fiveYr.average_discounted).toBeCloseTo(4.27, 1); // (4.59+3.94)/2
    expect(fiveYr.lender_count).toBe(2);
    const variable = snap.terms["variable"]!;
    expect(variable.best_discounted).toBe(3.45);
    expect(variable.average_discounted).toBeCloseTo(3.95, 2);
    expect(variable.lender_count).toBe(2);
  });

  it("falls back to posted when discounted is null", () => {
    const snap = buildSnapshotFromRates("2026-05-01", [
      {
        rates: [{ term: "heloc", posted: 7.20, discounted: null }],
      },
    ]);
    expect(snap.terms["heloc"]).toEqual({
      best_discounted: 7.20,
      average_discounted: 7.20,
      lender_count: 1,
    });
  });

  it("ignores terms with no contributing lenders", () => {
    const snap = buildSnapshotFromRates("2026-05-01", []);
    expect(snap.terms).toEqual({});
  });
});

describe("seriesForTerm", () => {
  const history: RateHistory = {
    snapshots: [
      {
        date: "2026-04-01",
        terms: {
          "5yr_fixed": { best_discounted: 4.20, average_discounted: 4.50, lender_count: 5 },
        },
      },
      {
        date: "2026-04-15",
        terms: {
          "5yr_fixed": { best_discounted: 4.10, average_discounted: 4.40, lender_count: 5 },
          variable: { best_discounted: 3.80, average_discounted: 4.10, lender_count: 5 },
        },
      },
      {
        date: "2026-05-01",
        terms: {
          variable: { best_discounted: 3.50, average_discounted: 3.90, lender_count: 5 },
        },
      },
    ],
  };

  it("returns points for the requested term in order, skipping missing days", () => {
    const series = seriesForTerm(history, "5yr_fixed");
    expect(series).toHaveLength(2);
    expect(series.map((p) => p.date)).toEqual(["2026-04-01", "2026-04-15"]);
    expect(series[1].best).toBe(4.10);
  });

  it("returns empty array when the term has no history", () => {
    expect(seriesForTerm(history, "10yr_fixed")).toEqual([]);
  });
});
