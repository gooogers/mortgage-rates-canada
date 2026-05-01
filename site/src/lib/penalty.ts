/**
 * Mortgage prepayment penalty math. Pure functions.
 *
 * Models the two dominant Canadian closed-mortgage penalty regimes:
 *   - Variable closed: 3 months' interest (3MI) at the contract rate.
 *   - Fixed closed:    greater of 3MI and IRD (interest rate differential).
 *
 * IRD has two flavours in practice:
 *   - Monoline / typical: IRD = (contract − comparison) × balance × months/12
 *     where `comparison` is the lender's current rate for the term closest to
 *     the months you have left.
 *   - Big-bank (RBC/TD/BMO/Scotia/CIBC/National): the lender substitutes
 *     `comparison` with `currentPosted − originalDiscount`. Because the
 *     original discount you negotiated typically exceeds today's posted-vs-
 *     contract gap, this inflates the IRD — often by 5×.
 *
 * `postedSpread` captures that inflation as "the discount you originally got
 * off the posted rate when you signed." For monoline lenders set it to 0; for
 * big-bank fixed mortgages set it to whatever was shaved off posted at origination
 * (commonly 1.5–2.0 percentage points).
 */

export interface PenaltyInput {
  /** Outstanding mortgage balance in dollars. */
  balance: number;
  /** Your current contract rate (%). */
  contractRate: number;
  /** Months left in your current term. */
  monthsRemaining: number;
  /** "variable" → 3MI only. "fixed" → greater of 3MI and IRD. */
  type: "variable" | "fixed";
  /** Lender's current rate (%) for the term closest to months remaining. */
  comparisonRate: number;
  /**
   * Percentage points the big bank adds to the IRD spread by using posted-rate
   * arithmetic. 0 for monoline / true comparison-rate IRD.
   */
  postedSpread: number;
}

export interface PenaltyResult {
  /** 3 months of interest on the balance at the contract rate. */
  threeMonthsInterest: number;
  /** IRD penalty (always 0 for variable). */
  ird: number;
  /** Final penalty: 3MI for variable, max(3MI, IRD) for fixed. */
  penalty: number;
  /** Which formula bound the result. */
  method: "3MI" | "IRD";
}

export function calculatePenalty(input: PenaltyInput): PenaltyResult {
  const balance = Math.max(0, input.balance);
  const contract = Math.max(0, input.contractRate) / 100;
  const months = Math.max(0, input.monthsRemaining);

  const threeMonthsInterest = balance * contract * (3 / 12);

  if (input.type === "variable") {
    return {
      threeMonthsInterest,
      ird: 0,
      penalty: threeMonthsInterest,
      method: "3MI",
    };
  }

  const comparison = Math.max(0, input.comparisonRate) / 100;
  const spread = Math.max(0, input.postedSpread) / 100;
  // Effective IRD spread: contract − (comparison − postedSpread)
  // For monoline (postedSpread=0): contract − comparison.
  // For big bank: contract − comparison + originalDiscount.
  const effectiveSpread = Math.max(0, contract - comparison + spread);
  const ird = balance * effectiveSpread * (months / 12);

  const penalty = Math.max(threeMonthsInterest, ird);
  return {
    threeMonthsInterest,
    ird,
    penalty,
    method: penalty === ird && ird > threeMonthsInterest ? "IRD" : "3MI",
  };
}
