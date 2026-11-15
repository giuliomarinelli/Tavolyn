import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: ".wrangler/oidc-harness",
    emptyOutDir: true,
    target: "node22",
    lib: {
      entry: "tests/oidc/start.ts",
      formats: ["es"],
      fileName: () => "start.mjs",
    },
    rollupOptions: { external: ["wrangler", /^node:/] },
  },
});
