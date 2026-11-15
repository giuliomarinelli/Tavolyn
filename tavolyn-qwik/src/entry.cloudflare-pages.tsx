// The filename is required by the official Qwik 1.20 Workers adapter.
import {
  createQwikCity,
  type PlatformCloudflarePages,
} from "@builder.io/qwik-city/middleware/cloudflare-pages";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";

declare global {
  type QwikCityPlatform = Omit<PlatformCloudflarePages, "env"> & {
    env: Env;
  };
}

export const fetch = createQwikCity({ render, qwikCityPlan });
