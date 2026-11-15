import { callback, only } from "../../../../lib/server/auth/http";
export const onRequest = only("GET");
export const onGet = callback;
