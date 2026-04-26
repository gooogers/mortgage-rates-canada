/**
 * Canadian mortgage payment math. Pure functions.
 *
 * Canadian mortgages are compounded semi-annually but paid monthly (or more
 * frequently). The standard payment formula is:
 *
 *   P = L × i / (1 - (1 + i)^(-n))
 *
 * where L is the loan amount, i is the periodic interest rate, and n is the
 * total number of payments. The periodic rate is derived from the annual rate
 * with semi-annual compounding:
 *
 *   r_eff = (1 + annual_rate / 2)^2 - 1   (effective annual rate)
 *   i = (1 + r_eff)^(periods_per_year ^ -1) - 1   (periodic rate)
 */

export type Frequency = "monthly" | "biweekly" | "accelerated_biweekly";

export interface MortgageInput {
  homePrice: number;
  downPaymentPct: number; // 0.05 = 5%
  annualRatePct: number; // 5.69 = 5.69%
  amortizationYears: number;
  frequency: Frequency;
}

export interface MortgageResult {
  /** Loan amount before CMHC premium. */
  principal: number;
  /** CMHC insurance premium in dollars (0 if down >= 20%). */
  cmhcPremium: number;
  /** Loan amount including CMHC premium. */
  totalLoan: number;
  /** Per-payment dollar amount. */
  payment: number;
  /** Number of payments per year for the chosen frequency. */
  paymentsPerYear: number;
  /** Total amount paid over the amortization (payments × periods). */
  totalPaid: number;
  /** Total interest paid (totalPaid - totalLoan). */
  totalInterest: number;
}

const PAYMENTS_PER_YEAR: Record<Frequency, number> = {
  monthly: 12,
  biweekly: 26,
  accelerated_biweekly: 26,
};

/** Required CMHC premium rate as a fraction of the loan. 0 = no CMHC required. */
export function cmhcPremiumRate(downPaymentPct: number): number {
  if (downPaymentPct < 0.05) {
    throw new Error("Down payment must be at least 5% in Canada.");
  }
  if (downPaymentPct >= 0.20) return 0;
  if (downPaymentPct >= 0.15) return 0.028;
  if (downPaymentPct >= 0.10) return 0.031;
  return 0.04; // 5.00–9.99%
}

export function calculateMortgage(input: MortgageInput): MortgageResult {
  const { homePrice, downPaymentPct, annualRatePct, amortizationYears, frequency } =
    input;

  const downPayment = homePrice * downPaymentPct;
  const principal = homePrice - downPayment;
  const cmhcPremium = principal * cmhcPremiumRate(downPaymentPct);
  const totalLoan = principal + cmhcPremium;

  const paymentsPerYear = PAYMENTS_PER_YEAR[frequency];
  const totalPayments = paymentsPerYear * amortizationYears;

  const payment = computePayment(
    totalLoan,
    annualRatePct,
    frequency,
    amortizationYears,
  );

  const totalPaid = payment * totalPayments;
  const totalInterest = totalPaid - totalLoan;

  return {
    principal,
    cmhcPremium,
    totalLoan,
    payment,
    paymentsPerYear,
    totalPaid,
    totalInterest,
  };
}

function computePayment(
  totalLoan: number,
  annualRatePct: number,
  frequency: Frequency,
  amortizationYears: number,
): number {
  const paymentsPerYear = PAYMENTS_PER_YEAR[frequency];
  const totalPayments = paymentsPerYear * amortizationYears;

  if (annualRatePct === 0) {
    return totalLoan / totalPayments;
  }

  // Canadian convention: nominal annual rate compounded semi-annually.
  const annualRate = annualRatePct / 100;
  const effectiveAnnual = Math.pow(1 + annualRate / 2, 2) - 1;

  if (frequency === "accelerated_biweekly") {
    // Compute the monthly payment, then divide by 2.
    const monthlyRate = Math.pow(1 + effectiveAnnual, 1 / 12) - 1;
    const monthlyPayments = 12 * amortizationYears;
    const monthlyPayment =
      (totalLoan * monthlyRate) /
      (1 - Math.pow(1 + monthlyRate, -monthlyPayments));
    return monthlyPayment / 2;
  }

  const periodicRate = Math.pow(1 + effectiveAnnual, 1 / paymentsPerYear) - 1;
  return (
    (totalLoan * periodicRate) /
    (1 - Math.pow(1 + periodicRate, -totalPayments))
  );
}
