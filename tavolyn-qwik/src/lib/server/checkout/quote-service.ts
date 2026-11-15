import { readMenu } from "../catalog/catalog-service";
import { configurationError, configuredPrice } from "../../shared/catalog";
import type {
  CheckoutSettings,
  Quote,
  QuoteInput,
} from "../../shared/checkout";
import { digest } from "./crypto";
import { CheckoutError } from "./validation";

export const checkoutSettings = async (
  db: D1Database,
  tenantId: string,
): Promise<CheckoutSettings> => {
  const row = await db
    .prepare(
      "SELECT pickup_enabled, delivery_enabled, delivery_fee_cents FROM tenant_checkout_settings WHERE tenant_id = ?",
    )
    .bind(tenantId)
    .first<{
      pickup_enabled: number;
      delivery_enabled: number;
      delivery_fee_cents: number;
    }>();
  if (!row)
    throw new CheckoutError(
      503,
      "CHECKOUT_UNAVAILABLE",
      "Il checkout di questo ristorante non è ancora disponibile.",
    );
  return {
    pickupEnabled: row.pickup_enabled === 1,
    deliveryEnabled: row.delivery_enabled === 1,
    deliveryFeeCents: row.delivery_fee_cents,
  };
};

export const quoteCart = async (
  db: D1Database,
  tenantId: string,
  currency: string,
  input: QuoteInput,
): Promise<Quote> => {
  const settings = await checkoutSettings(db, tenantId);
  if (
    (input.fulfillment === "PICKUP" && !settings.pickupEnabled) ||
    (input.fulfillment === "DELIVERY" && !settings.deliveryEnabled)
  )
    throw new CheckoutError(
      409,
      "FULFILLMENT_UNAVAILABLE",
      "La modalità scelta non è disponibile. Aggiorna il preventivo.",
    );
  const menu = await readMenu(db, tenantId, currency);
  const products = menu.categories.flatMap((category) => category.products);
  const items = input.items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const error = product
      ? configurationError(product, item.modifierIds)
      : "Un piatto è stato rimosso o non appartiene a questo menu.";
    if (!product || error)
      throw new CheckoutError(
        409,
        "CART_CHANGED",
        error || "Il menu è cambiato. Rivedi il carrello.",
      );
    const unitPriceCents = configuredPrice(product, item.modifierIds);
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * item.quantity,
      modifiers: product.modifierGroups
        .flatMap((group) => group.modifiers)
        .filter((mod) => item.modifierIds.includes(mod.id))
        .map((mod) => ({
          id: mod.id,
          label: mod.label,
          deltaPriceCents: mod.deltaPriceCents,
        })),
    };
  });
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );
  const deliveryFeeCents =
    input.fulfillment === "DELIVERY" ? settings.deliveryFeeCents : 0;
  const totalCents = subtotalCents + deliveryFeeCents;
  if (!Number.isSafeInteger(totalCents) || totalCents > 200000)
    throw new CheckoutError(
      422,
      "ORDER_LIMIT",
      "Il totale massimo della demo è 2.000 €.",
    );
  const quote = {
    currency,
    fulfillment: input.fulfillment,
    items,
    subtotalCents,
    deliveryFeeCents,
    totalCents,
  };
  return { ...quote, quoteFingerprint: await digest(JSON.stringify(quote)) };
};
