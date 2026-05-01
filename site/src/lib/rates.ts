/**
 * Types and loader for the rates.json contract produced by the scraper.
 *
 * At build time we read either:
 *   - src/data/rates.json (populated by scripts/fetch-rates.mjs in production)
 *   - src/data/rates.sample.json (fallback for local dev when no rates.json exists)
 *
 * Manually-maintained lender entries from src/data/manual-rates.yaml are
 * merged in after the scraped data, for lenders that don't yet have an
 * automated scraper (currently: provincial credit unions).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
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

/** ISO 3166-2 subdivision code (e.g. "ON", "QC"). */
export type Province =
  | "AB"
  | "BC"
  | "MB"
  | "NB"
  | "NL"
  | "NS"
  | "NT"
  | "NU"
  | "ON"
  | "PE"
  | "QC"
  | "SK"
  | "YT";

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
  /**
   * Provinces where this lender operates. Omit (or empty array) for national
   * lenders that should appear regardless of selected province.
   */
  provinces?: Province[];
}

export interface RatesData {
  updated_at: string;
  lenders: Lender[];
}

interface ManualLenderEntry {
  name: string;
  type: LenderType;
  source_url: string;
  affiliate_url: string | null;
  provinces?: Province[];
  last_verified: string;
  rates: Rate[];
}

interface ManualRatesFile {
  lenders: Record<string, ManualLenderEntry>;
}

let manualCache: Lender[] | null = null;

function loadManualLenders(): Lender[] {
  if (manualCache) return manualCache;
  try {
    const path = resolve(process.cwd(), "src/data/manual-rates.yaml");
    const raw = readFileSync(path, "utf8");
    const parsed = yaml.load(raw) as ManualRatesFile;
    manualCache = Object.entries(parsed.lenders ?? {}).map(([slug, entry]) => ({
      slug,
      name: entry.name,
      type: entry.type,
      source_url: entry.source_url,
      affiliate_url: entry.affiliate_url,
      scraped_at: entry.last_verified,
      rates: entry.rates,
      provinces: entry.provinces,
    }));
  } catch {
    manualCache = [];
  }
  return manualCache;
}

/**
 * Load rates data. Tries src/data/rates.json first; falls back to the sample.
 * Manual entries from manual-rates.yaml are appended in either path.
 * Async to leave room for future build-time fetches without changing the API.
 */
export async function loadRatesData(): Promise<RatesData> {
  let base: RatesData;
  try {
    const real = await import("../data/rates.json");
    base = real.default as RatesData;
  } catch {
    base = sample as RatesData;
  }
  const manual = loadManualLenders();
  if (manual.length === 0) return base;
  // De-duplicate: scraper output wins if a slug exists in both.
  const scrapedSlugs = new Set(base.lenders.map((l) => l.slug));
  const merged = [
    ...base.lenders,
    ...manual.filter((l) => !scrapedSlugs.has(l.slug)),
  ];
  return { ...base, lenders: merged };
}

export interface BestRate {
  lender: Lender;
  rate: Rate;
}

/** Return the lender + rate with the lowest effective rate for the given term, or null.
 *  Effective rate = discounted ?? posted (so we still rank when bank doesn't publish a special). */
export function bestRateForTerm(
  data: RatesData,
  term: Term,
): BestRate | null {
  let best: BestRate | null = null;
  let bestRate = Infinity;
  for (const lender of data.lenders) {
    const rate = lender.rates.find((r) => r.term === term);
    if (!rate) continue;
    const effective = rate.discounted ?? rate.posted;
    if (effective < bestRate) {
      bestRate = effective;
      best = { lender, rate };
    }
  }
  return best;
}

/**
 * Best rate within a province scope. `province === ""` means "national lenders
 * only" — the All-Canada view. A province code includes national lenders plus
 * any provincial lender available there. Mirrors the visibility rules
 * RateTable applies to its rows and HeroFeaturedRates uses for its cards.
 */
export function bestRateForTermInScope(
  data: RatesData,
  term: Term,
  province: string,
): BestRate | null {
  let best: BestRate | null = null;
  let bestRate = Infinity;
  for (const lender of data.lenders) {
    const provs = lender.provinces ?? [];
    const isNational = provs.length === 0;
    const matches = isNational || (province !== "" && provs.includes(province as Province));
    if (!matches) continue;
    const rate = lender.rates.find((r) => r.term === term);
    if (!rate) continue;
    const effective = rate.discounted ?? rate.posted;
    if (effective < bestRate) {
      bestRate = effective;
      best = { lender, rate };
    }
  }
  return best;
}

/** Lenders visible in a given province scope (national + provincial that operate there). */
export function lendersInScope(data: RatesData, province: string): Lender[] {
  if (province === "") {
    return data.lenders.filter((l) => (l.provinces ?? []).length === 0);
  }
  return data.lenders.filter((l) => {
    const provs = l.provinces ?? [];
    return provs.length === 0 || provs.includes(province as Province);
  });
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
