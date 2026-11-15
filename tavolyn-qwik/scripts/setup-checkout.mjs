import { randomBytes } from "node:crypto";
import { writeFile, stat } from "node:fs/promises";

// Never read, print, rotate or replace a pre-existing private configuration.
const target = new URL("../.dev.vars", import.meta.url);
try {
  await stat(target);
  console.log(
    ".dev.vars esistente conservato. Il checkout richiede ORDER_TOKEN_KEY (64 caratteri esadecimali casuali). Non rigenerare una chiave già usata.",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await writeFile(
    target,
    `ORDER_TOKEN_KEY=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Chiave locale creata in tavolyn-qwik/.dev.vars (ignorato da Git); valore non stampato. Conservare il file per i replay.",
  );
}
