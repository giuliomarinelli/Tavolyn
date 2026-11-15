import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "auth.spec.ts",
  outputDir: ".wrangler/auth-browser-results",
  webServer: {
    command: "npm run auth:preview",
    url: "http://127.0.0.1:8788/api/health",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
