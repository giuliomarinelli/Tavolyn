import type { HealthResponse } from "../../shared/health";

// Liveness only: D1 and Cognito are intentionally outside TAV-MVP-01.
export const getHealth = (): HealthResponse => ({
  status: "ok",
  service: "tavolyn",
});
