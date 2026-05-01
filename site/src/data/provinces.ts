/**
 * Per-province content for /provinces/[slug] landing pages.
 *
 * Editorial-only data — rate values come from rates.json at request time,
 * filtered by province via lendersInScope() and bestRateForTermInScope().
 *
 * Land transfer tax (LTT) is summarised in prose here; the full LTT calculator
 * is a separate roadmap item. FTHB programs listed are PROVINCIAL only —
 * federal programs (FHSA, RRSP HBP, Home Buyers' Tax Credit) apply
 * everywhere and are noted on the page template, not per province.
 */
import type { Province } from "@lib/rates";

export interface FthbProgram {
  name: string;
  summary: string;
  link?: string;
}

export interface MunicipalLttNote {
  city: string;
  description: string;
}

export interface ProvinceData {
  code: Province;
  /** URL slug — kebab-case full name. */
  slug: string;
  name: string;
  capital: string;
  /** 1–2 sentence intro shown under the H1. */
  headline: string;
  ltt: {
    /** Plain-English summary of how LTT works in this province. */
    summary: string;
    municipal?: MunicipalLttNote;
    fthbRebate?: string;
  };
  /** Provincial first-time home buyer programs — federal programs noted globally. */
  fthbPrograms: FthbProgram[];
  /** Bullet-pointed local rules / quirks that affect mortgage decisions. */
  notes: string[];
}

