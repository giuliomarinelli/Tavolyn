import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: "**/auth.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: ".wrangler/browser-results",
  reporter: "list",
  use: {
    browserName: "chromium",
    launchOptions: {
      args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run db:setup && npm run checkout:setup && npm run preview",
    url: "http://127.0.0.1:8787/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
