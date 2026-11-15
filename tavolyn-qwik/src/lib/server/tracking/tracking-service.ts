import { digest } from "../checkout/crypto";
import type { ResolvedTenant } from "../tenants/tenant-service";
import type {
  TrackedOrder,
  TrackingItem,
  PublicOrderEvent,
  OrderStatus,
} from "../../shared/tracking";

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  updated_at: string;
  status: OrderStatus;
  fulfillment_type: TrackedOrder["fulfillment"];
  payment_method: TrackedOrder["paymentMethod"];
  payment_status: TrackedOrder["paymentStatus"];
  currency: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
}
interface ItemRow {
  name_snapshot: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  modifiers_snapshot_json: string;
}
interface EventRow {
  event_type: PublicOrderEvent["type"];
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  created_at: string;
}

export const readTrackedOrder = async (
  db: D1Database,
  tenant: ResolvedTenant,
  token: string,
): Promise<TrackedOrder | null> => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = await digest(token);
  // One consistent snapshot of order, immutable lines and public timeline.
  const access = `JOIN order_access a ON a.tenant_id = o.tenant_id AND a.order_id = o.id
    WHERE a.tenant_id = ? AND a.tracking_hash = ?`;
  const [orders, items, events] = await db.batch([
    db
      .prepare(
        `SELECT o.id,o.order_number,o.created_at,o.updated_at,o.status,o.fulfillment_type,o.payment_method,o.payment_status,o.currency,o.subtotal_cents,o.delivery_fee_cents,o.total_cents
      FROM orders o ${access}`,
      )
      .bind(tenant.id, hash),
    db
      .prepare(
        `SELECT i.name_snapshot,i.qty,i.unit_price_cents,i.line_total_cents,i.modifiers_snapshot_json
      FROM order_items i JOIN orders o ON o.tenant_id = i.tenant_id AND o.id = i.order_id
      ${access} ORDER BY i.id`,
      )
      .bind(tenant.id, hash),
    db
      .prepare(
        `SELECT e.event_type,e.from_status,e.to_status,e.created_at FROM order_events e
      JOIN orders o ON o.tenant_id = e.tenant_id AND o.id = e.order_id ${access}
      AND e.visibility = 'PUBLIC' AND e.event_type IN ('ORDER_CREATED','ORDER_STATUS_CHANGED') AND e.to_status IS NOT NULL
      ORDER BY e.created_at,e.id`,
      )
      .bind(tenant.id, hash),
  ]);
  const row = (orders.results as OrderRow[])[0];
  if (!row) return null;
  return {
    orderNumber: row.order_number,
    restaurant: { name: tenant.site.name, slug: tenant.site.slug },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    fulfillment: row.fulfillment_type,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    items: (items.results as ItemRow[]).map(
      (item): TrackingItem => ({
        name: item.name_snapshot,
        quantity: item.qty,
        unitPriceCents: item.unit_price_cents,
        lineTotalCents: item.line_total_cents,
        modifiers: (
          JSON.parse(item.modifiers_snapshot_json) as {
            label: string;
            deltaPriceCents: number;
          }[]
        ).map((mod) => ({
          label: mod.label,
          deltaPriceCents: mod.deltaPriceCents,
        })),
      }),
    ),
    timeline: (events.results as EventRow[]).map((event) => ({
      type: event.event_type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      occurredAt: event.created_at,
    })),
  };
};
