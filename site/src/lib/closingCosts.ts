/**
 * Canadian closing-cost math.
 *
 * Computes land transfer tax (LTT) by province, municipal LTT add-ons in
 * cities that levy them (Toronto MLTT, Halifax HRM, Montreal), first-time
 * home buyer rebates, and the standard third-party closing fees (legal,
 * title insurance, inspection).
 *
 * Pure functions, browser- and test-safe. Provincial bracket schedules are
 * encoded as breakpoint arrays so they're auditable.
 *
 * Sources are provincial revenue ministries; figures are 2026. Edge cases
 * (foreign-buyer surcharges, NRST, BC speculation tax) are out of scope —
 * surface them in the prose guide instead.
 */
import type { Province } from "@lib/rates";

export interface ClosingCostsInput {
  /** Purchase price in dollars. */
  price: number;
  province: Province;
  /** Optional city slug for municipal add-ons. Recognised: "toronto",
   *  "halifax", "montreal". Other values fall back to provincial only. */
  city?: string;
  /** First-time home buyer (affects BC/ON/PE rebates). */
  firstTimeBuyer: boolean;
  /** New construction (BC has a separate exemption tier). */
  newBuild?: boolean;
  /** Override default legal fees (default $1,500). */
  legalFees?: number;
  /** Override default title insurance (default $250). */
  titleInsurance?: number;
  /** Override default home inspection (default $500). */
  inspection?: number;
}

export interface LttBreakdown {
  /** Provincial / territorial LTT before any rebate. */
  provincial: number;
  /** Municipal LTT (Toronto, etc.). 0 if none. */
  municipal: number;
  /** First-time buyer rebate (provincial + municipal combined). Negative
   *  in the sense of "subtracted from gross LTT"; reported as positive. */
  fthbRebate: number;
  /** Net LTT actually owed = provincial + municipal − fthbRebate (≥ 0). */
  net: number;
}

export interface ClosingCostsResult {
  ltt: LttBreakdown;
  legalFees: number;
  titleInsurance: number;
  inspection: number;
  /** Sum of net LTT + all fees. */
  total: number;
}

interface Bracket {
  /** Upper bound of this bracket; null = no upper bound. */
  upTo: number | null;
  rate: number; // marginal rate, e.g. 0.005 = 0.5%
}

/** Apply a marginal-bracket schedule to a value. */
function applyBrackets(value: number, brackets: Bracket[]): number {
  let prev = 0;
  let tax = 0;
  for (const b of brackets) {
    const top = b.upTo ?? Infinity;
    if (value <= prev) break;
    const slice = Math.min(value, top) - prev;
    tax += slice * b.rate;
    prev = top;
    if (value <= top) break;
  }
  return tax;
}

// --- Provincial schedules -------------------------------------------------

// Ontario LTT (provincial). Toronto MLTT uses the same schedule.
const ON_BRACKETS: Bracket[] = [
  { upTo: 55_000, rate: 0.005 },
  { upTo: 250_000, rate: 0.010 },
  { upTo: 400_000, rate: 0.015 },
  { upTo: 2_000_000, rate: 0.020 },
  { upTo: null, rate: 0.025 },
];

// British Columbia Property Transfer Tax.
const BC_BRACKETS: Bracket[] = [
  { upTo: 200_000, rate: 0.010 },
  { upTo: 2_000_000, rate: 0.020 },
  { upTo: 3_000_000, rate: 0.030 },
  { upTo: null, rate: 0.050 },
];

// Manitoba LTT.
const MB_BRACKETS: Bracket[] = [
  { upTo: 30_000, rate: 0.000 },
  { upTo: 90_000, rate: 0.005 },
  { upTo: 150_000, rate: 0.010 },
  { upTo: 200_000, rate: 0.015 },
  { upTo: null, rate: 0.020 },
];

// Quebec Welcome Tax (provincial schedule for 2026 — Montreal raises the top).
const QC_BRACKETS: Bracket[] = [
  { upTo: 58_900, rate: 0.005 },
  { upTo: 294_600, rate: 0.010 },
  { upTo: 552_300, rate: 0.015 },
  { upTo: 1_104_700, rate: 0.020 },
  { upTo: null, rate: 0.025 },
];

