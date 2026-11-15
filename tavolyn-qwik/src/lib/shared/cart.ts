import {
  configurationError,
  type RestaurantMenu,
  type MenuProduct,
} from "./catalog";

export interface CartItem {
  productId: string;
  modifierIds: string[];
  quantity: number;
}

export const cartKey = (tenantSlug: string): string =>
  `tavolyn:cart:v1:${tenantSlug}`;
export const itemKey = (
  item: Pick<CartItem, "productId" | "modifierIds">,
): string => `${item.productId}:${[...item.modifierIds].sort().join(",")}`;
export const menuProducts = (menu: RestaurantMenu): MenuProduct[] =>
  menu.categories.flatMap((category) => category.products);

export const validQuantity = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 99;

export const restoreCart = (
  raw: string | null,
  menu: RestaurantMenu,
): { items: CartItem[]; changed: boolean } => {
  if (!raw) return { items: [], changed: false };
  try {
    if (raw.length > 100_000) throw new Error("Oversized cart");
    const saved: unknown = JSON.parse(raw);
    if (
      !saved ||
      typeof saved !== "object" ||
      !("version" in saved) ||
      saved.version !== 1 ||
      !("items" in saved) ||
      !Array.isArray(saved.items) ||
      saved.items.length > 50
    )
      throw new Error("Invalid cart");
    const items: CartItem[] = [];
    const products = menuProducts(menu);
    let changed = false;
    for (const value of saved.items as unknown[]) {
      if (
        !value ||
        typeof value !== "object" ||
        !("productId" in value) ||
        typeof value.productId !== "string" ||
        !("quantity" in value) ||
        !validQuantity(value.quantity) ||
        !("modifierIds" in value) ||
        !Array.isArray(value.modifierIds) ||
        value.modifierIds.length > 100 ||
        !value.modifierIds.every((id): id is string => typeof id === "string")
      ) {
        changed = true;
        continue;
      }
      const product = products.find((entry) => entry.id === value.productId);
      if (!product || configurationError(product, value.modifierIds)) {
        changed = true;
        continue;
      }
      const item = {
        productId: value.productId,
        modifierIds: [...value.modifierIds].sort(),
        quantity: value.quantity,
      };
      const duplicate = items.find((entry) => itemKey(entry) === itemKey(item));
      if (duplicate) {
        duplicate.quantity = Math.min(99, duplicate.quantity + item.quantity);
        changed = true;
      } else items.push(item);
    }
    return { items, changed };
  } catch {
    return { items: [], changed: true };
  }
};
