/**
 * Daily rate-history time series.
 *
 * Each snapshot captures the best and average DISCOUNTED rate for each term
 * across the lenders we tracked that day. We aggregate at write-time
 * (scripts/snapshot-rates.mjs) rather than storing the full lender list per
 * day — keeps the history file lean and ensures a single line per (date, term)
 * for clean chart rendering.
 *
 * Build-time loaded only. The dynamic import falls back to an empty time
 * series so a fresh checkout (no snapshots yet) renders gracefully.
 */
import type { Term } from "@lib/rates";

export interface SnapshotTermAggregate {
  /** Lowest discounted rate offered across tracked lenders that day. */
  best_discounted: number;
  /** Mean of discounted rates across lenders that offered this term. */
  average_discounted: number;
  /** Number of lenders contributing to the aggregate. */
  lender_count: number;
}

export interface RateSnapshot {
  /** ISO date (YYYY-MM-DD). One snapshot per day. */
  date: string;
  terms: Partial<Record<Term, SnapshotTermAggregate>>;
}

export interface RateHistory {
  snapshots: RateSnapshot[];
}

const EMPTY: RateHistory = { snapshots: [] };

export async function loadRateHistory(): Promise<RateHistory> {
  try {
    const real = await import("../data/rates-history.json");
    const data = real.default as RateHistory;
    if (!data || !Array.isArray(data.snapshots)) return EMPTY;
    // Ensure chronological order; the writer sorts but we don't trust it.
    const snapshots = [...data.snapshots].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    return { snapshots };
  } catch {
    return EMPTY;
  }
}

export interface HistoryPoint {
  date: string;
  best: number;
  average: number;
}

/**
 * Series of daily best+average for a single term, oldest → newest.
 * Days where the term wasn't tracked are skipped, not interpolated, so
 * sparse history stays honest.
 */
export function seriesForTerm(history: RateHistory, term: Term): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const snap of history.snapshots) {
    const t = snap.terms[term];
    if (!t) continue;
    out.push({ date: snap.date, best: t.best_discounted, average: t.average_discounted });
  }
  return out;
}

/**
 * Turn a daily snapshot of full rate data into a single-day history entry.
 * Pure function so we can unit-test the aggregation logic without disk I/O.
 */
export function buildSnapshotFromRates(
  date: string,
  lenders: Array<{ rates: Array<{ term: Term; discounted: number | null; posted: number }> }>,
): RateSnapshot {
  const terms: Partial<Record<Term, SnapshotTermAggregate>> = {};
  // Group discounted rates by term.
  const byTerm = new Map<Term, number[]>();
  for (const lender of lenders) {
    for (const rate of lender.rates) {
      const effective = rate.discounted ?? rate.posted;
      if (typeof effective !== "number" || Number.isNaN(effective)) continue;
      const arr = byTerm.get(rate.term) ?? [];
      arr.push(effective);
      byTerm.set(rate.term, arr);
    }
  }
  for (const [term, arr] of byTerm) {
    const best = Math.min(...arr);
    const sum = arr.reduce((a, b) => a + b, 0);
    const avg = sum / arr.length;
    terms[term] = {
      best_discounted: round2(best),
      average_discounted: round2(avg),
      lender_count: arr.length,
    };
  }
  return { date, terms };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
