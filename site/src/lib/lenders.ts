export interface LenderBrand {
  bg: string;
  abbr: string;
  /** When set, LenderBadge renders this logo image instead of the abbr badge. */
  logo?: string;
}

export const LENDER_BRANDS: Record<string, LenderBrand> = {
  rbc:        { bg: "#005DAA", abbr: "RBC",  logo: "/logos/rbc.svg" },
  td:         { bg: "#34B233", abbr: "TD",   logo: "/logos/td.svg" },
  bmo:        { bg: "#0075BE", abbr: "BMO",  logo: "/logos/bmo.svg" },
  scotiabank: { bg: "#EC111A", abbr: "BNS",  logo: "/logos/scotiabank.svg" },
  cibc:       { bg: "#AC145A", abbr: "CIBC", logo: "/logos/cibc.svg" },
  national:   { bg: "#E31837", abbr: "NBC",  logo: "/logos/national.svg" },
  tangerine:  { bg: "#F26520", abbr: "TAN",  logo: "/logos/tangerine.svg" },
  meridian:   { bg: "#00567D", abbr: "MER",  logo: "/logos/meridian.svg" },
  alterna:    { bg: "#5B6871", abbr: "ALT",  logo: "/logos/alterna.svg" },
  desjardins: { bg: "#00874E", abbr: "DESJ", logo: "/logos/desjardins.svg" },
  vancity:    { bg: "#EF2E31", abbr: "VAN",  logo: "/logos/vancity.svg" },
  "coast-capital": { bg: "#1476C6", abbr: "COAS", logo: "/logos/coast-capital.svg" },
  atb:        { bg: "#005CB9", abbr: "ATB",  logo: "/logos/atb.svg" },
  servus:     { bg: "#5DBB46", abbr: "SERV", logo: "/logos/servus.svg" },
};

export function getLenderBrand(slug: string): LenderBrand {
  return LENDER_BRANDS[slug] ?? { bg: "#6c757d", abbr: slug.slice(0, 4).toUpperCase() };
}
