import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        "miter-cut-wizard": resolve(__dirname, "miter-cut-wizard.html"),
      },
    },
  },
});
