import { digest, trackingToken } from "../checkout/crypto";
import type { ResolvedTenant } from "../tenants/tenant-service";
import { readTrackedOrder } from "../tracking/tracking-service";
import { renderOrderSummary, type EmailAdapter } from "./summary-template";

class CaptureError extends Error {
  constructor(
    public code:
      | "TOKEN_KEY_UNAVAILABLE"
      | "LOCAL_CAPTURE_FAILED"
      | "LOCAL_CAPTURE_CONFLICT",
  ) {
    super(code);
  }
}
interface OutboxRow {
  id: string;
  order_id: string;
  restaurant_name_snapshot: string;
  timezone_snapshot: string;
  contact_snapshot_json: string;
  token_nonce: string;
  tracking_hash: string;
}

export const captureLocalOutbox = async (
  db: D1Database,
  secret: string,
  tenant: ResolvedTenant,
  origin: string,
  adapter: EmailAdapter,
): Promise<{ captured: number; failed: number }> => {
  // CLI additionally forces local bindings; only fictional, marked demo tenants qualify.
  if (
    adapter.kind !== "LOCAL_ONLY" ||
    !tenant.localPreview ||
    new URL(origin).origin !== origin ||
    !/^http:\/\/(aurora|nodo)\.localhost(?::\d+)?$/.test(origin)
  )
    throw new CaptureError("LOCAL_CAPTURE_FAILED");
  const demo = await db
    .prepare(
      "SELECT id FROM tenants WHERE id = ? AND is_demo = 1 AND enabled = 1",
    )
    .bind(tenant.id)
    .first();
  if (!demo || new URL(origin).hostname !== `${tenant.site.slug}.localhost`)
    throw new CaptureError("LOCAL_CAPTURE_FAILED");
  const rows = await db
    .prepare(
      `SELECT b.id,b.order_id,b.restaurant_name_snapshot,b.timezone_snapshot,o.contact_snapshot_json,a.token_nonce,a.tracking_hash
    FROM email_outbox b JOIN orders o ON o.tenant_id = b.tenant_id AND o.id = b.order_id
    JOIN order_access a ON a.tenant_id = b.tenant_id AND a.order_id = b.order_id
    WHERE b.tenant_id = ? AND b.message_type = 'ORDER_SUMMARY' AND b.delivery_mode = 'LOCAL_ONLY' AND b.status IN ('QUEUED','FAILED_LOCAL')
    ORDER BY b.created_at,b.id LIMIT 20`,
    )
    .bind(tenant.id)
    .all<OutboxRow>();
  let captured = 0;
  let failed = 0;
  for (const row of rows.results) {
    const attempt = await db
      .prepare(
        "UPDATE email_outbox SET attempts = attempts + 1, error_code = NULL WHERE tenant_id = ? AND id = ? AND delivery_mode = 'LOCAL_ONLY' AND status IN ('QUEUED','FAILED_LOCAL')",
      )
      .bind(tenant.id, row.id)
      .run();
    if (attempt.meta.changes === 0) continue;
    try {
      let token;
      try {
        token = await trackingToken(
          secret,
          tenant.id,
          row.order_id,
          row.token_nonce,
        );
        if ((await digest(token)) !== row.tracking_hash)
          throw new Error("Key mismatch");
      } catch {
        throw new CaptureError("TOKEN_KEY_UNAVAILABLE");
      }
      const order = await readTrackedOrder(db, tenant, token);
      if (!order) throw new CaptureError("LOCAL_CAPTURE_FAILED");
      const contact = JSON.parse(row.contact_snapshot_json) as {
        email: string;
      };
      if (
        typeof contact.email !== "string" ||
        contact.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)
      )
        throw new CaptureError("LOCAL_CAPTURE_FAILED");
      const message = renderOrderSummary(
        contact.email,
        {
          ...order,
          restaurant: {
            name: row.restaurant_name_snapshot,
            slug: tenant.site.slug,
          },
        },
        `${origin}/orders/${encodeURIComponent(token)}/`,
        row.timezone_snapshot,
      );
      const result = await adapter.deliver(row.id, message);
      if (result !== "CAPTURED_LOCAL")
        throw new CaptureError("LOCAL_CAPTURE_FAILED");
      await db
        .prepare(
          "UPDATE email_outbox SET status = 'CAPTURED_LOCAL', processed_at = ?, error_code = NULL WHERE tenant_id = ? AND id = ? AND delivery_mode = 'LOCAL_ONLY' AND status IN ('QUEUED','FAILED_LOCAL')",
        )
        .bind(new Date().toISOString(), tenant.id, row.id)
        .run();
      captured++;
    } catch (error) {
      const code =
        error instanceof CaptureError
          ? error.code
          : error instanceof Error && error.message === "LOCAL_CAPTURE_CONFLICT"
            ? "LOCAL_CAPTURE_CONFLICT"
            : "LOCAL_CAPTURE_FAILED";
      await db
        .prepare(
          "UPDATE email_outbox SET status = 'FAILED_LOCAL', error_code = ? WHERE tenant_id = ? AND id = ? AND delivery_mode = 'LOCAL_ONLY' AND status IN ('QUEUED','FAILED_LOCAL')",
        )
        .bind(code, tenant.id, row.id)
        .run();
      failed++;
    }
  }
  return { captured, failed };
};
