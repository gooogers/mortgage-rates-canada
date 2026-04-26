/**
 * Display-formatting helpers. Pure functions, no side effects.
 */

const TERM_LABELS: Record<string, string> = {
  "1yr_fixed": "1-Year Fixed",
  "2yr_fixed": "2-Year Fixed",
  "3yr_fixed": "3-Year Fixed",
  "4yr_fixed": "4-Year Fixed",
  "5yr_fixed": "5-Year Fixed",
  "7yr_fixed": "7-Year Fixed",
  "10yr_fixed": "10-Year Fixed",
  variable: "Variable",
  heloc: "HELOC",
};

export function formatCurrency(
  value: number,
  options: { cents?: boolean } = {},
): string {
  const fractionDigits = options.cents ? 2 : 0;
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    currencyDisplay: "narrowSymbol",
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toFixed(2)}%`;
}

export function formatTermLabel(term: string): string {
  return TERM_LABELS[term] ?? term;
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
