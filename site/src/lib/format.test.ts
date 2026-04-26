import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatTermLabel,
  formatUpdatedAt,
} from "@lib/format";

describe("formatCurrency", () => {
  it("formats whole dollars with $ and thousands separator", () => {
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("rounds to whole dollars by default", () => {
    expect(formatCurrency(1234.56)).toBe("$1,235");
  });

  it("supports a 2-decimal cents mode", () => {
    expect(formatCurrency(1234.56, { cents: true })).toBe("$1,234.56");
  });
});

describe("formatPercent", () => {
  it("formats with two decimals and a percent sign", () => {
    expect(formatPercent(5.69)).toBe("5.69%");
  });

  it("formats integer values with two decimals", () => {
    expect(formatPercent(5)).toBe("5.00%");
  });

  it("returns an em-dash for null", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatTermLabel", () => {
  it("formats yearly terms as 'N-Year Fixed'", () => {
    expect(formatTermLabel("5yr_fixed")).toBe("5-Year Fixed");
    expect(formatTermLabel("10yr_fixed")).toBe("10-Year Fixed");
  });

  it("formats variable as 'Variable'", () => {
    expect(formatTermLabel("variable")).toBe("Variable");
  });

  it("formats heloc as 'HELOC'", () => {
    expect(formatTermLabel("heloc")).toBe("HELOC");
  });
});

describe("formatUpdatedAt", () => {
  it("formats an ISO timestamp as a human-friendly date", () => {
    expect(formatUpdatedAt("2026-04-25T10:00:00Z")).toMatch(
      /April 25, 2026/,
    );
  });
});
