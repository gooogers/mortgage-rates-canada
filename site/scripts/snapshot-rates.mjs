#!/usr/bin/env node
/**
 * Append today's aggregated snapshot to rates-history.json.
 *
 * Reads src/data/rates.json (the current daily snapshot from the scraper)
 * and writes a single-day aggregate (best + average discounted per term)
 * into src/data/rates-history.json.
 *
 * Idempotent: if today's date is already recorded, the existing entry is
 * replaced. Sorts the resulting file chronologically.
 *
 * Designed to run once per day from CI alongside the scraper, or manually
 * to bootstrap.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "src", "data");
const RATES_PATH = resolve(DATA_DIR, "rates.json");
const HISTORY_PATH = resolve(DATA_DIR, "rates-history.json");

function round2(v) {
  return Math.round(v * 100) / 100;
}

function buildSnapshot(date, lenders) {
  const byTerm = new Map();
  for (const lender of lenders) {
    for (const rate of lender.rates ?? []) {
      const effective = rate.discounted ?? rate.posted;
      if (typeof effective !== "number" || Number.isNaN(effective)) continue;
      const arr = byTerm.get(rate.term) ?? [];
      arr.push(effective);
      byTerm.set(rate.term, arr);
    }
  }
  const terms = {};
  for (const [term, arr] of byTerm) {
    const best = Math.min(...arr);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    terms[term] = {
      best_discounted: round2(best),
      average_discounted: round2(avg),
      lender_count: arr.length,
    };
  }
  return { date, terms };
}

async function main() {
  if (!existsSync(RATES_PATH)) {
    console.error(`[snapshot-rates] no rates.json at ${RATES_PATH}; run fetch-rates first`);
    process.exit(1);
  }

  const ratesText = await readFile(RATES_PATH, "utf8");
  const rates = JSON.parse(ratesText);
  const lenders = rates.lenders ?? [];

  // Prefer the YYYY-MM-DD of rates.updated_at so reruns the same calendar
  // day produce the same key, even across timezones.
  const updatedAt = rates.updated_at ? new Date(rates.updated_at) : new Date();
  const date = updatedAt.toISOString().slice(0, 10);

  const snapshot = buildSnapshot(date, lenders);

  let history = { snapshots: [] };
  if (existsSync(HISTORY_PATH)) {
    try {
      history = JSON.parse(await readFile(HISTORY_PATH, "utf8"));
      if (!Array.isArray(history.snapshots)) history.snapshots = [];
    } catch (err) {
      console.warn(`[snapshot-rates] could not parse existing history (${err.message}); starting fresh`);
      history = { snapshots: [] };
    }
  }

  // Replace or append today's entry, then sort.
  const others = history.snapshots.filter((s) => s.date !== date);
  others.push(snapshot);
  others.sort((a, b) => a.date.localeCompare(b.date));
  history.snapshots = others;

  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n", "utf8");
  const termsCount = Object.keys(snapshot.terms).length;
  console.log(
    `[snapshot-rates] wrote ${date} (${termsCount} terms, ${lenders.length} lenders) — total snapshots: ${history.snapshots.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
