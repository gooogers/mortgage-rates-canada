# myfireplan.ca — Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable Astro site at `myfireplan.ca` with chrome (layout, nav, footer), affiliate redirect plumbing, chrome pages (About / Disclosure / Privacy / Terms), and a placeholder homepage. No calculators or content yet — that's Plan 2 and Plan 3.

**Architecture:** New Astro 4 site in a fresh git repo, Cloudflare Pages deployment, Cloudflare Functions for the `/go/[slug]` affiliate redirect with KV-backed click logging. Patterns and components copied (not shared) from the existing `mortgage-rates-canada` repo where applicable.

**Tech Stack:** Astro 4, TypeScript, Vitest, Cloudflare Pages, Cloudflare Functions, Cloudflare KV, MDX (configured but unused in Phase 1), js-yaml.

**Spec:** [`docs/superpowers/specs/2026-04-30-myfireplan-phase1-design.md`](../specs/2026-04-30-myfireplan-phase1-design.md) (in the `mortgage-rates-canada` repo).

**Working directory convention:** All commands in this plan are run from `C:\Users\CSR\Documents\Claude\myfireplan` (the new repo) unless explicitly noted otherwise.

---

## Task 0: Manual prerequisites (non-blocking, run in parallel)

These are external tasks that don't block code work but need to start now since they have lead times.

**Files:** none

- [ ] **Step 1: Buy the domain `myfireplan.ca`**

Use any registrar (Namecheap, Cloudflare Registrar, hover.com). If the domain is unavailable, stop and revisit branding before continuing this plan — the design assumes this domain.

- [ ] **Step 2: Apply for affiliate programs**

Apply for each in parallel. Approvals take 1–4 weeks.

- Wealthsimple affiliate: https://www.wealthsimple.com/en-ca/legal/affiliate (or current canonical URL — search "Wealthsimple affiliate program")
- Questrade affiliate: https://www.questrade.com (search their footer for "Affiliate" or "Refer a Friend")
- Qtrade affiliate: contact via their site
- Passiv affiliate: https://passiv.com (check their footer)
- Interactive Brokers Canada referral: https://www.interactivebrokers.ca

Record application status in a new file `affiliate-applications.md` in the repo root once Task 1 is complete:

```markdown
# Affiliate Applications

| Program | Applied | Approved | Affiliate URL | Notes |
|---|---|---|---|---|
| Wealthsimple | YYYY-MM-DD | — | — | |
| Questrade | YYYY-MM-DD | — | — | |
| Qtrade | YYYY-MM-DD | — | — | |
| Passiv | YYYY-MM-DD | — | — | |
| IBKR Canada | YYYY-MM-DD | — | — | |
```

- [ ] **Step 3: Decide click-logging storage**

For Phase 1, use Cloudflare KV (simpler, free tier covers expected volume). D1 is a Phase 2 upgrade if click volume exceeds KV's free-tier write limits (1k writes/day).

No action — just confirms the design choice.

---

## Task 1: Create new repo and Astro scaffold

**Files:**
- Create: `C:\Users\CSR\Documents\Claude\myfireplan\` (new directory)
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Create the directory and initialize git**

Run from `C:\Users\CSR\Documents\Claude`:

```bash
mkdir myfireplan
cd myfireplan
git init
```

Expected: empty git repo at `C:\Users\CSR\Documents\Claude\myfireplan`.

- [ ] **Step 2: Scaffold Astro with the minimal template**

```bash
npm create astro@latest -- --template minimal --typescript strict --install --git no --skip-houston --yes .
```

Expected: Astro project files created in current directory. `package.json`, `astro.config.mjs`, `src/pages/index.astro`, `tsconfig.json` present.

- [ ] **Step 3: Add MDX, sitemap, and Vitest dependencies**

```bash
npm install @astrojs/mdx @astrojs/sitemap js-yaml
npm install -D @astrojs/check vitest @types/js-yaml @types/node
```

Expected: dependencies appear in `package.json`. No errors.

- [ ] **Step 4: Replace `astro.config.mjs` with the project config**

Create `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import { fileURLToPath } from "url";
import path from "path";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [mdx(), sitemap()],
  site: "https://myfireplan.ca",
  trailingSlash: "never",
  build: { format: "file" },
  vite: {
    resolve: {
      alias: {
        "@lib": path.resolve(__dirname, "src/lib"),
        "@components": path.resolve(__dirname, "src/components"),
        "@layouts": path.resolve(__dirname, "src/layouts"),
      },
    },
  },
});
```

- [ ] **Step 5: Update `package.json` scripts**

Replace the `scripts` block in `package.json` with:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Also update `"name"` to `"myfireplan"` and `"version"` to `"0.1.0"`. Set `"private": true` and `"type": "module"`.

- [ ] **Step 6: Add `.gitignore`**

Create `.gitignore`:

```
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
.wrangler/
.DS_Store
*.log
```

- [ ] **Step 7: Add minimal README**

Create `README.md`:

```markdown
# myfireplan.ca

Canadian FIRE planning site — calculators, guides, opinionated brokerage picks.

## Stack

Astro 4 + Cloudflare Pages + Cloudflare Functions + KV.

## Develop

```bash
npm install
npm run dev
```

## Deploy

