// Cloudflare Pages Function: returns the visitor's Canadian province (if
// detectable) so the homepage can default the province filter to their
// location. No personal data is logged or stored — only the two-letter
// region code from Cloudflare's edge network is read and returned.

export const onRequest = ({ request }) => {
  const cf = request.cf || {};
  const country = cf.country;
  const region = cf.regionCode || cf.region;

  let provinceCode = null;
  if (country === "CA" && typeof region === "string") {
    const code = region.toUpperCase();
    const valid = new Set([
      "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU",
      "ON", "PE", "QC", "SK", "YT",
    ]);
    if (valid.has(code)) provinceCode = code;
  }

  return new Response(JSON.stringify({ region: provinceCode }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};
