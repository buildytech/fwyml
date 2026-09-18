import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [tailwindcss(), solid()],
  resolve: {
    alias: {
      "$ui8kit/ui": fileURLToPath(new URL("./packages/solid/src/kit/ui/index.solid.ts", import.meta.url)),
      "$ui8kit/utils": fileURLToPath(new URL("./packages/solid/src/kit/utils/index.ts", import.meta.url)),
      "@buildy-ui/ui8kit-solid": fileURLToPath(new URL("./packages/solid/src/index.ts", import.meta.url)),
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
      $components: fileURLToPath(new URL("./src/components", import.meta.url)),
      $surfaces: fileURLToPath(new URL("./src/surfaces", import.meta.url)),
      $views: fileURLToPath(new URL("./src/views", import.meta.url)),
      "@buildy/agent-contract": fileURLToPath(new URL("./packages/agent-contract/index.ts", import.meta.url)),
    },
    dedupe: ["solid-js"],
  },
  build: {
    outDir: "frontend/dist",
    emptyOutDir: true,
  },
});
