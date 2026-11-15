import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    outDir: ".wrangler/email-sink",
    emptyOutDir: true,
    target: "node22",
    minify: false,
    lib: {
      entry: resolve("scripts/capture-email.ts"),
      formats: ["es"],
      fileName: () => "capture.mjs",
    },
    rollupOptions: { external: ["wrangler", "node:fs/promises", "node:path"] },
  },
});
