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

const handleRequest = createQwikCity({ render, qwikCityPlan });

export const fetch: typeof handleRequest = (request, env, ctx) => {
  // Workers already supplies the authoritative URL. Qwik's SSR metadata must
  // not reconstruct an origin from client-supplied proxy headers.
  const headers = new Headers(request.headers);
  headers.delete("X-Forwarded-Host");
  headers.delete("X-Forwarded-Proto");
  headers.delete("Forwarded");
  return handleRequest(new Request(request, { headers }), env, ctx);
};
