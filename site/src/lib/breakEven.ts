/**
 * Fixed vs variable break-even math. Pure functions.
 *
 * Models a variable-rate scenario where the rate is piecewise-constant: it
 * starts at `variableRate` and jumps by `rateChangePct` at month
 * `rateChangeMonth`. Outputs the total interest paid under each option over
 * the chosen horizon (typically the 5-year term length).
 *
 * Uses Canadian semi-annual compounding via the existing calculator math.
 */

export interface BreakEvenInput {
  loanAmount: number;
  amortizationYears: number;
  fixedRate: number; // %
  variableRate: number; // % at month 0
  rateChangePct: number; // 0.5 = +0.5 percentage points
  rateChangeMonth: number; // 0 = immediate, 12 = month 12
  horizonMonths: number; // typically 60
}

export interface BreakEvenResult {
  fixedTotalInterest: number;
  variableTotalInterest: number;
  fixedPayment: number;
  variableInitialPayment: number;
  variablePostChangePayment: number;
  winner: "fixed" | "variable" | "tie";
  savingsAmount: number;
}

function periodicRateMonthly(annualRatePct: number): number {
  if (annualRatePct === 0) return 0;
  const annualRate = annualRatePct / 100;
  const effectiveAnnual = Math.pow(1 + annualRate / 2, 2) - 1;
  return Math.pow(1 + effectiveAnnual, 1 / 12) - 1;
}

function monthlyPayment(loan: number, annualRatePct: number, amortYears: number): number {
  if (loan === 0) return 0;
  const i = periodicRateMonthly(annualRatePct);
  const n = amortYears * 12;
  if (i === 0) return loan / n;
  return (loan * i) / (1 - Math.pow(1 + i, -n));
}

function simulate(
  loanAmount: number,
  amortYears: number,
  ratePcts: number[], // length = horizonMonths; rate per month
): { totalInterest: number; payments: number[] } {
  let balance = loanAmount;
  let totalInterest = 0;
  const payments: number[] = [];
  let currentRate = NaN;
  let currentPayment = 0;

  for (let m = 0; m < ratePcts.length; m++) {
    const r = ratePcts[m];
    if (r !== currentRate) {
      // Re-amortize remaining balance over remaining amortization months.
      const remainingMonths = amortYears * 12 - m;
      currentPayment = monthlyPayment(balance, r, remainingMonths / 12);
      currentRate = r;
    }
    const i = periodicRateMonthly(r);
    const interest = balance * i;
    const principal = currentPayment - interest;
    balance = Math.max(0, balance - principal);
    totalInterest += interest;
    payments.push(currentPayment);
    if (balance === 0) break;
  }

  return { totalInterest, payments };
}

export function compareBreakEven(input: BreakEvenInput): BreakEvenResult {
  const { loanAmount, amortizationYears, fixedRate, variableRate, rateChangePct, rateChangeMonth, horizonMonths } = input;

  if (loanAmount === 0) {
    return {
      fixedTotalInterest: 0,
      variableTotalInterest: 0,
      fixedPayment: 0,
      variableInitialPayment: 0,
      variablePostChangePayment: 0,
      winner: "tie",
      savingsAmount: 0,
    };
  }

  const fixedRates = Array(horizonMonths).fill(fixedRate);
  const variableRates = Array.from({ length: horizonMonths }, (_, m) =>
    m < rateChangeMonth ? variableRate : variableRate + rateChangePct,
  );

  const fixedSim = simulate(loanAmount, amortizationYears, fixedRates);
  const varSim = simulate(loanAmount, amortizationYears, variableRates);

  const variableInitialPayment = varSim.payments[0] ?? 0;
  const variablePostChangePayment =
    varSim.payments[Math.min(rateChangeMonth, varSim.payments.length - 1)] ?? variableInitialPayment;

  const diff = fixedSim.totalInterest - varSim.totalInterest;
  let winner: "fixed" | "variable" | "tie";
  if (Math.abs(diff) < 1) winner = "tie";
  else if (diff > 0) winner = "variable";
  else winner = "fixed";

  return {
    fixedTotalInterest: fixedSim.totalInterest,
    variableTotalInterest: varSim.totalInterest,
    fixedPayment: fixedSim.payments[0] ?? 0,
    variableInitialPayment,
    variablePostChangePayment,
    winner,
    savingsAmount: Math.abs(diff),
  };
}

export function findBreakEvenRise(input: Omit<BreakEvenInput, "rateChangePct">): number {
  if (input.fixedRate <= input.variableRate) return 0;

  // Bisection over [0, 10] percentage-point rises.
  let lo = 0;
  let hi = 10;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const r = compareBreakEven({ ...input, rateChangePct: mid });
    if (r.winner === "fixed") {
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}
