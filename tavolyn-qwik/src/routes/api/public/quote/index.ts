import type { RequestHandler } from "@builder.io/qwik-city";
import { checkoutHandler } from "../../../../lib/server/checkout/http";
export const onRequest: RequestHandler = (event) => {
  if (event.request.method !== "POST") {
    event.headers.set("Allow", "POST");
    throw event.json(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Usa POST per il preventivo",
        requestId: crypto.randomUUID(),
      },
    });
  }
};
export const onPost: RequestHandler = (event) =>
  checkoutHandler(event, "quote");
