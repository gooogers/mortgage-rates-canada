export interface LenderBrand {
  bg: string;
  abbr: string;
  /** When set, LenderBadge renders this logo image instead of the abbr badge. */
  logo?: string;
}

export const LENDER_BRANDS: Record<string, LenderBrand> = {
  rbc:        { bg: "#005DAA", abbr: "RBC",  logo: "/logos/rbc.svg" },
  td:         { bg: "#34B233", abbr: "TD",   logo: "/logos/td.svg" },
  bmo:        { bg: "#0075BE", abbr: "BMO"  },
  scotiabank: { bg: "#EC111A", abbr: "BNS"  },
  cibc:       { bg: "#AC145A", abbr: "CIBC" },
  national:   { bg: "#E31837", abbr: "NBC"  },
  tangerine:  { bg: "#F26520", abbr: "TAN"  },
};

export function getLenderBrand(slug: string): LenderBrand {
  return LENDER_BRANDS[slug] ?? { bg: "#6c757d", abbr: slug.slice(0, 4).toUpperCase() };
}
