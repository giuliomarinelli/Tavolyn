import { getPlatformProxy } from "wrangler";
import { resolveTenant } from "../src/lib/server/tenants/tenant-service";
import { captureLocalOutbox } from "../src/lib/server/email/outbox-service";
import { LocalEmailSink } from "./local-email-sink";

const args = process.argv.slice(2);
const tenantSlug = args[args.indexOf("--tenant") + 1];
const port = args.includes("--port")
  ? Number(args[args.indexOf("--port") + 1])
  : 8787;
if (
  !args.includes("--local") ||
  !args.includes("--tenant") ||
  !["aurora", "nodo"].includes(tenantSlug) ||
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535
) {
  console.error(
    "Uso locale esplicito: npm run email:capture -- --local --tenant aurora|nodo [--port 8787]",
  );
  process.exitCode = 1;
} else {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>> | undefined;
  try {
    proxy = await getPlatformProxy<Env>({
      configPath: "wrangler.jsonc",
      remoteBindings: false,
    });
    const origin = `http://${tenantSlug}.localhost:${port}`;
    const tenant = await resolveTenant(new URL(origin), {
      ...proxy.env,
      LOCAL_DEMO_MODE: "true",
    });
    if (!tenant) throw new Error("Unknown local tenant");
    const result = await captureLocalOutbox(
      proxy.env.DB,
      proxy.env.ORDER_TOKEN_KEY,
      tenant,
      origin,
      new LocalEmailSink(".wrangler/email-previews", tenantSlug),
    );
    console.log(
      `Cattura locale ${tenantSlug}: ${result.captured} acquisiti, ${result.failed} falliti. Nessun invio email reale. File privati in .wrangler/email-previews/${tenantSlug}/`,
    );
    if (result.failed) process.exitCode = 1;
  } catch {
    // Never print raw errors: they can contain SQL, recipient data or a credential.
    console.error(
      "Cattura locale non riuscita. Verifica migrazioni, tenant demo e chiave privata; nessun invio reale.",
    );
    process.exitCode = 1;
  } finally {
    await proxy?.dispose();
  }
}