Pushes to `main` trigger a Cloudflare Pages build.
```

- [ ] **Step 8: Verify build succeeds**

Run:

```bash
npm run check && npm run build
```

Expected: both succeed with zero errors. `dist/` directory created.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initial Astro scaffold for myfireplan.ca"
```

---

## Task 2: Port global styles and CSS variables

**Files:**
- Create: `src/styles/global.css`
- Reference: `C:\Users\CSR\Documents\Claude\mortgage-rates-canada\site\src\styles\global.css`

- [ ] **Step 1: Copy `global.css` from the existing site**

From the existing site, copy `site/src/styles/global.css` to the new repo at `src/styles/global.css`. Read it first to confirm contents:

```bash
# in mortgage-rates-canada repo
cat site/src/styles/global.css
```

Then create the same file in the myfireplan repo. Adjust brand colors only if you have a defined palette already; otherwise keep the existing palette and update later when the brand is finalized.

- [ ] **Step 2: Verify build still succeeds**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: port global styles from mortgage-rates-canada"
```

---

## Task 3: Port and adapt the Base layout

**Files:**
- Create: `src/layouts/Base.astro`
- Create: `src/lib/staging.ts`
- Create: `src/lib/schemas.ts`

- [ ] **Step 1: Create `src/lib/staging.ts`**

```ts
export function isStagingFromEnv(env: { STAGING?: string | boolean }): boolean {
  return env.STAGING === "true" || env.STAGING === true;
}

export function isStaging(): boolean {
  // import.meta.env is statically replaced at Astro build time based on env vars.
  return isStagingFromEnv(import.meta.env as { STAGING?: string | boolean });
}
```

- [ ] **Step 2: Create `src/lib/schemas.ts`**

```ts
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "myfireplan.ca",
    url: "https://myfireplan.ca",
    logo: "https://myfireplan.ca/favicon.svg",
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "myfireplan.ca",
    url: "https://myfireplan.ca",
    description: "Canadian FIRE planning — calculators, guides, brokerage picks.",
  };
}
```

- [ ] **Step 3: Write a test for `isStagingFromEnv`**

Create `src/lib/staging.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isStagingFromEnv } from "./staging";

describe("isStagingFromEnv", () => {
  it("returns true for the string 'true'", () => {
    expect(isStagingFromEnv({ STAGING: "true" })).toBe(true);
  });
  it("returns true for the boolean true", () => {
    expect(isStagingFromEnv({ STAGING: true })).toBe(true);
  });
  it("returns false for 'false'", () => {
    expect(isStagingFromEnv({ STAGING: "false" })).toBe(false);
  });
  it("returns false for undefined", () => {
    expect(isStagingFromEnv({})).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(isStagingFromEnv({ STAGING: "" })).toBe(false);
  });
});
```

- [ ] **Step 4: Create `vitest.config.ts` so path aliases resolve**

```ts
import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "src/lib"),
      "@components": path.resolve(__dirname, "src/components"),
      "@layouts": path.resolve(__dirname, "src/layouts"),
    },
  },
});
```

- [ ] **Step 4a: Run the test (expect PASS — implementation already exists from Step 1)**

```bash
npm run test
```

Expected: PASS (5 tests).

- [ ] **Step 5: Create `src/layouts/Base.astro`**

```astro
---
import { isStaging } from "@lib/staging";
import { organizationSchema, websiteSchema } from "@lib/schemas";
import "../styles/global.css";

interface Props {
  title: string;
  description?: string;
  canonical?: string;
  schemas?: Record<string, unknown>[];
}

const { title, description, canonical, schemas = [] } = Astro.props;
const fullTitle = title.includes("myfireplan")
  ? title
  : `${title} — myfireplan.ca`;
const staging = isStaging();
const allSchemas = [organizationSchema(), websiteSchema(), ...schemas];
---

<!doctype html>
<html lang="en-CA">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    {description && <meta name="description" content={description} />}
    {canonical && <link rel="canonical" href={canonical} />}
    {staging && <meta name="robots" content="noindex, nofollow" />}
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    {allSchemas.map((s) => (
      <script is:inline type="application/ld+json" set:html={JSON.stringify(s)} />
    ))}
  </head>
  <body>
    <!-- TopNav and Footer are wired in via direct imports in Task 4. -->
    <main>
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 6: Create a placeholder favicon**

Create `public/favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#0066cc"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif" font-weight="bold">F</text></svg>
```

(Replace with proper brand icon once visual identity is decided.)

