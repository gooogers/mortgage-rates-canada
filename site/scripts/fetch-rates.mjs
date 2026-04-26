#!/usr/bin/env node
/**
 * Prebuild step: ensure src/data/rates.json is populated for the build.
 *
 * In production (set up in deploy plan 3), this fetches the latest rates.json
 * from the `data` branch via raw.githubusercontent.com and writes it to
 * src/data/rates.json (which is gitignored).
 *
 * In local dev or CI without DATA_BRANCH_URL set, it copies rates.sample.json
 * to rates.json so the dynamic import in lib/rates.ts can be resolved by
 * Rollup at build time.
 */
import { copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "src", "data");
const RATES_PATH = resolve(DATA_DIR, "rates.json");
const SAMPLE_PATH = resolve(DATA_DIR, "rates.sample.json");
const RATES_URL = process.env.DATA_BRANCH_URL;

async function main() {
  if (RATES_URL) {
    console.log(`[fetch-rates] fetching ${RATES_URL} ...`);
    const response = await fetch(RATES_URL);
    if (!response.ok) {
      throw new Error(`fetch-rates: HTTP ${response.status} for ${RATES_URL}`);
    }
    const text = await response.text();
    // Quick sanity check: must be valid JSON with a `lenders` array.
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.lenders)) {
      throw new Error(`fetch-rates: response missing 'lenders' array`);
    }
    await writeFile(RATES_PATH, text, "utf8");
    console.log(`[fetch-rates] wrote ${text.length} bytes to ${RATES_PATH}`);
    return;
  }

  if (existsSync(RATES_PATH)) {
    console.log(`[fetch-rates] using existing ${RATES_PATH}`);
    return;
  }

  // Bootstrap fallback: copy the sample so the dynamic import resolves.
  console.log(
    `[fetch-rates] DATA_BRANCH_URL not set and no rates.json present — copying rates.sample.json as fallback`,
  );
  await copyFile(SAMPLE_PATH, RATES_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
