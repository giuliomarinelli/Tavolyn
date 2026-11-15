import type { CartItem } from "./cart";
export type Fulfillment = "PICKUP" | "DELIVERY";
export type PaymentMethod = "CASH" | "MOCK_CARD";
export interface CheckoutSettings {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFeeCents: number;
}
export interface QuoteInput {
  items: CartItem[];
  fulfillment: Fulfillment;
}
export interface QuotedItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  modifiers: { id: string; label: string; deltaPriceCents: number }[];
}
export interface Quote {
  currency: string;
  fulfillment: Fulfillment;
  items: QuotedItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  quoteFingerprint: string;
}
export interface OrderInput {
  idempotencyKey: string;
  cart: { items: CartItem[] };
  fulfillment: Fulfillment;
  quoteFingerprint: string;
  contact: { name: string; email: string; phone: string };
  address: { street: string; city: string; postalCode: string } | null;
  paymentMethod: PaymentMethod;
  mockPaymentResult: "SUCCESS" | "FAILURE" | null;
  notes: string;
}
export interface OrderReceipt extends Quote {
  orderNumber: string;
  status: "NEW";
  paymentMethod: PaymentMethod;
  paymentStatus: "UNPAID" | "PAID_SIMULATED";
  createdAt: string;
}
export interface OrderResponse extends OrderReceipt {
  trackingToken: string;
}
export interface ApiFailure {
  error: { code: string; message: string; requestId: string };
}
