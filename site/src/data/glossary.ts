/**
 * Canonical glossary entries. Imported by /glossary and by the
 * remark-glossary-autolink plugin, so the page and the auto-linker
 * never drift apart.
 */

export interface GlossaryEntry {
  term: string;
  /** Anchor id; falls back to a slug of `term` if omitted. */
  id?: string;
  definition: string;
  /** Optional internal /guides/* link to deepen the definition. */
  link?: { href: string; label: string };
  /**
   * Extra phrases that should also auto-link to this entry. Use for
   * abbreviations and common variants — e.g. "GDS" plus "Gross Debt
   * Service" both linking to the same entry. Match is case-insensitive
   * and word-boundary-anchored.
   */
  aliases?: string[];
}

export function slugifyTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: "Amortization",
    definition:
      "The total time required to fully pay down the mortgage, assuming the same payment continues. Distinct from the term, which is the length of the rate contract. Canadian amortizations are typically 25 years; 30 years is available with 20%+ down or for first-time buyers / new-build buyers under 2024 federal rule changes.",
  },
  {
    term: "Bridge financing",
    definition:
      "A short-term loan that covers the gap between buying a new home and selling the old one — typically 30–120 days, secured against the equity in the property being sold. Most A-lenders offer bridge financing in conjunction with their main mortgage product.",
  },
  {
    term: "Closed mortgage",
    definition:
      "A mortgage that cannot be paid off early without a penalty (3 months' interest or IRD, whichever is greater for fixed terms). Most Canadian mortgages are closed because the rate is significantly lower than open mortgages.",
  },
  {
    term: "CMHC (Canada Mortgage and Housing Corporation)",
    id: "cmhc",
    aliases: ["CMHC"],
    definition:
      "The federal Crown corporation that insures high-ratio mortgages (under 20% down). The borrower pays the insurance premium (2.8–4.0% of the loan, financed in); the lender carries reduced default risk and offers lower rates in return. Sagen and Canada Guaranty offer competing private insurance with the same terms.",
    link: { href: "/guides/down-payment", label: "Down payment guide" },
  },
  {
    term: "Conventional mortgage",
    definition:
      "A mortgage with 20% or more down — no insurance required. Often higher rate than insured mortgages because the lender carries the default risk. See also: insurable, uninsured.",
  },
  {
    term: "Discounted rate",
    definition:
      "The bank's own published special-offer rate, typically 1–2 percentage points below posted. The actual rate a borrower with good credit can negotiate. Often called \"special rate\" or \"limited-time offer\" by the lender. A broker can usually beat the discounted rate.",
  },
  {
    term: "Fixed rate",
    definition:
      "A mortgage where the interest rate is locked for the full term. Payments don't change regardless of market rate moves. Trades flexibility for certainty.",
    link: { href: "/guides/fixed-vs-variable", label: "Fixed vs variable" },
  },
  {
    term: "GDS (Gross Debt Service ratio)",
    id: "gds",
    aliases: ["GDS", "Gross Debt Service"],
    definition:
      "Housing costs (P+I + property tax + heat + 50% of condo fees) divided by gross monthly income. Federally regulated lenders cap GDS at 39% for qualifying. One of the two debt-service ratios behind every mortgage approval.",
    link: { href: "/guides/affordability", label: "Affordability guide" },
  },
  {
    term: "HELOC (Home Equity Line of Credit)",
    id: "heloc",
    aliases: ["HELOC"],
    definition:
      "A revolving credit facility secured against home equity, typically capped at 65% of the property value. Variable rate, interest-only minimum payments, and the ability to draw and repay repeatedly. Often bundled into a readvanceable mortgage product.",
  },
  {
    term: "High-ratio mortgage",
    definition:
      "A mortgage with less than 20% down. Insurance is mandatory, charged as a premium added to the loan amount. The cheapest rate tier in Canada because the insurer carries the default risk.",
  },
  {
    term: "IRD (Interest Rate Differential)",
    id: "ird",
    aliases: ["IRD", "Interest Rate Differential"],
    definition:
      "The penalty formula for breaking a closed fixed-rate mortgage early, alongside three months' interest. Calculated as (your contract rate − current rate for closest term) × balance × months remaining ÷ 12. Big banks use posted-rate arithmetic that inflates IRD by your original discount, often 5× the monoline figure.",
    link: { href: "/guides/break-the-mortgage", label: "Break-the-mortgage guide" },
  },
  {
    term: "Insurable mortgage",
    definition:
      "A mortgage with 20%+ down where the lender insures it on the back end (no premium passed to the borrower). Conditions: ≤25-year amortization, owner-occupied, ≤$1.5M purchase. Cheaper than uninsured, more expensive than insured.",
    link: { href: "/guides/insured-vs-uninsured", label: "Insured vs uninsured rate tiers" },
  },
  {
    term: "Insured mortgage",
    definition:
      "A mortgage with under 20% down where the borrower pays a CMHC / Sagen / Canada Guaranty premium. Lowest rate tier in Canada because default risk is on the insurer.",
  },
  {
    term: "Land transfer tax (LTT)",
    id: "land-transfer-tax",
    aliases: ["land transfer tax", "LTT"],
    definition:
      "A provincial tax paid at closing on every real estate purchase. Rates and exemptions vary by province; Toronto adds a matching municipal LTT. Alberta, Saskatchewan, and Newfoundland have no LTT — only nominal registration fees.",
    link: { href: "/guides/closing-costs", label: "Closing costs guide" },
  },
  {
    term: "LTV (Loan-to-Value)",
    id: "ltv",
    aliases: ["LTV"],
    definition:
      "The ratio of the mortgage to the property value, expressed as a percent. Insurance and rate tiers are tied to LTV: under 80% LTV = uninsured / insurable, 80–95% LTV = insured / high-ratio.",
  },
  {
    term: "Monoline lender",
    aliases: ["monoline"],
    definition:
      "A lender that funds mortgages exclusively (not a full-service bank). Examples: First National, MCAP, Strive, Equitable Bank, Home Trust. Typically cheaper than the Big 6 and accessible mainly through brokers. Penalty math is usually borrower-friendlier — no posted-rate IRD inflation.",
  },
  {
    term: "Open mortgage",
    definition:
      "A mortgage that can be paid off in full any time without penalty. Materially higher rate than a closed mortgage. Useful only when you expect to sell or refinance within months — for example, while renovating to flip.",
  },
  {
    term: "Portability",
    definition:
      "The right to move your existing mortgage (rate, balance, remaining term) to a new property when you sell and buy. Saves you from a penalty on the sale and a stress test on the new mortgage. Subject to lender approval of the new property and any top-up amount.",
  },
  {
    term: "Posted rate",
    aliases: ["posted rate"],
    definition:
      "The headline rate published on a lender's website. Almost no one pays the posted rate — the discounted rate is the real price, typically 1–2pp below. Posted is mainly used by big banks for IRD penalty calculations.",
  },
  {
    term: "Prepayment privilege",
    aliases: ["prepayment privilege", "prepayment privileges"],
    definition:
      "The right to pay extra on a closed mortgage each year without triggering a penalty. Typically 10–20% lump sum on the original principal plus a 10–20% payment increase. Underused — see the guide for the tactical math.",
    link: { href: "/guides/prepayment-privileges", label: "Prepayment privileges guide" },
  },
  {
    term: "Pre-approval vs pre-qualification",
    id: "pre-approval",
    definition:
      "Pre-qualification is a quick estimate — no documents, no credit pull, directional only. Pre-approval is a full credit check + verified income + rate hold (90–120 days) and carries weight with sellers. If you're house hunting seriously, get pre-approved.",
  },
  {
    term: "Refinance",
    definition:
      "Replacing your existing mortgage with a new one — usually to access equity (cash-out) or restructure. Requires re-qualifying at the new lender, including the federal stress test, even with the same lender. Triggers a penalty if mid-term.",
  },
  {
    term: "Renewal",
    definition:
      "The end of your term, when you sign a new contract for the next term. No penalty, no stress test if you stay with the same lender on a straight switch (rule change in late 2024 also waives stress test for switching at renewal). The single best moment to negotiate a lower rate.",
    link: { href: "/guides/renewal", label: "Renewal guide" },
  },
  {
    term: "Stress test",
    aliases: ["stress test"],
    definition:
      "Federal rule (OSFI Guideline B-20) requiring borrowers to qualify at max(contract + 2%, 5.25%). Reduces typical maximum approval by 15–25%. Doesn't apply to renewing with the same lender (since 2024 also doesn't apply to switching at renewal between federally regulated lenders without a top-up).",
    link: { href: "/guides/stress-test", label: "Stress test explained" },
  },
  {
    term: "TDS (Total Debt Service ratio)",
    id: "tds",
    aliases: ["TDS", "Total Debt Service"],
    definition:
      "GDS plus all other debt payments (car, credit card minimums, lines of credit, student loans). Federally regulated lenders cap TDS at 44% of gross income for qualifying.",
    link: { href: "/guides/affordability", label: "Affordability guide" },
  },
  {
    term: "Term",
    definition:
      "The length of the rate contract — 1, 2, 3, 4, 5, 7, or 10 years. Distinct from amortization (the time to pay off the entire mortgage). At the end of the term, you renew, refinance, or switch lenders.",
    link: { href: "/guides/term-length", label: "Term length guide" },
  },
  {
    term: "Uninsured mortgage",
    definition:
      "A mortgage that doesn't qualify for any insurance tier — typically 30-year amortizations, rentals, refinances, or homes over $1.5M. Highest rate tier; lender carries default risk and prices accordingly.",
  },
  {
    term: "Variable rate",
    definition:
      "A mortgage where the rate floats with the lender's prime rate. When the Bank of Canada raises or cuts the policy rate, prime moves with it. Variable typically starts cheaper than fixed; the trade-off is uncertainty over the term.",
    link: { href: "/guides/fixed-vs-variable", label: "Fixed vs variable" },
  },
];

export interface GlossaryLinkTerm {
  /** Phrase to match in body text (case-insensitive, word-boundary). */
  match: string;
  /** Anchor id to link to. */
  anchor: string;
}

/**
 * Phrases the auto-linker should match. Includes each entry's aliases.
 * Sorted longest-first so multi-word phrases ("Gross Debt Service") win
 * before their abbreviation ("GDS") inside the same sentence — which
 * means the phrase becomes the link text rather than just the acronym.
 */
export const GLOSSARY_LINK_TERMS: GlossaryLinkTerm[] = (() => {
  const out: GlossaryLinkTerm[] = [];
  for (const entry of GLOSSARY_ENTRIES) {
    if (!entry.aliases || entry.aliases.length === 0) continue;
    const anchor = entry.id ?? slugifyTerm(entry.term);
    for (const alias of entry.aliases) {
      out.push({ match: alias, anchor });
    }
  }
  return out.sort((a, b) => b.match.length - a.match.length);
})();
