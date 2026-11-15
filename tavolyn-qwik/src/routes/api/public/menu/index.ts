import type { RequestHandler } from "@builder.io/qwik-city";
import { getRequestMenu } from "../../../../lib/server/catalog/catalog-service";

export const onRequest: RequestHandler = (event) => {
  if (event.request.method !== "GET") {
    event.headers.set("Allow", "GET");
    throw event.json(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Il menu è disponibile in sola lettura",
        requestId: crypto.randomUUID(),
      },
    });
  }
};

export const onGet: RequestHandler = async (event) => {
  event.json(200, await getRequestMenu(event));
};
