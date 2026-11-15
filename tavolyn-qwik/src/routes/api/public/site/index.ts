import type { RequestHandler } from "@builder.io/qwik-city";
import { getRequestTenant } from "../../../../lib/server/tenants/tenant-service";

export const onRequest: RequestHandler = (event) => {
  if (event.method !== "GET" && event.method !== "HEAD") {
    event.headers.set("Allow", "GET, HEAD");
    throw event.json(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Metodo non consentito",
        requestId: crypto.randomUUID(),
      },
    });
  }
};

export const onGet: RequestHandler = (event) => {
  event.json(200, getRequestTenant(event).site);
};

export const onHead: RequestHandler = ({ headers, send }) => {
  headers.set("Content-Type", "application/json; charset=utf-8");
  send(200, "");
};