const QC_MONTREAL_BRACKETS: Bracket[] = [
  { upTo: 58_900, rate: 0.005 },
  { upTo: 294_600, rate: 0.010 },
  { upTo: 552_300, rate: 0.015 },
  { upTo: 1_104_700, rate: 0.020 },
  { upTo: 2_041_900, rate: 0.025 },
  { upTo: null, rate: 0.030 },
];

function provincialLtt(price: number, province: Province, city?: string): number {
  switch (province) {
    case "AB":
    case "SK":
      // No LTT — minimal registration fees only.
      return 50 + Math.ceil(price / 5000) * 2;
    case "BC":
      return applyBrackets(price, BC_BRACKETS);
    case "MB":
      return applyBrackets(price, MB_BRACKETS);
    case "NB":
      return price * 0.01;
    case "NL":
      return Math.max(0, 100 + (price - 500) * 0.004);
    case "NS":
      // 1.5% in Halifax; 1.0% as a reasonable default elsewhere. Buyers
      // outside Halifax should confirm with their municipality.
      return city === "halifax" ? price * 0.015 : price * 0.010;
    case "ON":
      return applyBrackets(price, ON_BRACKETS);
    case "PE":
      return price * 0.01;
    case "QC":
      return applyBrackets(price, city === "montreal" ? QC_MONTREAL_BRACKETS : QC_BRACKETS);
    // Territories — model as no LTT (matches AB/SK pattern). Real territorial
    // fees vary; surface in prose if needed.
    case "NT":
    case "NU":
    case "YT":
      return 50 + Math.ceil(price / 5000) * 2;
  }
}

function municipalLtt(price: number, province: Province, city?: string): number {
  if (province === "ON" && city === "toronto") {
    return applyBrackets(price, ON_BRACKETS);
  }
  return 0;
}

// --- First-time buyer rebates --------------------------------------------

function fthbRebateAmount(input: ClosingCostsInput): number {
  if (!input.firstTimeBuyer) return 0;
  const { price, province, city, newBuild } = input;
  switch (province) {
    case "BC": {
      // Resale: full exemption to $500k, proportional to $835k.
      // New build: full exemption to $1.1M, proportional to $1.15M.
      if (newBuild) {
        if (price <= 1_100_000) return applyBrackets(price, BC_BRACKETS);
        if (price >= 1_150_000) return 0;
        const fullExempt = applyBrackets(1_100_000, BC_BRACKETS);
        const fraction = (1_150_000 - price) / (1_150_000 - 1_100_000);
        return fullExempt * fraction;
      }
      if (price <= 500_000) return applyBrackets(price, BC_BRACKETS);
      if (price >= 835_000) return 0;
      const fullExempt = applyBrackets(500_000, BC_BRACKETS);
      const fraction = (835_000 - price) / (835_000 - 500_000);
      return fullExempt * fraction;
    }
    case "ON": {
      // Provincial: up to $4,000. Toronto MLTT: up to $4,475 (stackable).
      const provincial = Math.min(4_000, applyBrackets(price, ON_BRACKETS));
      const municipal = city === "toronto"
        ? Math.min(4_475, applyBrackets(price, ON_BRACKETS))
        : 0;
      return provincial + municipal;
    }
    case "PE": {
      // Full exemption from PEI's flat 1% RPTT.
      return price * 0.01;
    }
    default:
      // QC ($750) and SK ($1,050) provide income-tax credits, not LTT
      // rebates — surfaced in the guide prose, not netted against LTT here.
      return 0;
  }
}

// --- Public API -----------------------------------------------------------

export function calculateClosingCosts(input: ClosingCostsInput): ClosingCostsResult {
  const provincial = provincialLtt(input.price, input.province, input.city);
  const municipal = municipalLtt(input.price, input.province, input.city);
  const fthbRebate = Math.min(provincial + municipal, fthbRebateAmount(input));
  const netLtt = Math.max(0, provincial + municipal - fthbRebate);

  const legalFees = input.legalFees ?? 1500;
  const titleInsurance = input.titleInsurance ?? 250;
  const inspection = input.inspection ?? 500;

  return {
    ltt: {
      provincial: round2(provincial),
      municipal: round2(municipal),
      fthbRebate: round2(fthbRebate),
      net: round2(netLtt),
    },
    legalFees,
    titleInsurance,
    inspection,
    total: round2(netLtt + legalFees + titleInsurance + inspection),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
