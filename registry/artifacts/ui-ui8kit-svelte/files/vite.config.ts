import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [svelte()],
  resolve: {
    alias: {
      "@ui8kit/codegen": resolve("packages/ui8kit-svelte/generated"),
    },
  },
  build: {
    outDir: "frontend/dist",
    emptyOutDir: true,
  },
});
