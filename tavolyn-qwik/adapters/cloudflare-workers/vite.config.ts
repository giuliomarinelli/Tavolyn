// Qwik 1.20's official Workers template shares the Pages adapter implementation.
import { cloudflarePagesAdapter as cloudflareWorkersAdapter } from "@builder.io/qwik-city/adapters/cloudflare-pages/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => ({
  build: {
    ssr: true,
    rollupOptions: {
      input: ["src/entry.cloudflare-pages.tsx", "@qwik-city-plan"],
    },
  },
  plugins: [
    cloudflareWorkersAdapter({
      functionRoutes: false,
      // An empty include keeps routes dynamic while allowing the adapter to emit
      // its Worker entry and static-path manifest (ssg: null skips those in 1.20).
      ssg: { include: [] },
    }),
  ],
}));
