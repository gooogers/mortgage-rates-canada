import { describe, expect, it } from "vitest";
import { getLenderFacts, renderLenderIntro } from "@lib/lenderFacts";

describe("getLenderFacts", () => {
  it("returns facts for known lender", () => {
    const facts = getLenderFacts("rbc");
    expect(facts).not.toBeNull();
    expect(facts!.full_name).toBe("Royal Bank of Canada");
    expect(facts!.founded_year).toBe(1864);
  });

  it("returns null for unknown lender", () => {
    expect(getLenderFacts("not-a-lender")).toBeNull();
  });
});

describe("renderLenderIntro", () => {
  it("includes founded year and regulator in prose", () => {
    const facts = getLenderFacts("rbc")!;
    const intro = renderLenderIntro(facts);
    expect(intro).toContain("1864");
    expect(intro).toContain("OSFI");
    expect(intro.length).toBeGreaterThan(80);
    expect(intro.length).toBeLessThan(800);
  });
});
