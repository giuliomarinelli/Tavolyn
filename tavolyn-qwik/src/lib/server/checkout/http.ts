import type { RequestEvent } from "@builder.io/qwik-city";
import { getRequestTenant } from "../tenants/tenant-service";
import { CheckoutError, parseOrder, parseQuote } from "./validation";
import { quoteCart } from "./quote-service";
import { createOrder } from "./order-service";

export const readCheckoutBody = async (request: Request): Promise<unknown> => {
  const origin = new URL(request.url).origin;
  if (
    request.headers.get("Origin") !== origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    throw new CheckoutError(
      403,
      "ORIGIN_REJECTED",
      "Invia la richiesta dal sito del ristorante.",
    );
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new CheckoutError(
      415,
      "JSON_REQUIRED",
      "È richiesta una richiesta JSON.",
    );
  if (Number(request.headers.get("Content-Length")) > 32768)
    throw new CheckoutError(
      413,
      "REQUEST_TOO_LARGE",
      "Richiesta troppo grande.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutError(400, "INVALID_JSON", "Richiesta vuota.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 32768) {
        await reader.cancel();
        throw new CheckoutError(
          413,
          "REQUEST_TOO_LARGE",
          "Richiesta troppo grande.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new CheckoutError(400, "INVALID_JSON", "JSON non valido.");
  }
};

export const checkoutHandler = async (
  event: RequestEvent,
  operation: "quote" | "order",
): Promise<void> => {
  event.headers.set("Referrer-Policy", "no-referrer");
  let result: unknown;
  let status = 200;
  try {
    const tenant = getRequestTenant(event);
    const body = await readCheckoutBody(event.request);
    if (operation === "quote")
      result = await quoteCart(
        event.platform.env.DB,
        tenant.id,
        tenant.site.currency,
        parseQuote(body),
      );
    else {
      const created = await createOrder(
        event.platform.env.DB,
        event.platform.env.ORDER_TOKEN_KEY,
        tenant.id,
        tenant.site.slug,
        tenant.site.currency,
        parseOrder(body),
      );
      status = created.replay ? 200 : 201;
      result = created.receipt;
    }
  } catch (error) {
    const failure =
      error instanceof CheckoutError
        ? error
        : new CheckoutError(
            503,
            "CHECKOUT_UNAVAILABLE",
            "Checkout temporaneamente non disponibile. Riprova più tardi.",
          );
    status = failure.status;
    result = {
      error: {
        code: failure.code,
        message: failure.message,
        requestId: crypto.randomUUID(),
      },
    };
  }
  event.json(status, result);
};
