import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";

export interface LenderFacts {
  full_name: string;
  short_name: string;
  founded_year: number;
  regulator: string;
  channels: ("branch" | "broker" | "online")[];
  prepayment: {
    lump_sum_pct: number;
    payment_increase_pct: number;
  };
  notable_quirks: string[];
  last_verified_at: string;
}

interface LendersFile {
  lenders: Record<string, LenderFacts>;
}

const yamlPath = resolve(process.cwd(), "src/data/lenders.yaml");

let cache: LendersFile | null = null;

function load(): LendersFile {
  if (cache) return cache;
  const raw = readFileSync(yamlPath, "utf8");
  cache = yaml.load(raw) as LendersFile;
  return cache;
}

export function getLenderFacts(slug: string): LenderFacts | null {
  return load().lenders[slug] ?? null;
}

export function renderLenderIntro(facts: LenderFacts): string {
  const channelList = facts.channels.join(", ");
  return [
    `${facts.full_name} (${facts.short_name}) was founded in ${facts.founded_year} and is regulated by ${facts.regulator}.`,
    `Mortgages are originated through ${channelList} channels.`,
    `Standard prepayment privileges allow up to ${facts.prepayment.lump_sum_pct}% annual lump sum and up to ${facts.prepayment.payment_increase_pct}% payment increase per year.`,
  ].join(" ");
}
