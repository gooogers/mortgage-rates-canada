/**
 * Types and loader for the rates.json contract produced by the scraper.
 *
 * At build time we read either:
 *   - src/data/rates.json (populated by scripts/fetch-rates.mjs in production)
 *   - src/data/rates.sample.json (fallback for local dev when no rates.json exists)
 */
import sample from "../data/rates.sample.json";

export type Term =
  | "1yr_fixed"
  | "2yr_fixed"
  | "3yr_fixed"
  | "4yr_fixed"
  | "5yr_fixed"
  | "7yr_fixed"
  | "10yr_fixed"
  | "variable"
  | "heloc";

export type LenderType = "big6" | "monoline" | "credit_union";

export interface Rate {
  term: Term;
  posted: number;
  discounted: number | null;
}

export interface Lender {
  slug: string;
  name: string;
  type: LenderType;
  source_url: string;
  affiliate_url: string | null;
  scraped_at: string;
  rates: Rate[];
}

export interface DiscountFormula {
  fixed: number | null;
  variable: number | null;
  heloc: number | null;
}

export interface RatesData {
  updated_at: string;
  discount_formula: DiscountFormula;
  lenders: Lender[];
}

/**
 * Load rates data. Tries src/data/rates.json first; falls back to the sample.
 * Async to leave room for future build-time fetches without changing the API.
 */
export async function loadRatesData(): Promise<RatesData> {
  try {
    const real = await import("../data/rates.json");
    return real.default as RatesData;
  } catch {
    return sample as RatesData;
  }
}

export interface BestRate {
  lender: Lender;
  rate: Rate;
}

/** Return the lender + rate with the lowest `discounted` for the given term, or null. */
export function bestRateForTerm(data: RatesData, term: Term): BestRate | null {
  let best: BestRate | null = null;
  for (const lender of data.lenders) {
    for (const rate of lender.rates) {
      if (rate.term !== term) continue;
      if (rate.discounted === null || rate.discounted === undefined) continue;
      if (best === null || rate.discounted < best.rate.discounted!) {
        best = { lender, rate };
      }
    }
  }
  return best;
}

/** Return one (lender, rate) entry per lender for the given term, sorted by discounted ascending. */
export function ratesByTerm(data: RatesData, term: Term): BestRate[] {
  const entries: BestRate[] = [];
  for (const lender of data.lenders) {
    const rate = lender.rates.find((r) => r.term === term);
    if (rate) entries.push({ lender, rate });
  }
  entries.sort((a, b) => {
    const av = a.rate.discounted ?? Infinity;
    const bv = b.rate.discounted ?? Infinity;
    return av - bv;
  });
  return entries;
}
