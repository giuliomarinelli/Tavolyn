import { formatMoney } from "../../shared/catalog";
import { displayTime, type TrackedOrder } from "../../shared/tracking";

export interface OrderSummaryMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export interface EmailAdapter {
  readonly kind: "LOCAL_ONLY";
  deliver(
    idempotencyKey: string,
    message: OrderSummaryMessage,
  ): Promise<"CAPTURED_LOCAL">;
}
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export const renderOrderSummary = (
  to: string,
  order: TrackedOrder,
  trackingUrl: string,
  timezone: string,
): OrderSummaryMessage => {
  const money = (amount: number) => formatMoney(amount, order.currency);
  const payment =
    order.paymentStatus === "UNPAID"
      ? "Contanti: pagamento non ancora avvenuto. Nessun anticipo."
      : "Pagamento simulato riuscito. Nessun denaro è stato addebitato.";
  const fulfillment =
    order.fulfillment === "PICKUP" ? "Ritiro al ristorante" : "Consegna demo";
  const lines = order.items.map(
    (item) =>
      `${item.quantity} × ${item.name} · ${money(item.unitPriceCents)} cad. · ${money(item.lineTotalCents)}${item.modifiers.length ? `\n  ${item.modifiers.map((mod) => `${mod.label} (+${money(mod.deltaPriceCents)})`).join(", ")}` : ""}`,
  );
  const text = [
    "Riepilogo dell’ordine",
    order.restaurant.name,
    `Ordine ${order.orderNumber}`,
    displayTime(order.createdAt, timezone),
    "",
    ...lines,
    "",
    `Piatti: ${money(order.subtotalCents)}`,
    `${fulfillment}: ${money(order.deliveryFeeCents)}`,
    `Totale: ${money(order.totalCents)}`,
    payment,
    "",
    `Segui il tuo ordine: ${trackingUrl}`,
    "Conserva privatamente questo collegamento.",
    "",
    "Demo portfolio: ristorante e ordine immaginari. Questo riepilogo non è un documento fiscale. Nessuna email reale viene inviata dal sink locale.",
  ].join("\n");
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>Riepilogo dell’ordine</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#342a20;background:#f6f0e5;padding:24px"><main style="max-width:640px;margin:auto"><p>Demo portfolio · ${escapeHtml(order.restaurant.name)}</p><h1>Riepilogo dell’ordine</h1><h2>${escapeHtml(order.orderNumber)}</h2><p>${escapeHtml(displayTime(order.createdAt, timezone))}</p><ul>${order.items.map((item) => `<li><strong>${item.quantity} × ${escapeHtml(item.name)}</strong> · ${escapeHtml(money(item.lineTotalCents))}<br>${escapeHtml(money(item.unitPriceCents))} cad.${item.modifiers.length ? `<br>${escapeHtml(item.modifiers.map((mod) => `${mod.label} (+${money(mod.deltaPriceCents)})`).join(", "))}` : ""}</li>`).join("")}</ul><p>Piatti: ${escapeHtml(money(order.subtotalCents))}<br>${escapeHtml(fulfillment)}: ${escapeHtml(money(order.deliveryFeeCents))}</p><h2>Totale: ${escapeHtml(money(order.totalCents))}</h2><p>${escapeHtml(payment)}</p><p><a referrerpolicy="no-referrer" href="${escapeHtml(trackingUrl)}">Segui il tuo ordine</a></p><p>Conserva privatamente questo collegamento.</p><hr><p>Ristorante e ordine immaginari. Questo riepilogo non è un documento fiscale. Nessuna email reale viene inviata dal sink locale.</p></main></body></html>`;
  return {
    to,
    subject: `Riepilogo dell’ordine ${order.orderNumber} · ${order.restaurant.name}`,
    text,
    html,
  };
};
