export const hash = async (value: string): Promise<string> =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
export const opaque = (): string =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
export const validOpaque = (value: string): boolean =>
  /^[A-Za-z0-9_-]{43}$/.test(value);
const key = (secret: string, usages: KeyUsage[]) =>
  crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secret.match(/../g)!, (v) => parseInt(v, 16)),
    "AES-GCM",
    false,
    usages,
  );
// Independent random IV for every transaction; AAD binds ciphertext to its lookup/context.
export const seal = async (
  secret: string,
  value: string,
  aad: string,
): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) },
    await key(secret, ["encrypt"]),
    new TextEncoder().encode(value),
  );
  return JSON.stringify([Array.from(iv), Array.from(new Uint8Array(data))]);
};
export const unseal = async (
  secret: string,
  value: string,
  aad: string,
): Promise<string> => {
  const [iv, data]: number[][] = JSON.parse(value);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(iv),
        additionalData: new TextEncoder().encode(aad),
      },
      await key(secret, ["decrypt"]),
      new Uint8Array(data),
    ),
  );
};
