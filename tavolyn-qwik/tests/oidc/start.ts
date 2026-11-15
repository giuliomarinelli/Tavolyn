import { startProvider } from "./provider";
import { unstable_readConfig } from "wrangler";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

// Private, generated local configuration and isolated D1. Never build/deploy this harness.
const root = process.cwd();
const directory = resolve(root, ".wrangler/oidc-test");
const persist = resolve(directory, "state");
const configPath = resolve(directory, "wrangler.json");
const wrangler = resolve(root, "../node_modules/wrangler/bin/wrangler.js");
const origins = ["http://aurora.localhost:8788", "http://nodo.localhost:8788"];
await mkdir(directory, { recursive: true });
const provider = await startProvider(origins);
const base = unstable_readConfig({ config: resolve(root, "wrangler.jsonc") });
const config = {
  name: base.name,
  main: resolve(root, "dist/_worker.js"),
  compatibility_date: base.compatibility_date,
  compatibility_flags: base.compatibility_flags,
  send_metrics: false,
  vars: {
    LOCAL_DEMO_MODE: "true",
    OIDC_ISSUER: provider.issuer,
    OIDC_CLIENT_ID: "local-fixture-client",
    OIDC_ALLOWED_ORIGINS: JSON.stringify(origins),
    AUTH_STATE_KEY: randomBytes(32).toString("hex"),
    ORDER_TOKEN_KEY: randomBytes(32).toString("hex"),
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: "tavolyn-oidc-test",
      migrations_dir: resolve(root, "migrations"),
      remote: false,
    },
  ],
  assets: {
    directory: resolve(root, "dist"),
    binding: "ASSETS",
    run_worker_first: ["/api/*", "/app", "/app/*"],
  },
  observability: { enabled: false },
};
await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
const run = async (args: string[]) => {
  const child = spawn(
    process.execPath,
    [wrangler, ...args, "--config", configPath],
    { stdio: "pipe", windowsHide: true },
  );
  // Never print generated vars, SQL, token responses or credential-bearing URLs.
  await new Promise<void>((done, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? done()
        : reject(new Error("OIDC harness local D1 setup failed")),
    );
  });
};
try {
  await run([
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--persist-to",
    persist,
  ]);
  for (const file of ["demo-tenants.sql", "demo-staff.sql"]) {
    // Prove the fixture file exists before asking Wrangler to read it.
    await readFile(resolve(root, "seeds", file));
    await run([
      "d1",
      "execute",
      "DB",
      "--local",
      "--persist-to",
      persist,
      "--file",
      resolve(root, "seeds", file),
    ]);
  }
  const child = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "--config",
      configPath,
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      "8788",
      "--persist-to",
      persist,
      "--log-level",
      "error",
    ],
    { stdio: "inherit", windowsHide: true },
  );
  const close = async () => {
    child.kill();
    await provider.close();
  };
  process.once("SIGINT", () => {
    void close();
  });
  process.once("SIGTERM", () => {
    void close();
  });
  child.once("exit", async (code) => {
    await provider.close();
    process.exit(code || 0);
  });
  console.log(
    "Harness OIDC locale: http://aurora.localhost:8788/login/ e http://nodo.localhost:8788/login/",
  );
} catch {
  await provider.close();
  console.error("Avvio del test harness OIDC non riuscito.");
  process.exitCode = 1;
}
