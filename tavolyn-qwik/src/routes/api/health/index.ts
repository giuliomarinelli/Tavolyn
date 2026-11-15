import type { RequestHandler } from "@builder.io/qwik-city";
import { getHealth } from "../../../lib/server/health/health-service";

export const onGet: RequestHandler = ({ headers, json }) => {
  headers.set("Cache-Control", "no-store");
  json(200, getHealth());
};
