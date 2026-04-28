import { defineConfig } from "astro/config";
import { fileURLToPath } from "url";
import path from "path";
import mdx from "@astrojs/mdx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
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
