import { randomBytes } from "node:crypto";
import { readFile, writeFile, lstat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";

// Explicit local setup only. Values come from an ignored private JSON file;
// never place personal subjects or real provider identifiers in demo seeds.
const root = new URL("../", import.meta.url);
const privateFile = new URL(".dev.vars", root);
const configPath = fileURLToPath(new URL("wrangler.jsonc", root));
const assignment = (name) =>
  new RegExp(`^[ \\t]*(?:export[ \\t]+)?${name}[ \\t]*=`, "m");

let platform;
try {
  const [inputPath, ...extra] = process.argv.slice(2);
  if (!inputPath || extra.length) throw new Error();
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const issuer = new URL(input.issuer);
  const origin = new URL(input.origin);
  if (
    issuer.protocol !== "https:" ||
    issuer.username ||
    issuer.password ||
    issuer.search ||
    issuer.hash ||
    /['\s]/.test(issuer.href) ||
    origin.origin !== input.origin ||
    origin.protocol !== "http:" ||
    origin.hostname !== "localhost" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(input.clientId) ||
    !/^[0-9a-f-]{36}$/i.test(input.subject) ||
    !/^[a-z0-9-]{1,80}$/.test(input.tenantSlug) ||
    !["OWNER", "OPERATOR"].includes(input.role)
  )
    throw new Error();

  const stat = await lstat(privateFile);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
  const original = await readFile(privateFile, "utf8");
  for (const name of [
    "ORDER_TOKEN_KEY",
    "AUTH_STATE_KEY",
    "OIDC_ISSUER",
    "OIDC_CLIENT_ID",
    "OIDC_ALLOWED_ORIGINS",
  ]) {
    const count = original
      .split(/\r?\n/)
      .filter((line) => assignment(name).test(line)).length;
    if (count > 1) throw new Error();
  }
  if (!assignment("ORDER_TOKEN_KEY").test(original)) throw new Error();
  platform = await getPlatformProxy({ configPath, remoteBindings: false });
  const env = platform.env;
  if (!/^[0-9a-f]{64}$/i.test(env.ORDER_TOKEN_KEY || "")) throw new Error();
  const existingKey = assignment("AUTH_STATE_KEY").test(original);
  if (existingKey && !/^[0-9a-f]{64}$/i.test(env.AUTH_STATE_KEY || ""))
    throw new Error();

  const tenant = await env.DB.prepare(
    "SELECT id FROM tenants WHERE slug=? AND enabled=1",
  )
    .bind(input.tenantSlug)
    .first();
  if (!tenant) throw new Error();
  const previous = await env.DB.prepare(
    "SELECT role,active FROM staff_memberships WHERE tenant_id=? AND cognito_sub=?",
  )
    .bind(tenant.id, input.subject)
    .first();
  if (previous && (previous.role !== input.role || previous.active !== 1))
    throw new Error();

  // Change only owned OIDC configuration. Preserve every unrelated line, including
  // the original ORDER_TOKEN_KEY assignment, and never rotate an existing auth key.
  const values = {
    OIDC_ISSUER: `'${issuer.href}'`,
    OIDC_CLIENT_ID: `'${input.clientId}'`,
    OIDC_ALLOWED_ORIGINS: `'${JSON.stringify([origin.origin])}'`,
  };
  let updated = original;
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    if (assignment(name).test(updated)) {
      updated = updated.replace(
        new RegExp(`^[ \\t]*(?:export[ \\t]+)?${name}[ \\t]*=.*$`, "m"),
        line,
      );
    } else {
      updated += `${updated.endsWith("\n") ? "" : "\n"}${line}\n`;
    }
  }
  if (!existingKey)
    updated += `${updated.endsWith("\n") ? "" : "\n"}AUTH_STATE_KEY=${randomBytes(32).toString("hex")}\n`;
  if ((await readFile(privateFile, "utf8")) !== original) throw new Error();
  if (updated !== original)
    await writeFile(privateFile, updated, { mode: 0o600 });

  await env.DB.prepare(
    `INSERT INTO staff_memberships(tenant_id,cognito_sub,role,active)
    VALUES (?,?,?,1) ON CONFLICT(tenant_id,cognito_sub) DO NOTHING`,
  )
    .bind(tenant.id, input.subject, input.role)
    .run();
  const membership = await env.DB.prepare(
    "SELECT role,active FROM staff_memberships WHERE tenant_id=? AND cognito_sub=?",
  )
    .bind(tenant.id, input.subject)
    .first();
  if (membership?.role !== input.role || membership?.active !== 1)
    throw new Error();
  console.log(
    "Configurazione OIDC privata pronta; chiave ordini preservata, chiave auth creata solo se assente. Membership locale verificata; record preesistenti conservati.",
  );
} catch {
  console.error(
    "Setup OIDC locale non completato. Usa un JSON privato valido, .dev.vars con ORDER_TOKEN_KEY e D1 locale già inizializzata. Nessun dettaglio privato viene stampato; una membership esistente incompatibile non viene sovrascritta.",
  );
  process.exitCode = 1;
} finally {
  await platform?.dispose();
}
