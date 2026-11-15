import { logout, only } from "../../../../lib/server/auth/http";
export const onRequest = only("POST");
export const onPost = logout;
