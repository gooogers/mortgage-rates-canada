/**
 * Fixed vs variable break-even math. Pure functions.
 *
 * Models a variable-rate path that moves linearly from `variableRate` to
 * `variableRate + variableRateTargetChange` over `paceMonths`, then holds
 * flat for the rest of the horizon. paceMonths = 0 means an immediate jump.
 *
 * Uses Canadian semi-annual compounding via the existing calculator math.
 */

export interface BreakEvenInput {
  loanAmount: number;
  amortizationYears: number;
  fixedRate: number; // %
  variableRate: number; // % at month 0
  /** Total change in percentage points by the end of the pace window. -1.5 = drops 1.5pp. */
  variableRateTargetChange: number;
  /** Months over which the linear move happens. 0 = immediate jump. */
  paceMonths: number;
  horizonMonths: number; // typically 60
}

export interface BreakEvenResult {
  fixedTotalInterest: number;
  variableTotalInterest: number;
  fixedPayment: number;
  variableInitialPayment: number;
  variableEndingPayment: number;
  winner: "fixed" | "variable" | "tie";
  savingsAmount: number;
  /** Cumulative interest paid by month for each option. Length = horizonMonths + 1; index 0 is 0. */
  fixedCumulativeInterest: number[];
  variableCumulativeInterest: number[];
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

function buildVariableRatePath(
  variableRate: number,
  targetChange: number,
  paceMonths: number,
  horizonMonths: number,
): number[] {
  const path: number[] = [];
  for (let m = 0; m < horizonMonths; m++) {
    if (paceMonths <= 0) {
      path.push(variableRate + targetChange);
    } else if (m >= paceMonths) {
      path.push(variableRate + targetChange);
    } else {
      path.push(variableRate + (targetChange * m) / paceMonths);
    }
  }
  return path;
}

function simulate(
  loanAmount: number,
  amortYears: number,
  ratePcts: number[],
): { totalInterest: number; payments: number[]; cumulativeInterest: number[] } {
  let balance = loanAmount;
  let totalInterest = 0;
  const payments: number[] = [];
  const cumulativeInterest: number[] = [0];
  let currentRate = NaN;
  let currentPayment = 0;

  for (let m = 0; m < ratePcts.length; m++) {
    const r = ratePcts[m];
    if (r !== currentRate) {
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
    cumulativeInterest.push(totalInterest);
    if (balance === 0) break;
  }

  return { totalInterest, payments, cumulativeInterest };
}

export function compareBreakEven(input: BreakEvenInput): BreakEvenResult {
  const {
    loanAmount,
    amortizationYears,
    fixedRate,
    variableRate,
    variableRateTargetChange,
    paceMonths,
    horizonMonths,
  } = input;

  if (loanAmount === 0) {
    return {
      fixedTotalInterest: 0,
      variableTotalInterest: 0,
      fixedPayment: 0,
      variableInitialPayment: 0,
      variableEndingPayment: 0,
      winner: "tie",
      savingsAmount: 0,
      fixedCumulativeInterest: Array(horizonMonths + 1).fill(0),
      variableCumulativeInterest: Array(horizonMonths + 1).fill(0),
    };
  }

  const fixedRates = Array(horizonMonths).fill(fixedRate);
  const variableRates = buildVariableRatePath(
    variableRate,
    variableRateTargetChange,
    paceMonths,
    horizonMonths,
  );

  const fixedSim = simulate(loanAmount, amortizationYears, fixedRates);
  const varSim = simulate(loanAmount, amortizationYears, variableRates);

  const variableInitialPayment = varSim.payments[0] ?? 0;
  const variableEndingPayment = varSim.payments[varSim.payments.length - 1] ?? variableInitialPayment;

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
    variableEndingPayment,
    winner,
    savingsAmount: Math.abs(diff),
    fixedCumulativeInterest: fixedSim.cumulativeInterest,
    variableCumulativeInterest: varSim.cumulativeInterest,
  };
}

/**
 * Find the immediate target rise (in % points) at which fixed begins to win.
 * Useful as a sanity-check / commentary number; assumes paceMonths = 0.
 */
export function findBreakEvenRise(
  input: Omit<BreakEvenInput, "variableRateTargetChange" | "paceMonths">,
): number {
  if (input.fixedRate <= input.variableRate) return 0;

  let lo = 0;
  let hi = 10;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const r = compareBreakEven({
      ...input,
      variableRateTargetChange: mid,
      paceMonths: 0,
    });
    if (r.winner === "fixed") {
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}