- [ ] **Step 7: Run build to verify**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Base layout, staging detection, JSON-LD schemas"
```

---

## Task 4: Build top navigation and footer components

**Files:**
- Create: `src/components/TopNav.astro`
- Create: `src/components/Footer.astro`
- Modify: `src/layouts/Base.astro` — wire TopNav + Footer into named slots

- [ ] **Step 1: Create `src/components/TopNav.astro`**

```astro
---
const path = Astro.url.pathname;
const isActive = (href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
---

<header class="site-header">
  <a href="/" class="site-header__brand" aria-label="myfireplan.ca — home">
    <span class="brand-mark">🍁</span>
    <span class="brand-name">myfireplan</span>
  </a>
  <nav class="site-header__nav" aria-label="Primary">
    <a href="/plan" class:list={[{ active: isActive("/plan") }]}>My Plan</a>
    <a href="/calculators" class:list={[{ active: isActive("/calculators") }]}>Calculators</a>
    <a href="/guides" class:list={[{ active: isActive("/guides") }]}>Guides</a>
    <a href="/brokerages" class:list={[{ active: isActive("/brokerages") }]}>Brokerage</a>
    <a href="/about" class:list={[{ active: isActive("/about") }]}>About</a>
  </nav>
</header>

<style>
  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-surface, #ffffff);
  }
  .site-header__brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 1.1rem;
    text-decoration: none;
    color: inherit;
  }
  .brand-mark { font-size: 1.4rem; }
  .site-header__nav {
    display: flex;
    gap: 1.25rem;
    align-items: center;
  }
  .site-header__nav a {
    text-decoration: none;
    color: var(--color-muted, #4b5563);
    font-size: 0.95rem;
  }
  .site-header__nav a.active {
    color: var(--color-text, #111827);
    font-weight: 600;
  }
  .site-header__nav a:hover { color: var(--color-text, #111827); }
  @media (max-width: 640px) {
    .site-header { flex-direction: column; gap: 0.5rem; }
    .site-header__nav { flex-wrap: wrap; gap: 0.75rem; }
  }
</style>
```

- [ ] **Step 2: Create `src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---

<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__brand">
      <strong>myfireplan.ca</strong>
      <p>Canadian FIRE planning, with the math written out.</p>
    </div>
    <nav class="site-footer__nav" aria-label="Footer">
      <a href="/about">About</a>
      <a href="/disclosure">Affiliate disclosure</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
  <p class="site-footer__copy">© {year} myfireplan.ca. Not financial advice.</p>
</footer>

<style>
  .site-footer {
    padding: 2rem 1.25rem 1.25rem;
    border-top: 1px solid var(--color-border, #e5e7eb);
    margin-top: 4rem;
    color: var(--color-muted, #4b5563);
    font-size: 0.9rem;
  }
  .site-footer__inner {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1.5rem;
  }
  .site-footer__brand p { margin: 0.25rem 0 0; max-width: 32ch; }
  .site-footer__nav { display: flex; gap: 1rem; flex-wrap: wrap; }
  .site-footer__nav a { color: inherit; }
  .site-footer__copy { margin-top: 1.5rem; font-size: 0.8rem; }
</style>
```

- [ ] **Step 3: Update `src/layouts/Base.astro` to include TopNav + Footer directly**

Replace the body section of `src/layouts/Base.astro`:

```astro
  <body>
    <TopNav />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
```

And add the imports at the top of the frontmatter (after the existing imports):

```astro
import TopNav from "@components/TopNav.astro";
import Footer from "@components/Footer.astro";
```

(The Task 3 layout left a placeholder comment in `<body>` for this; replacing the comment with `<TopNav />` + the existing `<main>` + `<Footer />` is the change.)

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run dev and visually verify the nav and footer render**

```bash
npm run dev
```

Open `http://localhost:4321` in a browser. Expected: top nav with five links, footer with About/Disclosure/Privacy/Terms, copyright line.

Stop the dev server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add TopNav and Footer components, wire into Base layout"
```

---

## Task 5: Port the AffiliateDisclosure component

**Files:**
- Create: `src/components/AffiliateDisclosure.astro`

- [ ] **Step 1: Create the component**

```astro
---
// Renders a small inline note pointing to /disclosure.
// Render this on every page that contains an affiliate CTA.
---

<aside class="disclosure" role="note">
  <p>
    We earn a commission when you apply through some links. See our
    <a href="/disclosure">affiliate disclosure</a>.
  </p>
</aside>

<style>
  .disclosure {
    background: var(--color-surface, #f7f9fb);
    border-left: 3px solid var(--color-accent, #0066cc);
    padding: 0.5rem 0.75rem;
    margin: 0 0 1.5rem;
    font-size: 0.85rem;
    color: var(--color-muted, #4b5563);
  }
  .disclosure p { margin: 0; }
</style>
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AffiliateDisclosure.astro
git commit -m "feat: add AffiliateDisclosure component"
```

---

## Task 6: Build the brokerages YAML loader and `/go/[slug]` redirect

**Files:**
- Create: `src/data/brokerages.yaml` (placeholder data so the redirect has something to look up)
- Create: `src/lib/brokerages.ts`
- Create: `src/lib/brokerages.test.ts`
- Create: `functions/go/[slug].ts` (Cloudflare Pages Function)

- [ ] **Step 1: Create the placeholder brokerages YAML**

`src/data/brokerages.yaml`:

```yaml
- slug: wealthsimple
  name: Wealthsimple
  affiliate_url: https://www.wealthsimple.com/  # replace with real affiliate URL once approved
  affiliate_network: direct
  pick_this_if: "you want the simplest Canadian brokerage with $0 trades and a clean mobile app"
- slug: questrade
  name: Questrade
  affiliate_url: https://www.questrade.com/  # replace with real affiliate URL once approved
  affiliate_network: direct
  pick_this_if: "you want USD accounts, free ETF buys, and an established Norbert's Gambit story"
- slug: qtrade
  name: Qtrade
  affiliate_url: https://www.qtrade.ca/
  affiliate_network: direct
  pick_this_if: "you want a Questrade alternative with strong customer service"
- slug: nbdb
  name: National Bank Direct Brokerage
  affiliate_url: https://nbdb.ca/
  affiliate_network: direct
  pick_this_if: "you want $0 commissions backed by a big bank"
- slug: ibkr-canada
  name: Interactive Brokers Canada
  affiliate_url: https://www.interactivebrokers.ca/
  affiliate_network: direct
  pick_this_if: "you trade actively and want pro-grade tools and tiered pricing"
- slug: ci-direct
  name: CI Direct Investing
  affiliate_url: https://www.cidirectinvesting.com/
  affiliate_network: direct
  pick_this_if: "you want a robo-advisor managing your portfolio for you"
```

- [ ] **Step 2: Write the test for the brokerages loader**

`src/lib/brokerages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadBrokerages, findBrokerageBySlug } from "./brokerages";

describe("loadBrokerages", () => {
  it("loads the brokerages list and parses each entry", () => {
    const list = loadBrokerages();
    expect(list.length).toBeGreaterThan(0);
    for (const b of list) {
      expect(b.slug).toMatch(/^[a-z0-9-]+$/);
      expect(b.name).toBeTruthy();
      expect(b.affiliate_url).toMatch(/^https?:\/\//);
      expect(b.pick_this_if).toBeTruthy();
    }
  });

  it("includes Wealthsimple and Questrade", () => {
    const list = loadBrokerages();
    const slugs = list.map((b) => b.slug);
    expect(slugs).toContain("wealthsimple");
    expect(slugs).toContain("questrade");
  });
});

describe("findBrokerageBySlug", () => {
  it("returns the brokerage when slug matches", () => {
    const b = findBrokerageBySlug("wealthsimple");
    expect(b).toBeTruthy();
    expect(b!.name).toBe("Wealthsimple");
  });

  it("returns null when slug is unknown", () => {
    const b = findBrokerageBySlug("does-not-exist");
    expect(b).toBeNull();
  });

  it("returns null for empty slug", () => {
    expect(findBrokerageBySlug("")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test (expect FAIL — module doesn't exist yet)**

```bash
npm run test
```

Expected: FAIL with "Cannot find module './brokerages'".

- [ ] **Step 4: Implement `src/lib/brokerages.ts`**

```ts
import yaml from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Brokerage {
  slug: string;
  name: string;
  affiliate_url: string;
  affiliate_network: string;
  pick_this_if: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../data/brokerages.yaml");

let cache: Brokerage[] | null = null;

export function loadBrokerages(): Brokerage[] {
  if (cache) return cache;
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const parsed = yaml.load(raw) as Brokerage[];
  cache = parsed;
  return parsed;
}

export function findBrokerageBySlug(slug: string): Brokerage | null {
  if (!slug) return null;
  return loadBrokerages().find((b) => b.slug === slug) ?? null;
}
```

- [ ] **Step 5: Run the test (expect PASS)**

```bash
npm run test
```

Expected: PASS (5 tests across both describe blocks).

- [ ] **Step 6: Implement `functions/go/[slug].ts` Cloudflare Function**

This file is a Cloudflare Pages Function. It runs at the edge, not at build time, so it does NOT use the `loadBrokerages` Node module above (which uses `node:fs`). The function reads brokerage data from a build-time-generated JSON file served as a static asset.

First, create `scripts/generate-brokerages-json.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const yamlPath = path.resolve(__dirname, "../src/data/brokerages.yaml");
const outPath = path.resolve(__dirname, "../public/brokerages.json");

const raw = fs.readFileSync(yamlPath, "utf-8");
const data = yaml.load(raw);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`Generated ${outPath} with ${data.length} brokerages`);
```

Then add to `package.json` scripts (replace the existing `build` script):

```json
"prebuild": "node scripts/generate-brokerages-json.mjs",
"build": "astro build",
```

Run `npm run prebuild` once now to generate the file:

```bash
npm run prebuild
```

Expected: `public/brokerages.json` created with the 6 brokerages.

Now create `functions/go/[slug].ts`:

```ts
interface Env {
  CLICKS?: KVNamespace;
}

interface Brokerage {
  slug: string;
  name: string;
  affiliate_url: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const slug = String(params.slug || "").toLowerCase();
  const url = new URL(request.url);

  // Fetch the brokerages registry from the static asset (same origin).
  const registryUrl = new URL("/brokerages.json", url.origin).toString();
  let brokerages: Brokerage[] = [];
  try {
    const res = await fetch(registryUrl);
    if (res.ok) brokerages = await res.json();
  } catch {
    // fall through to homepage redirect
  }

  const match = brokerages.find((b) => b.slug === slug);
  if (!match) {
    return Response.redirect(new URL("/", url.origin).toString(), 302);
  }

  // Best-effort click logging (KV). Never block the redirect on logging failure.
  if (env.CLICKS) {
    const key = `${slug}:${new Date().toISOString().slice(0, 10)}`;
    try {
      const current = parseInt((await env.CLICKS.get(key)) || "0", 10);
      await env.CLICKS.put(key, String(current + 1));
    } catch {
      // ignore
    }
  }

  // Append UTM params to the affiliate URL.
  const target = new URL(match.affiliate_url);
  target.searchParams.set("utm_source", "myfireplan.ca");
  target.searchParams.set("utm_medium", "referral");
  const campaign = url.searchParams.get("from") || "site";
  target.searchParams.set("utm_campaign", campaign);

  return Response.redirect(target.toString(), 302);
};
```

- [ ] **Step 7: Add a Vitest unit test for the redirect logic**

Cloudflare Functions are awkward to unit-test directly, but we can test the URL-building logic by extracting it. Create `functions/go/redirect-helpers.ts`:

```ts
export interface Brokerage {
  slug: string;
  name: string;
  affiliate_url: string;
}

export function buildAffiliateRedirect(
  brokerage: Brokerage,
  campaign = "site",
): string {
  const target = new URL(brokerage.affiliate_url);
  target.searchParams.set("utm_source", "myfireplan.ca");
  target.searchParams.set("utm_medium", "referral");
  target.searchParams.set("utm_campaign", campaign);
  return target.toString();
}

export function findBrokerageBySlugInList(
  list: Brokerage[],
  slug: string,
): Brokerage | null {
  if (!slug) return null;
  return list.find((b) => b.slug === slug.toLowerCase()) ?? null;
}
```

Refactor `functions/go/[slug].ts` to use these helpers (replace the body):

```ts
import { buildAffiliateRedirect, findBrokerageBySlugInList } from "./redirect-helpers";

interface Env {
  CLICKS?: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const slug = String(params.slug || "").toLowerCase();
  const url = new URL(request.url);

  const registryUrl = new URL("/brokerages.json", url.origin).toString();
  let brokerages = [];
  try {
    const res = await fetch(registryUrl);
    if (res.ok) brokerages = await res.json();
  } catch {
    // fall through
  }

  const match = findBrokerageBySlugInList(brokerages, slug);
  if (!match) return Response.redirect(new URL("/", url.origin).toString(), 302);

  if (env.CLICKS) {
    const key = `${slug}:${new Date().toISOString().slice(0, 10)}`;
    try {
      const current = parseInt((await env.CLICKS.get(key)) || "0", 10);
      await env.CLICKS.put(key, String(current + 1));
    } catch {}
  }

  const campaign = url.searchParams.get("from") || "site";
  return Response.redirect(buildAffiliateRedirect(match, campaign), 302);
};
```

Now create `functions/go/redirect-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAffiliateRedirect, findBrokerageBySlugInList } from "./redirect-helpers";

const sample = [
  {
    slug: "wealthsimple",
    name: "Wealthsimple",
    affiliate_url: "https://www.wealthsimple.com/",
  },
  {
    slug: "questrade",
    name: "Questrade",
    affiliate_url: "https://www.questrade.com/?ref=abc",
  },
];

describe("findBrokerageBySlugInList", () => {
  it("matches case-insensitively", () => {
    expect(findBrokerageBySlugInList(sample, "WEALTHSIMPLE")?.name).toBe("Wealthsimple");
  });
  it("returns null for unknown", () => {
    expect(findBrokerageBySlugInList(sample, "fake")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(findBrokerageBySlugInList(sample, "")).toBeNull();
  });
});

describe("buildAffiliateRedirect", () => {
  it("appends UTM params to a clean URL", () => {
    const url = new URL(buildAffiliateRedirect(sample[0], "calculator"));
    expect(url.searchParams.get("utm_source")).toBe("myfireplan.ca");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
    expect(url.searchParams.get("utm_campaign")).toBe("calculator");
  });

  it("preserves existing query params on the affiliate URL", () => {
    const url = new URL(buildAffiliateRedirect(sample[1], "footer"));
    expect(url.searchParams.get("ref")).toBe("abc");
    expect(url.searchParams.get("utm_source")).toBe("myfireplan.ca");
  });

  it("defaults campaign to 'site'", () => {
    const url = new URL(buildAffiliateRedirect(sample[0]));
    expect(url.searchParams.get("utm_campaign")).toBe("site");
  });
});
```

- [ ] **Step 8: Run all tests**

```bash
npm run test
```

Expected: PASS — 11 tests total (3 staging, 5 brokerages, 6 redirect-helpers... actually count varies; just confirm all green).

- [ ] **Step 9: Build to ensure Astro doesn't choke on `functions/`**

```bash
npm run build
```

Expected: PASS. Note: Astro ignores `functions/` — Cloudflare Pages picks it up at deploy time.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add /go/[slug] affiliate redirect with KV click logging"
```

---

## Task 7: Build chrome pages — About, Disclosure, Privacy, Terms

**Files:**
- Create: `src/pages/about.astro`
- Create: `src/pages/disclosure.astro`
- Create: `src/pages/privacy.astro`
- Create: `src/pages/terms.astro`

- [ ] **Step 1: Create `src/pages/about.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="About"
  description="myfireplan.ca is a Canadian FIRE planning site — calculators, guides, and opinionated brokerage picks."
  canonical="https://myfireplan.ca/about"
>
  <article class="prose">
    <h1>About myfireplan.ca</h1>
    <p>
      myfireplan.ca is a Canadian FIRE planning site for people who want the math
      written out — not hand-waved. We build calculators with proper Canadian tax
      treatment (RRSP, TFSA, FHSA), publish opinionated guides, and recommend
      brokerages we'd actually use.
    </p>
    <h2>What we cover</h2>
    <ul>
      <li>Should you invest or pay down your mortgage? (Tax-aware calculator.)</li>
      <li>Coast FIRE for Canadians, including CPP and OAS interactions.</li>
      <li>RRSP vs TFSA — the math, not the vibes.</li>
      <li>Which Canadian brokerage actually fits your situation.</li>
    </ul>
    <h2>How we make money</h2>
    <p>
      We earn affiliate commissions when readers open accounts through some of our
      links. Recommendations are based on what we think fits the reader's situation,
      not on which partner pays us most. See our
      <a href="/disclosure">affiliate disclosure</a> for the full list of partners.
    </p>
    <h2>Not financial advice</h2>
    <p>
      We are not licensed financial advisors. Everything on this site is for
      educational purposes. Talk to a fee-only advisor before making major decisions.
    </p>
  </article>
</Base>

<style>
  .prose { max-width: 65ch; margin: 2rem auto; padding: 0 1rem; }
  .prose h1 { font-size: 2rem; }
  .prose h2 { margin-top: 2rem; }
  .prose ul { padding-left: 1.5rem; }
</style>
```

- [ ] **Step 2: Create `src/pages/disclosure.astro`**

```astro
---
import Base from "@layouts/Base.astro";
import { loadBrokerages } from "@lib/brokerages";

const brokerages = loadBrokerages();
---

<Base
  title="Affiliate disclosure"
  description="How myfireplan.ca makes money and which partners we have affiliate relationships with."
  canonical="https://myfireplan.ca/disclosure"
>
  <article class="prose">
    <h1>Affiliate disclosure</h1>
    <p>
      myfireplan.ca earns affiliate commissions when readers open accounts through
      some of our outbound links. This is how the site is funded.
    </p>
    <h2>Active affiliate partners</h2>
    <p>
      As of today, we have affiliate or referral relationships with the following
      Canadian brokerages:
    </p>
    <ul>
      {brokerages.map((b) => <li>{b.name}</li>)}
    </ul>
    <h2>How recommendations are made</h2>
    <p>
      We recommend brokerages based on what we think fits your situation, not on which
      partner pays the highest commission. Where two brokerages serve the same
      audience, we say so. Where we think you should pick a non-affiliate option,
      we say that too.
    </p>
    <h2>Transparency on links</h2>
    <p>
      Outbound brokerage links route through <code>myfireplan.ca/go/[slug]</code>,
      which logs the click and adds tracking parameters before redirecting you to the
      partner site. You can always go to the partner site directly without using our
      link.
    </p>
    <h2>Not financial advice</h2>
    <p>
      Everything on this site is for educational purposes only. We are not licensed
      financial advisors.
    </p>
  </article>
</Base>

<style>
  .prose { max-width: 65ch; margin: 2rem auto; padding: 0 1rem; }
  .prose h1 { font-size: 2rem; }
  .prose h2 { margin-top: 2rem; }
  .prose ul { padding-left: 1.5rem; }
  .prose code { background: var(--color-surface, #f7f9fb); padding: 0.1rem 0.3rem; border-radius: 3px; }
</style>
```

- [ ] **Step 3: Create `src/pages/privacy.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="Privacy"
  description="myfireplan.ca privacy policy."
  canonical="https://myfireplan.ca/privacy"
>
  <article class="prose">
    <h1>Privacy policy</h1>
    <p><strong>Last updated:</strong> 2026-04-30</p>
    <h2>What we collect</h2>
    <p>
      myfireplan.ca uses Cloudflare's standard analytics (page views, country,
      referrer). We do not run third-party tracking scripts. Calculator inputs you
      enter are processed in your browser and are not sent to our servers.
    </p>
    <h2>Affiliate clicks</h2>
    <p>
      When you click an outbound brokerage link, we record the brokerage slug and
      date so we can count clicks. We do not record your IP address, browser
      fingerprint, or any personal information. Tracking parameters added to the
      destination URL identify myfireplan.ca as the referrer to the brokerage.
    </p>
    <h2>Cookies</h2>
    <p>We do not set tracking cookies. Cloudflare may set anti-bot cookies.</p>
    <h2>Contact</h2>
    <p>Privacy questions: hello@myfireplan.ca (replace with real address before launch).</p>
  </article>
</Base>

<style>
  .prose { max-width: 65ch; margin: 2rem auto; padding: 0 1rem; }
  .prose h1 { font-size: 2rem; }
  .prose h2 { margin-top: 2rem; }
</style>
```

- [ ] **Step 4: Create `src/pages/terms.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="Terms"
  description="myfireplan.ca terms of use."
  canonical="https://myfireplan.ca/terms"
>
  <article class="prose">
    <h1>Terms of use</h1>
    <p><strong>Last updated:</strong> 2026-04-30</p>
    <h2>Educational content only</h2>
    <p>
      Everything on myfireplan.ca is for educational and informational purposes. We
      are not licensed financial advisors, accountants, or lawyers. Nothing on this
      site is personalized financial advice.
    </p>
    <h2>Calculator accuracy</h2>
    <p>
      Calculators state their assumptions explicitly. They are simplifications of the
      real world. Tax rules, market returns, and individual situations vary. Always
      verify before acting.
    </p>
    <h2>Affiliate links</h2>
    <p>
      We earn commissions through some outbound links. See <a href="/disclosure">our
      affiliate disclosure</a>.
    </p>
    <h2>No liability</h2>
    <p>
      We provide this site as-is. We are not liable for decisions you make based on
      information here. Make decisions with a qualified professional.
    </p>
  </article>
</Base>

<style>
  .prose { max-width: 65ch; margin: 2rem auto; padding: 0 1rem; }
  .prose h1 { font-size: 2rem; }
  .prose h2 { margin-top: 2rem; }
</style>
```

- [ ] **Step 5: Build to verify all four pages render**

```bash
npm run build
```

Expected: PASS. `dist/about.html`, `dist/disclosure.html`, `dist/privacy.html`, `dist/terms.html` all exist.

- [ ] **Step 6: Verify in dev**

```bash
npm run dev
```

Visit each of `/about`, `/disclosure`, `/privacy`, `/terms`. Confirm the nav is present, the content renders, and the footer is at the bottom. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add About, Disclosure, Privacy, Terms pages"
```

---

## Task 8: Build the placeholder homepage

**Files:**
- Modify: `src/pages/index.astro` (overwrite the Astro default)

- [ ] **Step 1: Overwrite `src/pages/index.astro`**

```astro
---
import Base from "@layouts/Base.astro";
---

<Base
  title="myfireplan.ca — Canadian FIRE planning, with the math written out"
  description="Tax-aware Canadian FIRE calculators, opinionated guides, and brokerage picks."
  canonical="https://myfireplan.ca/"
>
  <section class="hero">
    <h1>Canadian FIRE planning, with the math written out.</h1>
    <p class="lede">
      Tax-aware calculators for the questions that actually matter:
      should you invest or pay down your mortgage? How early can you Coast FIRE?
      RRSP or TFSA?
    </p>
    <p class="cta-row">
      <a href="/plan" class="cta cta--primary">Start your plan</a>
      <a href="/calculators" class="cta cta--secondary">Browse calculators</a>
    </p>
  </section>
  <section class="placeholder-note">
    <p>
      <strong>Site is under construction.</strong> Calculators and guides ship in the
      next two phases.
    </p>
  </section>
</Base>

<style>
  .hero {
    max-width: 60ch;
    margin: 4rem auto 2rem;
    padding: 0 1rem;
    text-align: center;
  }
  .hero h1 { font-size: 2.25rem; margin: 0 0 1rem; line-height: 1.2; }
  .lede { font-size: 1.1rem; color: var(--color-muted, #4b5563); margin: 0 0 2rem; }
  .cta-row { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
  .cta {
    display: inline-block;
    padding: 0.65rem 1.25rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
  }
  .cta--primary { background: var(--color-accent, #0066cc); color: white; }
  .cta--secondary { border: 1px solid var(--color-border, #e5e7eb); color: inherit; }
  .placeholder-note {
    max-width: 60ch;
    margin: 2rem auto;
    padding: 0.75rem 1rem;
    background: var(--color-surface, #f7f9fb);
    border-left: 3px solid var(--color-accent, #0066cc);
    font-size: 0.9rem;
    color: var(--color-muted, #4b5563);
  }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
npm run build && npm run dev
```

Visit `http://localhost:4321/`. Expected: hero with H1, lede, two CTAs, placeholder note. Nav and footer present. Stop dev.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add placeholder homepage with hero + CTAs"
```

---

## Task 9: Add staging robots.txt

**Files:**
- Create: `public/robots.txt`

- [ ] **Step 1: Create `public/robots.txt`**

```
User-agent: *
Disallow: /
```

(This blocks indexing across the board until the site is ready to launch. Replace with `Allow: /` and a `Sitemap:` line at launch.)

- [ ] **Step 2: Build and confirm `dist/robots.txt` is present**

```bash
npm run build
ls dist/robots.txt
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add public/robots.txt
git commit -m "chore: block indexing via robots.txt during staging"
```

---

## Task 10: Set up GitHub remote and push

**Files:** none

- [ ] **Step 1: Create the GitHub repo**

Use `gh` CLI:

```bash
gh repo create myfireplan --private --source=. --remote=origin --push
```

Expected: GitHub repo `<your-username>/myfireplan` created (private), and the local `main` branch pushed.

If `gh repo create` fails or you prefer the web UI: create the repo at https://github.com/new, then run:

```bash
git remote add origin https://github.com/<your-username>/myfireplan.git
git push -u origin main
```

- [ ] **Step 2: Verify the push**

```bash
git log --oneline -5
```

Expected: commits visible. `gh repo view --web` opens the repo in a browser.

---

## Task 11: Connect to Cloudflare Pages and deploy

**Files:**
- Create: `wrangler.toml` (optional — only if using `wrangler pages` CLI; the Cloudflare dashboard works without it)

- [ ] **Step 1: Create the Cloudflare Pages project via the dashboard**

Manually:
1. Log into Cloudflare → Pages → Create application → Connect to Git
2. Select the `myfireplan` repo
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Environment variables (production):
   - `STAGING=true` (until launch)
   - `NODE_VERSION=20`
6. Save and deploy

- [ ] **Step 2: Wait for first build to complete**

Watch the build in the Cloudflare dashboard or via:

```bash
gh run list --limit 5  # not directly applicable; check CF dashboard
```

Expected: build succeeds, deployment URL is `https://myfireplan.pages.dev` (or similar).

- [ ] **Step 3: Visit the deployed site and verify**

Open `https://myfireplan.pages.dev/` (replace with actual URL):
- Homepage renders
- Nav works (click About, Disclosure, Privacy, Terms — all render)
- Footer renders
- View page source: `<meta name="robots" content="noindex, nofollow" />` is present (because STAGING=true)
- Visit `/robots.txt` — should show `Disallow: /`

- [ ] **Step 4: Test the `/go/[slug]` redirect**

In a browser, visit `https://myfireplan.pages.dev/go/wealthsimple`. Expected: 302 redirect to `https://www.wealthsimple.com/?utm_source=myfireplan.ca&utm_medium=referral&utm_campaign=site`.

Visit `/go/does-not-exist`. Expected: 302 redirect to homepage.

- [ ] **Step 5: Bind the KV namespace for click logging**

In Cloudflare dashboard:
1. Workers & Pages → KV → Create namespace → name it `myfireplan-clicks`
2. Pages → myfireplan project → Settings → Functions → KV namespace bindings
3. Add binding: variable name `CLICKS`, namespace `myfireplan-clicks`
4. Save

Trigger a redeploy (push an empty commit if needed):

```bash
git commit --allow-empty -m "chore: trigger redeploy after KV binding"
git push
```

- [ ] **Step 6: Verify KV logging**

Visit `/go/wealthsimple` two or three times. Then in Cloudflare dashboard → KV → `myfireplan-clicks`, look for a key like `wealthsimple:2026-04-30`. Expected: value increments with each click.

- [ ] **Step 7: Connect the custom domain `myfireplan.ca`**

In Cloudflare dashboard:
1. Pages → myfireplan project → Custom domains → Set up a custom domain
2. Enter `myfireplan.ca`
3. Cloudflare auto-creates the DNS records if the domain is on Cloudflare; otherwise add them at your registrar

Wait for DNS to propagate (usually < 5 min if using Cloudflare DNS). Visit `https://myfireplan.ca/` — expected: same homepage as the `pages.dev` URL.

---

## Task 12: Final verification and tag

**Files:** none

- [ ] **Step 1: Run full local validation**

```bash
npm run check
npm run test
npm run build
```

Expected: all pass with zero errors.

- [ ] **Step 2: Verify production deployment**

Visit `https://myfireplan.ca/` and check:
- [ ] Homepage hero renders
- [ ] Nav: My Plan / Calculators / Guides / Brokerage / About all reachable (some 404 for now — that's expected; Plan 2 and 3 add them)
- [ ] About, Disclosure, Privacy, Terms all render correctly
- [ ] Footer renders
- [ ] `/go/wealthsimple` redirects with UTM params
- [ ] `/go/does-not-exist` redirects to homepage
- [ ] `/robots.txt` shows `Disallow: /`
- [ ] Page source contains `<meta name="robots" content="noindex, nofollow">` on every page

- [ ] **Step 3: Tag the release**

```bash
git tag -a v0.1.0 -m "Phase 1 foundation: deployable site with chrome and affiliate redirect"
git push --tags
```

- [ ] **Step 4: Update affiliate-applications.md if any approvals have come in during the build**

Edit `affiliate-applications.md` to reflect any new approvals + paste the real affiliate URLs into `src/data/brokerages.yaml` (replace placeholder `https://www.wealthsimple.com/` etc.).

If any are updated:

```bash
git add affiliate-applications.md src/data/brokerages.yaml
git commit -m "chore: update affiliate URLs from approved programs"
git push
```

---

## Done criteria for Plan 1

- [ ] Repo `myfireplan` exists on GitHub
- [ ] Cloudflare Pages project deploys on push to `main`
- [ ] `https://myfireplan.ca/` resolves to a working homepage
- [ ] Chrome pages (About, Disclosure, Privacy, Terms) all live
- [ ] `/go/[slug]` redirects work for known and unknown slugs, with UTM tagging
- [ ] KV click logging records clicks
- [ ] `STAGING=true` keeps `noindex` active and `robots.txt` blocking
- [ ] All Vitest tests pass
- [ ] At least one affiliate program has been applied for (Task 0 step 2)

When all done-criteria are met, Plan 1 ships and we proceed to Plan 2 (calculator framework + 3 hero calculators).

---

## Notes for the executing engineer

- **Don't add features.** This plan is foundation only. Calculators belong in Plan 2.
- **Tests over verification ceremony.** TDD where it pays (the redirect logic, brokerage loader). Smoke build for chrome pages.
- **If a step fails, stop and ask.** Don't paper over a failing test or skip a verification step.
- **Each task ends in a commit.** Frequent commits make recovery easy.
- **The affiliate URLs in `brokerages.yaml` are placeholders.** Real URLs come once programs approve.
- **The brand visual identity is unfinished.** Favicon, color palette, and brand-mark are placeholders. Replace before public launch (out of scope for Plan 1).
