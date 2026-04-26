import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://yourdomain.ca",
  trailingSlash: "never",
  build: {
    format: "file",
  },
});
