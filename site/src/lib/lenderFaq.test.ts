import { describe, expect, it } from "vitest";
import { buildLenderFaq } from "@lib/lenderFaq";
import { getLenderFacts } from "@lib/lenderFacts";
import type { Lender } from "@lib/rates";

const cibc: Lender = {
  slug: "cibc",
  name: "CIBC",
  type: "big6",
  source_url: "https://www.cibc.com/",
  affiliate_url: null,
  scraped_at: "2026-05-12",
  rates: [
    { term: "5yr_fixed", posted: 6.79, discounted: 4.89 },
    { term: "variable", posted: 6.45, discounted: 5.95 },
    { term: "3yr_fixed", posted: 6.59, discounted: 4.79 },
  ],
};

const servus: Lender = {
  slug: "servus",
  name: "Servus Credit Union",
  type: "credit_union",
  source_url: "https://www.servus.ca/",
  affiliate_url: null,
  scraped_at: "2026-05-12",
  rates: [{ term: "5yr_fixed", posted: 5.74, discounted: 4.79 }],
};

describe("buildLenderFaq", () => {
  it("includes 5-year fixed rate question with formatted percent when offered", () => {
    const facts = getLenderFacts("cibc");
    const items = buildLenderFaq(cibc, facts);
    const fiveYr = items.find((i) => i.q.includes("5-year fixed"));
    expect(fiveYr).toBeDefined();
    expect(fiveYr!.a).toContain("4.89%");
    expect(fiveYr!.a).toContain("6.79%");
  });

  it("answers the variable-rate question when a variable rate is published", () => {
    const items = buildLenderFaq(cibc, getLenderFacts("cibc"));
    const variable = items.find((i) => i.q.toLowerCase().includes("variable"));
    expect(variable).toBeDefined();
    expect(variable!.a.toLowerCase()).toContain("yes");
  });

  it("hedges the variable-rate question when no variable rate is published", () => {
    const items = buildLenderFaq(servus, getLenderFacts("servus"));
    const variable = items.find((i) => i.q.toLowerCase().includes("variable"));
    expect(variable).toBeDefined();
    expect(variable!.a.toLowerCase()).not.toContain("yes.");
  });

  it("calls Big 6 banks Big 6, and explicitly denies it for credit unions", () => {
    const big6 = buildLenderFaq(cibc, getLenderFacts("cibc"))
      .find((i) => i.q.toLowerCase().includes("big 6"))!;
    const cu = buildLenderFaq(servus, getLenderFacts("servus"))
      .find((i) => i.q.toLowerCase().includes("big 6"))!;
    expect(big6.a).toMatch(/Yes\./);
    expect(cu.a).toMatch(/No\./);
    expect(cu.a.toLowerCase()).toContain("credit union");
  });

  it("renders a prepayment example with a dollar figure on a $500k mortgage", () => {
    const items = buildLenderFaq(cibc, getLenderFacts("cibc"));
    const prep = items.find((i) => i.q.toLowerCase().includes("prepayment"))!;
    // CIBC: 10% lump = $50,000 on $500k
    expect(prep.a).toContain("50,000");
    expect(prep.a).toContain("10%");
  });

  it("skips the prepayment item when facts are unavailable", () => {
    const items = buildLenderFaq(cibc, null);
    expect(items.some((i) => i.q.toLowerCase().includes("prepayment"))).toBe(false);
  });
});
