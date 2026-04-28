/**
 * Canadian mortgage affordability math (GDS/TDS + federal stress test).
 *
 * GDS limit: 39% (federally insured). TDS limit: 44%.
 * Stress test: must qualify at max(contract + 2%, 5.25%).
 *
 * Uses Canadian semi-annual compounding.
 */

export interface AffordabilityInput {
  grossAnnualIncome: number;
  monthlyDebts: number; // car/credit card minimums/student loans
  estimatedPropertyTax: number; // monthly
  estimatedHeat: number; // monthly
  estimatedCondoFees: number; // monthly; 0 if not condo
  downPayment: number; // dollars
  contractRate: number; // %
  amortizationYears: number;
  gdsLimit?: number; // default 0.39
  tdsLimit?: number; // default 0.44
  stressTestFloor?: number; // default 5.25
}

export interface AffordabilityResult {
  qualifyingRate: number;
  maxMortgageGds: number;
  maxMortgageTds: number;
  maxMortgage: number;
  maxPurchasePrice: number;
  bindingConstraint: "gds" | "tds";
}

const STRESS_TEST_FLOOR = 5.25;

export function qualifyingRate(contractRatePct: number, floor = STRESS_TEST_FLOOR): number {
  return Math.max(contractRatePct + 2, floor);
}

function periodicRateMonthly(annualRatePct: number): number {
  if (annualRatePct === 0) return 0;
  const annualRate = annualRatePct / 100;
  const effectiveAnnual = Math.pow(1 + annualRate / 2, 2) - 1;
  return Math.pow(1 + effectiveAnnual, 1 / 12) - 1;
}

function maxMortgageFromMonthlyPayment(
  maxMonthlyPayment: number,
  qualifyRatePct: number,
  amortYears: number,
): number {
  if (maxMonthlyPayment <= 0) return 0;
  const i = periodicRateMonthly(qualifyRatePct);
  const n = amortYears * 12;
  if (i === 0) return maxMonthlyPayment * n;
  // P = M * (1 - (1+i)^-n) / i
  return (maxMonthlyPayment * (1 - Math.pow(1 + i, -n))) / i;
}

export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  const {
    grossAnnualIncome,
    monthlyDebts,
    estimatedPropertyTax,
    estimatedHeat,
    estimatedCondoFees,
    downPayment,
    contractRate,
    amortizationYears,
    gdsLimit = 0.39,
    tdsLimit = 0.44,
    stressTestFloor = STRESS_TEST_FLOOR,
  } = input;

  const qualifyRate = qualifyingRate(contractRate, stressTestFloor);
  const monthlyIncome = grossAnnualIncome / 12;
  const housingFixed = estimatedPropertyTax + estimatedHeat + estimatedCondoFees * 0.5;

  const gdsBudget = monthlyIncome * gdsLimit - housingFixed;
  const tdsBudget = monthlyIncome * tdsLimit - housingFixed - monthlyDebts;

  const maxPaymentGds = Math.max(0, gdsBudget);
  const maxPaymentTds = Math.max(0, tdsBudget);

  const maxMortgageGds = maxMortgageFromMonthlyPayment(maxPaymentGds, qualifyRate, amortizationYears);
  const maxMortgageTds = maxMortgageFromMonthlyPayment(maxPaymentTds, qualifyRate, amortizationYears);

  const maxMortgage = Math.min(maxMortgageGds, maxMortgageTds);
  const bindingConstraint = maxMortgageGds <= maxMortgageTds ? "gds" : "tds";

  return {
    qualifyingRate: qualifyRate,
    maxMortgageGds,
    maxMortgageTds,
    maxMortgage,
    maxPurchasePrice: maxMortgage + downPayment,
    bindingConstraint,
  };
}
