export type StaffRole = "OWNER" | "OPERATOR";
export type Capability = "order.read" | "order.manage";
export interface StaffIdentity {
  identity: { label: string };
  tenant: { slug: string; name: string };
  role: StaffRole;
  capabilities: Capability[];
  expiresAt: string;
}
