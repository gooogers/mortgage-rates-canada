/**
 * Builders for JSON-LD structured data.
 *
 * Each function returns a plain object ready to be JSON.stringify'd into a
 * <script type="application/ld+json"> tag. We expose Organization and WebSite
 * sitewide via Base.astro, plus per-page builders (breadcrumbs, FAQ pages,
 * financial-service profiles) that pages opt in to.
 */

export const SITE_URL = "https://canadianrates.ca";
export const ORGANIZATION_NAME = "Canadian Rates";
export const ORGANIZATION_LOGO = `${SITE_URL}/favicon.svg`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION_NAME,
    url: SITE_URL,
    logo: ORGANIZATION_LOGO,
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ORGANIZATION_NAME,
    url: SITE_URL,
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Path relative to the site root, e.g. "/rates/5-year-fixed". */
  path: string;
}

export function breadcrumbSchema(trail: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: it.a,
      },
    })),
  };
}

export function financialServiceSchema(args: {
  name: string;
  url: string;
  pageUrl: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    name: args.name,
    url: args.url,
    mainEntityOfPage: args.pageUrl,
    serviceType: "Mortgage",
    areaServed: { "@type": "Country", name: "Canada" },
  };
}
