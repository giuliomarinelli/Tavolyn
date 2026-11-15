export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "REJECTED";
export const statusLabel: Record<OrderStatus, string> = {
  NEW: "Ordine ricevuto",
  ACCEPTED: "Ordine accettato",
  PREPARING: "In preparazione",
  READY: "Pronto",
  COMPLETED: "Completato",
  REJECTED: "Ordine non accettato",
};
export interface TrackingItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  modifiers: { label: string; deltaPriceCents: number }[];
}
export interface PublicOrderEvent {
  type: "ORDER_CREATED" | "ORDER_STATUS_CHANGED";
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  occurredAt: string;
}
export interface TrackedOrder {
  orderNumber: string;
  restaurant: { name: string; slug: string };
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  fulfillment: "PICKUP" | "DELIVERY";
  paymentMethod: "CASH" | "MOCK_CARD";
  paymentStatus: "UNPAID" | "PAID_SIMULATED";
  currency: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  items: TrackingItem[];
  timeline: PublicOrderEvent[];
}
export const displayTime = (value: string, timezone = "Europe/Rome"): string =>
  new Intl.DateTimeFormat("it-IT", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
