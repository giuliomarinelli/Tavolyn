import { CheckoutError } from "./validation";
const encode = (value: string) => new TextEncoder().encode(value);
const hex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
export const digest = async (value: string): Promise<string> =>
  hex(await crypto.subtle.digest("SHA-256", encode(value)));
export const trackingToken = async (
  secret: string,
  tenantId: string,
  orderId: string,
  nonce: string,
): Promise<string> => {
  if (typeof secret !== "string" || !/^[0-9a-f]{64}$/i.test(secret))
    throw new CheckoutError(
      503,
      "CHECKOUT_UNAVAILABLE",
      "Checkout temporaneamente non disponibile.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secret.match(/../g)!, (pair) => parseInt(pair, 16)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encode(
      JSON.stringify(["tavolyn.order-tracking.v1", tenantId, orderId, nonce]),
    ),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};
export const randomNonce = (): string =>
  hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
