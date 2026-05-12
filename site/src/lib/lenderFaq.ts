/**
 * Per-lender FAQ items, rendered from facts + today's rate sheet.
 *
 * Answers are tuned to long-tail queries we see in Search Console:
 *   - "{lender} 5 year fixed mortgage rate"
 *   - "does {lender} offer variable mortgage rates"
 *   - "{lender} prepayment privileges"
 *   - "is {lender} a big 6 bank"
 *   - "are {lender} mortgage rates negotiable"
 *
 * The questions and answers reference the current discounted rate where it
 * exists, so the FAQ refreshes with the daily rate snapshot.
 */
import type { Lender, LenderType, Rate, Term } from "@lib/rates";
import type { LenderFacts } from "@lib/lenderFacts";
import { formatPercent } from "@lib/format";

export interface FaqItem {
  q: string;
  a: string;
}

function rateFor(lender: Lender, term: Term): Rate | null {
  return lender.rates.find((r) => r.term === term) ?? null;
}

function effective(rate: Rate | null): number | null {
  if (!rate) return null;
  return rate.discounted ?? rate.posted;
}

function describeType(type: LenderType): string {
  switch (type) {
    case "big6":
      return "one of Canada's Big 6 chartered banks";
    case "credit_union":
      return "a Canadian credit union";
    case "monoline":
      return "a monoline / specialty mortgage lender";
  }
}

function prepaymentExample(lumpSumPct: number, paymentIncreasePct: number): string {
  const lumpOn500k = Math.round((500_000 * lumpSumPct) / 100);
  const lumpFormatted = lumpOn500k.toLocaleString("en-CA");
  const paymentNote =
    paymentIncreasePct >= 100
      ? "and you can double your regular payment without penalty"
      : `and increase your regular payment by up to ${paymentIncreasePct}% per year`;
  return `Up to ${lumpSumPct}% lump-sum prepayment per year — about $${lumpFormatted} on a $500,000 mortgage — ${paymentNote}.`;
}

export function buildLenderFaq(lender: Lender, facts: LenderFacts | null): FaqItem[] {
  const items: FaqItem[] = [];
  const name = lender.name;

  // 1) Headline question — answer with the 5yr fixed if offered, else first rate.
  const fiveYear = rateFor(lender, "5yr_fixed");
  const fiveYearRate = effective(fiveYear);
  if (fiveYearRate !== null && fiveYear) {
    items.push({
      q: `What is ${name}'s 5-year fixed mortgage rate today?`,
      a:
        `${name}'s posted 5-year fixed rate is ${formatPercent(fiveYear.posted)}, with a published discounted rate of ${formatPercent(fiveYear.discounted ?? fiveYear.posted)}. ` +
        `Rates change frequently and brokers or branches may quote lower numbers for well-qualified borrowers — always confirm directly.`,
    });
  }

  // 2) Variable availability — direct answer to "does {lender} offer variable rates"
  const variable = rateFor(lender, "variable");
  if (variable) {
    items.push({
      q: `Does ${name} offer a variable-rate mortgage?`,
      a:
        `Yes. ${name}'s posted variable rate is ${formatPercent(variable.posted)}` +
        (variable.discounted !== null
          ? ` with a published discounted rate of ${formatPercent(variable.discounted)}.`
          : `.`) +
        ` Variable rates move with the lender's prime rate, which tracks the Bank of Canada policy rate.`,
    });
  } else {
    items.push({
      q: `Does ${name} offer a variable-rate mortgage?`,
      a:
        `${name} does not currently publish a discounted variable rate on its main rate sheet. ` +
        `That doesn't always mean variable products are unavailable — it's worth asking a branch or broker.`,
    });
  }

  // 3) Prepayment — direct answer to "{lender} prepayment privileges"
  if (facts) {
    items.push({
      q: `What are ${name}'s prepayment privileges?`,
      a: prepaymentExample(facts.prepayment.lump_sum_pct, facts.prepayment.payment_increase_pct),
    });
  }

  // 4) Posted vs discounted — high-volume long-tail
  items.push({
    q: `Why is ${name}'s posted rate higher than the discounted rate?`,
    a:
      `Posted rates are the official sticker rate Canadian lenders publish — they're used for the federal stress test and for calculating early-payout penalties at the Big 6 banks. ` +
      `The discounted rate is what ${name} will actually lend at to a typical qualified borrower. ` +
      `For closed fixed mortgages at Big 6 banks specifically, the gap between posted and discounted matters because the interest-rate-differential (IRD) penalty is calculated against posted rates.`,
  });

  // 5) Lender type / "is X a big 6 bank"
  items.push({
    q: lender.type === "big6"
      ? `Is ${name} one of Canada's Big 6 banks?`
      : `Is ${name} a Big 6 bank?`,
    a:
      lender.type === "big6"
        ? `Yes. ${name} is ${describeType(lender.type)} (RBC, TD, BMO, Scotiabank, CIBC, and National Bank), regulated federally by OSFI.`
        : `No. ${name} is ${describeType(lender.type)}, not one of the Big 6 chartered banks (RBC, TD, BMO, Scotiabank, CIBC, National Bank). ` +
          (facts ? `It's regulated by ${facts.regulator}.` : ""),
  });

  // 6) Negotiable / how to get the lowest rate — addresses intent behind "best {lender} rates"
  items.push({
    q: `Are ${name}'s mortgage rates negotiable?`,
    a:
      `Often yes — the published discounted rate is a starting point. ` +
      `Borrowers with strong credit, large down payments, or quotes from competing lenders typically see lower offers, especially through mortgage brokers. ` +
      `The rates shown on this page are public quotes; your actual approved rate may differ.`,
  });

  // 7) Channels — answers "where do I get a {lender} mortgage"
  if (facts) {
    const channelList = facts.channels.join(", ");
    items.push({
      q: `How do I apply for a mortgage with ${name}?`,
      a:
        `${name} originates mortgages through ${channelList} channels. ` +
        (facts.channels.includes("broker")
          ? "A mortgage broker can usually access the same or better rates than the public-facing sheet."
          : "Apply directly through their published channel."),
    });
  }

  return items;
}
