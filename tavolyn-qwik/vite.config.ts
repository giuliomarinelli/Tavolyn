import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => {
  // Vite is an optional authoring tool; Wrangler preview runs the built Worker.
  const platform =
    command === "serve"
      ? await (await import("wrangler")).getPlatformProxy<Env>()
      : undefined;
  if (platform) {
    // Authoring only: this branch is never part of the built Worker.
    platform.env.LOCAL_DEMO_MODE = "true";
  }

  return {
    plugins: [qwikCity({ platform }), qwikVite(), tsconfigPaths()],
    server: {
      host: "127.0.0.1",
      headers: { "Cache-Control": "no-store" },
    },
  };
});
