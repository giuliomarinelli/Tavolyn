import type { RequestHandler } from "@builder.io/qwik-city";
import { getRequestTenant } from "../../../../../lib/server/tenants/tenant-service";
import { readTrackedOrder } from "../../../../../lib/server/tracking/tracking-service";

export const onRequest: RequestHandler = (event) => {
  if (event.request.method !== "GET") {
    event.headers.set("Allow", "GET");
    throw event.json(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Usa GET per consultare l’ordine",
        requestId: crypto.randomUUID(),
      },
    });
  }
};
export const onGet: RequestHandler = async (event) => {
  let order;
  try {
    order = await readTrackedOrder(
      event.platform.env.DB,
      getRequestTenant(event),
      event.params.trackingToken,
    );
  } catch {
    throw event.json(503, {
      error: {
        code: "TRACKING_UNAVAILABLE",
        message: "Stato temporaneamente non disponibile. Riprova tra poco.",
        requestId: crypto.randomUUID(),
      },
    });
  }
  if (!order)
    throw event.json(404, {
      error: {
        code: "ORDER_NOT_FOUND",
        message: "Ordine non disponibile.",
        requestId: crypto.randomUUID(),
      },
    });
  event.json(200, order);
};
