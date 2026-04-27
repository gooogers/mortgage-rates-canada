import { describe, expect, it } from "vitest";
import {
  bestRateForTerm,
  loadRatesData,
  ratesByTerm,
  type Term,
} from "@lib/rates";

describe("loadRatesData", () => {
  it("loads and parses the sample rates file", async () => {
    const data = await loadRatesData();
    expect(data.lenders.length).toBeGreaterThan(0);
    expect(data.discount_formula.fixed).toBe(1.5);
    expect(data.lenders[0].slug).toBe("rbc");
  });
});

describe("bestRateForTerm", () => {
  it("returns the lender with the lowest discounted rate for a term", async () => {
    const data = await loadRatesData();
    const best = bestRateForTerm(data, "5yr_fixed");
    expect(best).not.toBeNull();
    expect(best!.lender.slug).toBeDefined();
    expect(best!.rate.term).toBe("5yr_fixed");
    // Sample's lowest 5yr discounted = 3.94 (Tangerine)
    expect(best!.rate.discounted).toBe(3.94);
  });

  it("returns null when no lender offers that term", async () => {
    const data = await loadRatesData();
    const best = bestRateForTerm(data, "heloc");
    expect(best).toBeNull();
  });

  it("falls back to posted when discounted=null, using effective rate", async () => {
    const data = {
      ...(await loadRatesData()),
      lenders: [
        {
          slug: "x",
          name: "X",
          type: "big6" as const,
          source_url: "",
          affiliate_url: null,
          scraped_at: "2026-04-25T10:00:00Z",
          rates: [{ term: "heloc" as Term, posted: 7.2, discounted: null }],
        },
      ],
    };
    const best = bestRateForTerm(data, "heloc");
    expect(best).not.toBeNull();
    expect(best!.rate.term).toBe("heloc");
    expect(best!.rate.posted).toBe(7.2);
  });
});

describe("ratesByTerm", () => {
  it("returns one entry per lender for the given term, sorted by discounted asc", async () => {
    const data = await loadRatesData();
    const entries = ratesByTerm(data, "5yr_fixed");
    expect(entries.length).toBe(data.lenders.length);
    // Sorted ascending by discounted
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1].rate.discounted ?? Infinity;
      const cur = entries[i].rate.discounted ?? Infinity;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });

  it("omits lenders that don't offer the requested term", async () => {
    const data = await loadRatesData();
    const entries = ratesByTerm(data, "heloc");
    expect(entries.length).toBe(0);
  });
});
