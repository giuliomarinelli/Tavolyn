import { itemKey, validQuantity, type CartItem } from "../../shared/cart";
import type { OrderInput, QuoteInput } from "../../shared/checkout";

export class CheckoutError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CheckoutError(
      422,
      "INVALID_INPUT",
      "Controlla i dati della richiesta.",
    );
  return value as Record<string, unknown>;
};
const text = (
  value: unknown,
  min: number,
  max: number,
  multiline = false,
): string => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    Array.from(value).some(
      (character) =>
        (character.charCodeAt(0) < 32 && !(multiline && character === "\n")) ||
        character.charCodeAt(0) === 127,
    )
  )
    throw new CheckoutError(
      422,
      "INVALID_INPUT",
      "Un campo è mancante, troppo lungo o non valido.",
    );
  return value.trim();
};
export const parseQuote = (value: unknown): QuoteInput => {
  const body = object(value);
  if (body.fulfillment !== "PICKUP" && body.fulfillment !== "DELIVERY")
    throw new CheckoutError(
      422,
      "INVALID_FULFILLMENT",
      "Scegli ritiro o consegna.",
    );
  if (
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 50
  )
    throw new CheckoutError(
      422,
      "INVALID_CART",
      "Il carrello deve contenere da 1 a 50 configurazioni.",
    );
  const items: CartItem[] = body.items
    .map((value: unknown) => {
      const row = object(value);
      const productId = text(row.productId, 1, 100);
      if (
        !validQuantity(row.quantity) ||
        !Array.isArray(row.modifierIds) ||
        row.modifierIds.length > 100
      )
        throw new CheckoutError(
          422,
          "INVALID_CART",
          "Quantità o selezioni non valide.",
        );
      const modifierIds = row.modifierIds
        .map((id: unknown) => text(id, 1, 100))
        .sort();
      if (new Set(modifierIds).size !== modifierIds.length)
        throw new CheckoutError(
          422,
          "INVALID_CART",
          "Le opzioni non possono essere duplicate.",
        );
      return { productId, quantity: row.quantity, modifierIds };
    })
    .sort((a, b) => itemKey(a).localeCompare(itemKey(b)));
  if (
    new Set(items.map(itemKey)).size !== items.length ||
    items.reduce((sum, item) => sum + item.quantity, 0) > 100
  )
    throw new CheckoutError(
      422,
      "INVALID_CART",
      "Massimo 100 articoli; unisci le configurazioni duplicate.",
    );
  return { items, fulfillment: body.fulfillment };
};
export const parseOrder = (value: unknown): OrderInput => {
  const body = object(value);
  const quote = parseQuote({
    ...object(body.cart),
    fulfillment: body.fulfillment,
  });
  const idempotencyKey = text(body.idempotencyKey, 36, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotencyKey,
    )
  )
    throw new CheckoutError(
      422,
      "INVALID_KEY",
      "Chiave della richiesta non valida.",
    );
  const quoteFingerprint = text(body.quoteFingerprint, 64, 64);
  if (!/^[0-9a-f]{64}$/.test(quoteFingerprint))
    throw new CheckoutError(
      422,
      "INVALID_QUOTE",
      "Aggiorna il preventivo prima di confermare.",
    );
  const rawContact = object(body.contact);
  const contact = {
    name: text(rawContact.name, 2, 100),
    email: text(rawContact.email, 3, 254).toLowerCase(),
    phone: text(rawContact.phone, 5, 30),
  };
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ||
    !/^[+0-9 ().-]+$/.test(contact.phone)
  )
    throw new CheckoutError(
      422,
      "INVALID_CONTACT",
      "Controlla email e telefono.",
    );
  let address: OrderInput["address"] = null;
  if (quote.fulfillment === "DELIVERY") {
    const raw = object(body.address);
    address = {
      street: text(raw.street, 5, 200),
      city: text(raw.city, 2, 100),
      postalCode: text(raw.postalCode, 5, 5),
    };
    if (!/^\d{5}$/.test(address.postalCode))
      throw new CheckoutError(
        422,
        "INVALID_ADDRESS",
        "Inserisci un CAP italiano di cinque cifre.",
      );
  }
  if (body.paymentMethod !== "CASH" && body.paymentMethod !== "MOCK_CARD")
    throw new CheckoutError(
      422,
      "INVALID_PAYMENT",
      "Scegli una modalità di pagamento dimostrativa.",
    );
  if (
    body.paymentMethod === "MOCK_CARD" &&
    body.mockPaymentResult !== "SUCCESS" &&
    body.mockPaymentResult !== "FAILURE"
  )
    throw new CheckoutError(
      422,
      "INVALID_PAYMENT",
      "Scegli l’esito della simulazione.",
    );
  return {
    idempotencyKey: idempotencyKey.toLowerCase(),
    cart: { items: quote.items },
    fulfillment: quote.fulfillment,
    quoteFingerprint,
    contact,
    address,
    paymentMethod: body.paymentMethod,
    mockPaymentResult:
      body.paymentMethod === "MOCK_CARD"
        ? (body.mockPaymentResult as "SUCCESS" | "FAILURE")
        : null,
    notes:
      body.notes === undefined
        ? ""
        : text(
            typeof body.notes === "string"
              ? body.notes.replaceAll("\r\n", "\n")
              : body.notes,
            0,
            500,
            true,
          ),
  };
};
