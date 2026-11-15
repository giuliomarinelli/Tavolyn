import { createContextId, useContext } from "@builder.io/qwik";
import type { CartItem } from "../../lib/shared/cart";

export interface CartState {
  items: CartItem[];
  ready: boolean;
  notice: string;
}

export const CartContext = createContextId<CartState>("tavolyn.cart");
export const useCart = () => useContext(CartContext);
