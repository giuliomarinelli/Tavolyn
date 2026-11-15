import { me, only } from "../../../../lib/server/auth/http";
export const onRequest = only("GET");
export const onGet = me;
