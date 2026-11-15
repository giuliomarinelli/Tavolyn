import { describe, expect, it } from "vitest";
import {
  configurationError,
  configuredPrice,
  type MenuProduct,
  type RestaurantMenu,
} from "../src/lib/shared/catalog";
import {
  cartKey,
  itemKey,
  restoreCart,
  validQuantity,
} from "../src/lib/shared/cart";

const product: MenuProduct = {
  id: "pizza",
  slug: "pizza",
  name: "Pizza",
  description: "Demo",
  basePriceCents: 800,
  available: true,
  modifierGroups: [
    {
      id: "dough",
      title: "Impasto",
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        {
          id: "classic",
          label: "Classico",
          deltaPriceCents: 0,
          available: true,
        },
        {
          id: "whole",
          label: "Integrale",
          deltaPriceCents: 150,
          available: true,
        },
      ],
    },
    {
      id: "extras",
      title: "Extra",
      minSelect: 0,
      maxSelect: 2,
      modifiers: [
        { id: "a", label: "A", deltaPriceCents: 100, available: true },
        { id: "b", label: "B", deltaPriceCents: 250, available: true },
        { id: "c", label: "C", deltaPriceCents: 200, available: true },
        {
          id: "sold",
          label: "Esaurito",
          deltaPriceCents: 300,
          available: false,
        },
      ],
    },
  ],
};
const menu: RestaurantMenu = {
  currency: "EUR",
  categories: [{ id: "pizze", name: "Pizze", products: [product] }],
};
const save = (items: unknown[]) => JSON.stringify({ version: 1, items });

describe("catalog configuration and tenant-local cart", () => {
  it.each([
    [],
    ["classic", "whole"],
    ["classic", "a", "b", "c"],
    ["classic", "sold"],
    ["classic", "foreign"],
    ["classic", "classic"],
  ])("rejects invalid selection %j", (...ids) => {
    // Each case is a list of selected modifier IDs.
    expect(configurationError(product, ids)).not.toBeNull();
  });
  it("accepts required and optional bounds and adds integer supplements", () => {
    expect(configurationError(product, ["classic"])).toBeNull();
    expect(configurationError(product, ["whole", "a", "b"])).toBeNull();
    expect(configuredPrice(product, ["whole", "a", "b"])).toBe(1300);
    expect(
      configurationError({ ...product, available: false }, ["classic"]),
    ).not.toBeNull();
  });
  it("isolates keys and normalizes equivalent configurations", () => {
    expect(cartKey("aurora")).not.toBe(cartKey("nodo"));
    expect(itemKey({ productId: "pizza", modifierIds: ["a", "classic"] })).toBe(
      itemKey({ productId: "pizza", modifierIds: ["classic", "a"] }),
    );
  });
  it("restores references only and ignores forged prices/names", () => {
    const saved = save([
      {
        productId: "pizza",
        quantity: 2,
        modifierIds: ["whole"],
        price: 1,
        name: "Forged",
      },
    ]);
    expect(restoreCart(saved, menu)).toEqual({
      items: [{ productId: "pizza", quantity: 2, modifierIds: ["whole"] }],
      changed: false,
    });
  });
  it("drops unavailable, foreign, invalid or stale lines without losing valid ones", () => {
    const entries = [
      { productId: "pizza", quantity: 2, modifierIds: ["classic"] },
      { productId: "other-tenant", quantity: 1, modifierIds: [] },
      { productId: "pizza", quantity: 0, modifierIds: ["classic"] },
      { productId: "pizza", quantity: 1, modifierIds: [] },
      { productId: "pizza", quantity: 1, modifierIds: ["classic", "sold"] },
    ];
    expect(restoreCart(save(entries), menu)).toEqual({
      items: [entries[0]],
      changed: true,
    });
    expect(
      restoreCart(save([entries[0]]), { currency: "EUR", categories: [] }),
    ).toEqual({ items: [], changed: true });
  });
  it.each([
    "broken",
    '{"version":2,"items":[]}',
    '{"version":1,"items":{}}',
    "x".repeat(100001),
  ])("safely rejects corrupt storage %#", (raw) => {
    expect(restoreCart(raw, menu)).toEqual({ items: [], changed: true });
  });
  it("merges duplicates and bounds stored quantities", () => {
    const item = { productId: "pizza", quantity: 60, modifierIds: ["classic"] };
    expect(restoreCart(save([item, item]), menu).items[0].quantity).toBe(99);
    for (const invalid of [0, -1, 100, 1.5, "2", NaN, Infinity])
      expect(validQuantity(invalid)).toBe(false);
  });
});