// Territories (NT, NU, YT) intentionally omitted — small populations, no
// provincial-only lenders in the dataset, low search volume. Using
// Partial<Record> keeps the keys constrained to the Province union without
// forcing entries for every territory.
export const PROVINCES: Partial<Record<Province, ProvinceData>> = {
  AB: {
    code: "AB",
    slug: "alberta",
    name: "Alberta",
    capital: "Edmonton",
    headline:
      "Alberta has no provincial land transfer tax — the cheapest closing province in Canada. The big six and ATB compete hardest in Calgary and Edmonton; provincial credit unions like Servus often beat them on smaller mortgages.",
    ltt: {
      summary:
        "Alberta is one of three provinces with no land transfer tax. Buyers pay only a small registration fee — typically $50 + $2 per $5,000 of value for the title transfer, plus a similar fee for the mortgage registration. On a $500,000 home expect total registration costs around $300, versus $5,000–$15,000+ in provinces that levy LTT.",
    },
    fthbPrograms: [
      {
        name: "Land Title and Mortgage Registration Fees",
        summary:
          "Not a rebate, but worth knowing: registration fees are nominal in Alberta, so closing costs are dominated by legal fees and title insurance rather than LTT. Budget $1,500–$2,500 in legal/title vs $5,000+ LTT in Ontario.",
      },
    ],
    notes: [
      "ATB Financial is provincially owned (a Crown corporation), and Servus Credit Union is the largest credit union — both compete aggressively with the Big 6 in Alberta.",
      "Alberta credit unions are not federally regulated and may apply their own (sometimes looser) qualification standards. Useful if you're hitting the federal stress-test ceiling at a bank.",
      "No HST on resale homes; new builds are subject to GST (5%) with a partial rebate available below $450,000.",
    ],
  },

  BC: {
    code: "BC",
    slug: "british-columbia",
    name: "British Columbia",
    capital: "Victoria",
    headline:
      "BC has the most expensive housing market in Canada, the highest LTT rates above $2M, and the most generous first-time buyer LTT exemption — fully eliminated up to $500,000. Vancity and Coast Capital are the dominant provincial credit unions.",
    ltt: {
      summary:
        "BC's Property Transfer Tax: 1% on the first $200,000, 2% from $200,000 to $2,000,000, 3% from $2,000,000 to $3,000,000, and 5% on any portion above $3,000,000. On a $1,000,000 home that's $18,000.",
      fthbRebate:
        "First-time buyers are fully exempt from PTT on homes up to $500,000 (proportional rebate up to $835,000). New-build buyers: full exemption up to $1,100,000. Owner-occupation requirement applies for at least one year.",
    },
    fthbPrograms: [
      {
        name: "First Time Home Buyers' Program (PTT exemption)",
        summary:
          "Up to $8,000 saved on a $500k home by full PTT exemption. Eligibility: Canadian citizen or permanent resident, BC resident for 12 of past 24 months, never owned a principal residence anywhere in the world.",
        link: "https://www2.gov.bc.ca/gov/content/taxes/property-taxes/property-transfer-tax/exemptions/first-time-home-buyers",
      },
      {
        name: "Newly Built Home Exemption",
        summary:
          "Full PTT exemption on new builds up to $1.1M (partial up to $1.15M), regardless of first-time-buyer status. Stackable benefit if you're buying a new build as a first-timer.",
      },
      {
        name: "BC Home Owner Grant",
        summary:
          "Annual property tax reduction (not a mortgage program, but reduces ongoing carrying cost): up to $570 in Metro Vancouver and the Capital Regional District, up to $770 elsewhere. Applies to principal residences below the threshold ($2.175M for 2026).",
      },
    ],
    notes: [
      "The 20% Speculation and Vacancy Tax applies to designated regions (Metro Vancouver, Victoria, Kelowna, others) for non-residents and out-of-province owners. Worth checking before buying as an investment.",
      "Vancity and Coast Capital Savings are the major BC credit unions — both not federally regulated, both offer competitive rates that often beat Big 6 in BC.",
      "Foreign buyers face a 20% Additional PTT on top of the regular PTT — and a federal foreign buyer ban remains in effect through at least 2027.",
    ],
  },

  MB: {
    code: "MB",
    slug: "manitoba",
    name: "Manitoba",
    capital: "Winnipeg",
    headline:
      "Manitoba has moderate land transfer tax, a small first-time buyer rebate at the registration stage, and a relatively flat housing market that makes it one of the more affordable provinces to buy in.",
    ltt: {
      summary:
        "Manitoba LTT: $0 on first $30,000; 0.5% on $30,000–$90,000; 1.0% on $90,000–$150,000; 1.5% on $150,000–$200,000; 2.0% on any portion above $200,000. On a $400,000 home that's $5,650.",
      fthbRebate:
        "Manitoba does not offer a province-wide first-time buyer LTT rebate, but Winnipeg waives some municipal land transfer add-ons for first-time buyers in qualifying neighbourhoods.",
    },
    fthbPrograms: [
      {
        name: "Manitoba Tipping Point",
        summary:
          "There's no headline provincial FTHB program comparable to BC or Ontario. First-time buyers in Manitoba mostly rely on the federal HBP, FHSA, and the Home Buyers' Tax Credit.",
      },
    ],
    notes: [
      "Cambrian Credit Union and Sunova are notable Manitoba credit unions — provincially regulated, sometimes more flexible on qualifying than federal lenders.",
      "Winnipeg has the lowest median home price among Canada's larger cities, which means CMHC premium tier matters less and uninsured-vs-insured rate spread is smaller in absolute dollars.",
    ],
  },

  NB: {
    code: "NB",
    slug: "new-brunswick",
    name: "New Brunswick",
    capital: "Fredericton",
    headline:
      "New Brunswick has a low flat-rate land transfer tax, a moderate housing market, and active provincial credit unions like UNI Coopération financière. Closing costs are low but property taxes are among the highest in Canada relative to home value.",
    ltt: {
      summary:
        "New Brunswick LTT is a flat 1% of the greater of the assessed value or the purchase price. On a $300,000 home that's $3,000.",
    },
    fthbPrograms: [
      {
        name: "First-Time Home Buyer Tax Credit (provincial)",
        summary:
          "New Brunswick aligns with the federal Home Buyers' Tax Credit ($10,000 non-refundable, ~$1,500 in tax savings). The province does not offer an additional first-time-buyer rebate beyond federal programs.",
      },
    ],
    notes: [
      "Property taxes in NB are notably higher than the Canadian average relative to home value — factor this into affordability calculations beyond the mortgage payment alone.",
      "UNI Coopération financière is the dominant provincial credit union; competitive on smaller mortgages.",
    ],
  },

  NL: {
    code: "NL",
    slug: "newfoundland-and-labrador",
    name: "Newfoundland and Labrador",
    capital: "St. John's",
    headline:
      "NL has no land transfer tax — only nominal registration fees. The mortgage market is dominated by national lenders and a few regional credit unions. Affordable closing makes it a comparatively cheap province to buy in.",
    ltt: {
      summary:
        "Newfoundland and Labrador has no land transfer tax. Buyers pay registration fees: $100 + 0.4% of the property value above $500. On a $300,000 home that's about $1,300.",
    },
    fthbPrograms: [
      {
        name: "Provincial Home Modification Program (separate)",
        summary:
          "NL does not run a dedicated first-time-buyer rebate program. Federal programs (FHSA, HBP, Home Buyers' Tax Credit) apply.",
      },
    ],
    notes: [
      "Newfoundland and Labrador Credit Union is the main provincial alternative to Big 6 lending.",
    ],
  },

  NS: {
    code: "NS",
    slug: "nova-scotia",
    name: "Nova Scotia",
    capital: "Halifax",
    headline:
      "Nova Scotia has municipally-set land transfer tax (typically 1.5% in Halifax, 1% elsewhere), no provincial first-time buyer rebate, and a fast-rising Halifax market that makes affordability calculations a moving target.",
    ltt: {
      summary:
        "Nova Scotia delegates LTT (called 'Deed Transfer Tax') to municipalities. Most charge 1.5%, including Halifax Regional Municipality. Some smaller municipalities charge 1.0% or 1.25%. On a $500,000 Halifax home that's $7,500.",
      municipal: {
        city: "Halifax (HRM)",
        description:
          "Halifax charges 1.5% Deed Transfer Tax — the highest commonly-encountered rate in NS. No municipal first-time buyer rebate.",
      },
    },
    fthbPrograms: [
      {
        name: "Down Payment Assistance Program",
        summary:
          "An interest-free, repayable loan up to 5% of the purchase price (max $25,000) for low- and moderate-income first-time buyers. Income and price caps apply.",
        link: "https://novascotia.ca/business/programs-and-services/program.aspx?id=12537",
      },
    ],
    notes: [
      "Nova Scotia's foreign buyer / non-resident DTT surcharge of 5% was repealed in 2023 — only the standard 1.5% applies regardless of residency.",
    ],
  },

  ON: {
    code: "ON",
    slug: "ontario",
    name: "Ontario",
    capital: "Toronto",
    headline:
      "Ontario has the highest LTT in Canada outside of Vancouver — and Toronto buyers pay it twice. Provincial first-time buyer rebate of $4,000 is mostly eaten by Toronto's MLTT in the city. Meridian and Alterna are the dominant provincial credit unions.",
    ltt: {
      summary:
        "Ontario LTT: 0.5% on first $55,000; 1.0% on $55,000–$250,000; 1.5% on $250,000–$400,000; 2.0% on $400,000–$2,000,000; 2.5% on any portion above $2,000,000. On a $1,000,000 home that's $16,475.",
      municipal: {
        city: "Toronto",
        description:
          "Toronto charges an additional Municipal Land Transfer Tax (MLTT) at the same rates as the provincial LTT — effectively doubling LTT inside city limits. On a $1,000,000 Toronto home that's $32,950 total LTT.",
      },
      fthbRebate:
        "First-time buyers receive up to $4,000 off provincial LTT (full exemption on homes up to $368,000; partial above). Toronto MLTT first-time rebate: up to $4,475. Total rebate maxes at $8,475 in Toronto, $4,000 elsewhere.",
    },
    fthbPrograms: [
      {
        name: "Land Transfer Tax Refund for First-Time Homebuyers",
        summary:
          "Up to $4,000 refund on provincial LTT for eligible first-time buyers. Eligibility: 18+, never owned anywhere in the world, owner-occupied within 9 months. Spouse must also have never owned during your marriage.",
        link: "https://www.ontario.ca/page/land-transfer-tax-refunds-first-time-homebuyers",
      },
      {
        name: "Toronto MLTT First-Time Buyer Rebate",
        summary:
          "Up to $4,475 refund on Toronto MLTT (separate from provincial). Same eligibility as the provincial rebate. Stackable — first-time Toronto buyers can claim both.",
      },
    ],
    notes: [
      "Toronto and Ottawa account for the majority of Ontario's mortgage market by dollar volume. Big 6 banks compete hardest in these markets — but brokers consistently beat them.",
      "Meridian (largest Ontario credit union by membership) and Alterna Savings are provincially regulated and often more flexible on qualifying, useful for borderline approvals.",
      "The Non-Resident Speculation Tax (NRST) is 25% on foreign buyer purchases province-wide — separate from the federal foreign buyer ban.",
    ],
  },

  PE: {
    code: "PE",
    slug: "prince-edward-island",
    name: "Prince Edward Island",
    capital: "Charlottetown",
    headline:
      "PEI has a flat 1% land transfer tax with a first-time buyer exemption, and the smallest housing market in Canada by transaction volume. National lenders dominate; provincial credit unions are limited.",
    ltt: {
      summary:
        "PEI Real Property Transfer Tax: flat 1% of the greater of the purchase price or assessed value. On a $300,000 home that's $3,000.",
      fthbRebate:
        "First-time buyers are fully exempt from the 1% RPTT on homes purchased in PEI, with no price cap — provided the buyer is a Canadian citizen or permanent resident and occupies the home as a principal residence.",
    },
    fthbPrograms: [
      {
        name: "First-time Home Buyers' RPTT Exemption",
        summary:
          "100% exemption from PEI's 1% Real Property Transfer Tax. Save $3,000 on a $300,000 home. Eligibility: Canadian citizen / PR, 18+, never previously owned, occupy within 9 months.",
        link: "https://www.princeedwardisland.ca/en/information/finance/real-property-transfer-tax-first-time-home-buyer-exemption",
      },
    ],
    notes: [
      "Foreign buyers and non-residents face an additional 1% RPTT surcharge on PEI purchases.",
      "Provincial Credit Union is the main local alternative; offerings are limited compared to other provinces.",
    ],
  },

  QC: {
    code: "QC",
    slug: "quebec",
    name: "Quebec",
    capital: "Quebec City",
    headline:
      "Quebec runs on a unique notary-led closing system, charges a tiered welcome tax (Taxe de Bienvenue), and has the most distinct mortgage market in Canada — Desjardins, Caisses Populaires, and the Mouvement Desjardins network are the dominant lenders.",
    ltt: {
      summary:
        "Quebec's land transfer tax (Droit de mutation, popularly the 'Welcome Tax'): 0.5% on first $58,900; 1.0% on $58,900–$294,600; 1.5% on $294,600–$552,300; 2.0% on $552,300–$1,104,700; 2.5% on $1,104,700–$2,041,900; 3.0% above $2,041,900. Brackets are 2026 figures and indexed annually. On a $500,000 Montreal home that's $5,720.",
      municipal: {
        city: "Montreal",
        description:
          "Montreal charges higher brackets at the upper end (3.0% above $1,104,700 vs 2.0% in most of Quebec). Confirm rates with your notary — municipalities can deviate from the provincial schedule.",
      },
      fthbRebate:
        "Quebec offers the Home Buyers' Tax Credit (Crédit pour acquisition d'habitations) at the provincial level — up to $750 in tax savings, on top of the federal credit. No standalone provincial LTT exemption like Ontario or BC.",
    },
    fthbPrograms: [
      {
        name: "Home Buyers' Tax Credit (provincial)",
        summary:
          "Non-refundable tax credit worth up to $750 for first-time buyers. Calculated as 15% of $5,000. Stackable with the federal Home Buyers' Tax Credit.",
      },
      {
        name: "RénoVert / Habitation Verte",
        summary:
          "Various provincial energy-efficiency rebates that are technically post-purchase but worth factoring into total cost of ownership for new buyers.",
      },
    ],
    notes: [
      "Quebec uses a notary-based closing system rather than the lawyer-based system of common-law provinces. Notary fees are typically $1,200–$2,000 and are paid by the buyer.",
      "Desjardins is the dominant lender in Quebec — a federation of caisses populaires that operates as a credit union but with national-bank scale. Their rates are often a hair higher than the Big 6, but customer-service relationships are tighter.",
      "The Welcome Tax is normally paid 30–60 days after closing as a single bill, not at closing. Some buyers are surprised by this.",
    ],
  },

  SK: {
    code: "SK",
    slug: "saskatchewan",
    name: "Saskatchewan",
    capital: "Regina",
    headline:
      "Saskatchewan is the third province with no land transfer tax — buyers pay only nominal registration fees. National lenders compete with active provincial credit unions like Affinity and Conexus.",
    ltt: {
      summary:
        "Saskatchewan has no land transfer tax. Title registration fees apply: 0.4% of property value (capped at $375,000 for fee purposes; effective max around $1,500). On a $400,000 home expect about $1,500 in registration vs $0 in LTT.",
    },
    fthbPrograms: [
      {
        name: "Saskatchewan First-Time Home Buyers' Tax Credit (provincial)",
        summary:
          "Provincial non-refundable credit worth up to $1,050 (10.5% of $10,000) for first-time buyers. Stackable with the federal Home Buyers' Tax Credit ($1,500).",
        link: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31270-home-buyers-amount.html",
      },
    ],
    notes: [
      "Affinity Credit Union (largest in SK) and Conexus are not federally regulated and can apply their own qualification standards — useful for self-employed and farm-income buyers.",
      "Saskatoon and Regina have meaningfully different markets: Regina has been flatter; Saskatoon has been more volatile. Run affordability separately for each city if comparing.",
    ],
  },
};

/** All provinces sorted alphabetically by name. Territories filtered out
 *  via the Partial<Record> shape above. */
export const PROVINCES_LIST: ProvinceData[] = Object.values(PROVINCES)
  .filter((p): p is ProvinceData => p !== undefined)
  .sort((a, b) => a.name.localeCompare(b.name));

export function getProvinceBySlug(slug: string): ProvinceData | undefined {
  return PROVINCES_LIST.find((p) => p.slug === slug);
}
