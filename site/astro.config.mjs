import { defineConfig } from "astro/config";
import { fileURLToPath } from "url";
import path from "path";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkGlossaryAutolink from "./plugins/remark-glossary-autolink.mjs";
import { GLOSSARY_LINK_TERMS } from "./src/data/glossary.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [
      [remarkGlossaryAutolink, { terms: GLOSSARY_LINK_TERMS }],
    ],
  },
  integrations: [
    mdx({
      remarkPlugins: [
        [remarkGlossaryAutolink, { terms: GLOSSARY_LINK_TERMS }],
      ],
    }),
    sitemap(),
  ],
  site: "https://canadianrates.ca",
  trailingSlash: "never",
  build: {
    format: "file",
  },
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
