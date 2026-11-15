import type {
  OrderInput,
  OrderReceipt,
  OrderResponse,
} from "../../shared/checkout";
import { digest, randomNonce, trackingToken } from "./crypto";
import { quoteCart } from "./quote-service";
import { CheckoutError } from "./validation";

interface SavedOrder {
  request_hash: string;
  order_id: string;
  response_json: string;
  token_nonce: string;
  tracking_hash: string;
}
const savedOrder = (db: D1Database, tenantId: string, keyHash: string) =>
  db
    .prepare(
      `
  SELECT i.request_hash, i.order_id, i.response_json, a.token_nonce, a.tracking_hash
  FROM idempotency_records i JOIN order_access a ON a.tenant_id = i.tenant_id AND a.order_id = i.order_id
  WHERE i.tenant_id = ? AND i.operation = 'CREATE_ORDER' AND i.key_hash = ?
`,
    )
    .bind(tenantId, keyHash)
    .first<SavedOrder>();

export const createOrder = async (
  db: D1Database,
  secret: string,
  tenantId: string,
  slug: string,
  currency: string,
  input: OrderInput,
): Promise<{ receipt: OrderResponse; replay: boolean }> => {
  const keyHash = await digest(input.idempotencyKey);
  const requestHash = await digest(JSON.stringify(input));
  const replay = async (row: SavedOrder) => {
    if (row.request_hash !== requestHash)
      throw new CheckoutError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Questa chiave è già associata a una richiesta diversa.",
      );
    const token = await trackingToken(
      secret,
      tenantId,
      row.order_id,
      row.token_nonce,
    );
    // Fail closed if a local secret was replaced, rather than return a broken credential.
    if ((await digest(token)) !== row.tracking_hash)
      throw new CheckoutError(
        503,
        "CHECKOUT_UNAVAILABLE",
        "Non è possibile recuperare la conferma. Conserva la richiesta e riprova più tardi.",
      );
    return {
      receipt: {
        ...(JSON.parse(row.response_json) as OrderReceipt),
        trackingToken: token,
      },
      replay: true,
    };
  };
  const existing = await savedOrder(db, tenantId, keyHash);
  if (existing) return replay(existing);
  const quote = await quoteCart(db, tenantId, currency, {
    items: input.cart.items,
    fulfillment: input.fulfillment,
  });
  if (quote.quoteFingerprint !== input.quoteFingerprint)
    throw new CheckoutError(
      409,
      "QUOTE_CHANGED",
      "Il menu o i prezzi sono cambiati. Aggiorna il preventivo prima di confermare.",
    );
  if (
    input.paymentMethod === "MOCK_CARD" &&
    input.mockPaymentResult === "FAILURE"
  )
    throw new CheckoutError(
      402,
      "PAYMENT_SIMULATED_FAILED",
      "Pagamento simulato non riuscito. Nessun ordine creato e nessun addebito.",
    );
  const orderId = crypto.randomUUID();
  const nonce = randomNonce();
  const token = await trackingToken(secret, tenantId, orderId, nonce);
  const trackingHash = await digest(token);
  const createdAt = new Date().toISOString();
  const receipt: OrderReceipt = {
    ...quote,
    orderNumber: `${slug === "aurora" ? "A" : "N"}-${orderId.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    status: "NEW",
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod === "CASH" ? "UNPAID" : "PAID_SIMULATED",
    createdAt,
  };
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO orders (tenant_id,id,order_number,status,fulfillment_type,payment_method,payment_status,currency,
        subtotal_cents,delivery_fee_cents,total_cents,contact_snapshot_json,address_snapshot_json,notes,created_at,updated_at)
        VALUES (?,?,?,'NEW',?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          tenantId,
          orderId,
          receipt.orderNumber,
          input.fulfillment,
          input.paymentMethod,
          receipt.paymentStatus,
          currency,
          quote.subtotalCents,
          quote.deliveryFeeCents,
          quote.totalCents,
          JSON.stringify(input.contact),
          input.address ? JSON.stringify(input.address) : null,
          input.notes,
          createdAt,
          createdAt,
        ),
      ...quote.items.map((item) =>
        db
          .prepare(
            `INSERT INTO order_items (tenant_id,id,order_id,product_id,name_snapshot,qty,unit_price_cents,modifiers_snapshot_json,line_total_cents)
        VALUES (?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            tenantId,
            crypto.randomUUID(),
            orderId,
            item.productId,
            item.name,
            item.quantity,
            item.unitPriceCents,
            JSON.stringify(item.modifiers),
            item.lineTotalCents,
          ),
      ),
      db
        .prepare(
          "INSERT INTO order_access (tenant_id,order_id,tracking_hash,token_nonce,key_version,created_at) VALUES (?,?,?,?,1,?)",
        )
        .bind(tenantId, orderId, trackingHash, nonce, createdAt),
      // No ON CONFLICT ignore: a race must roll back EVERY preceding insert.
      db
        .prepare(
          "INSERT INTO idempotency_records (tenant_id,operation,key_hash,request_hash,order_id,response_json,created_at) VALUES (?,'CREATE_ORDER',?,?,?,?,?)",
        )
        .bind(
          tenantId,
          keyHash,
          requestHash,
          orderId,
          JSON.stringify(receipt),
          createdAt,
        ),
    ]);
  } catch {
    const winner = await savedOrder(db, tenantId, keyHash);
    if (winner) return replay(winner);
    throw new CheckoutError(
      503,
      "ORDER_NOT_SAVED",
      "Ordine non confermato. Riprova la stessa richiesta, senza cambiare chiave.",
    );
  }
  return { receipt: { ...receipt, trackingToken: token }, replay: false };
};
