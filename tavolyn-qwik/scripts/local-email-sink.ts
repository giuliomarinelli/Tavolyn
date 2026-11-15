import { mkdir, writeFile, readFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import type {
  EmailAdapter,
  OrderSummaryMessage,
} from "../src/lib/server/email/summary-template";

export class LocalEmailSink implements EmailAdapter {
  readonly kind = "LOCAL_ONLY";
  private directory: string;
  constructor(base: string, tenantSlug: string) {
    if (!/^(aurora|nodo)$/.test(tenantSlug))
      throw new Error("LOCAL_CAPTURE_FAILED");
    this.directory = resolve(base, tenantSlug);
  }
  async deliver(
    idempotencyKey: string,
    message: OrderSummaryMessage,
  ): Promise<"CAPTURED_LOCAL"> {
    if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey))
      throw new Error("LOCAL_CAPTURE_FAILED");
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if ((await lstat(this.directory)).isSymbolicLink())
      throw new Error("LOCAL_CAPTURE_FAILED");
    const filename = join(this.directory, `${idempotencyKey}.json`);
    const content = JSON.stringify(message, null, 2) + "\n";
    try {
      await writeFile(filename, content, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "EEXIST"
        )
      )
        throw error;
      const info = await lstat(filename);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 256000 ||
        (await readFile(filename, "utf8")) !== content
      )
        throw new Error("LOCAL_CAPTURE_CONFLICT");
    }
    return "CAPTURED_LOCAL";
  }
}
