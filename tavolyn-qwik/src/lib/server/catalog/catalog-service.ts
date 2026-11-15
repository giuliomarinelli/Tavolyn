import type { RequestEventCommon } from "@builder.io/qwik-city";
import { getRequestTenant } from "../tenants/tenant-service";
import type {
  RestaurantMenu,
  MenuProduct,
  MenuModifierGroup,
} from "../../shared/catalog";

interface CategoryRow {
  id: string;
  name: string;
}
interface ProductRow {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string;
  base_price_cents: number;
  available: number;
}
interface GroupRow {
  id: string;
  product_id: string;
  title: string;
  min_select: number;
  max_select: number;
}
interface ModifierRow {
  id: string;
  group_id: string;
  label: string;
  delta_price_cents: number;
  available: number;
}

export const readMenu = async (
  db: D1Database,
  tenantId: string,
  currency: string,
): Promise<RestaurantMenu> => {
  // One atomic D1 read batch; every query binds the server-resolved tenant.
  const [categories, products, groups, modifiers] = await db.batch([
    db
      .prepare(
        "SELECT id, name FROM categories WHERE tenant_id = ? AND active = 1 ORDER BY sort_order, id",
      )
      .bind(tenantId),
    db
      .prepare(
        `SELECT p.id, p.category_id, p.slug, p.name, p.description, p.base_price_cents, p.available
      FROM products p JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = p.category_id
      WHERE p.tenant_id = ? AND c.active = 1 ORDER BY p.sort_order, p.id`,
      )
      .bind(tenantId),
    db
      .prepare(
        `SELECT g.id, g.product_id, g.title, g.min_select, g.max_select
      FROM modifier_groups g JOIN products p ON p.tenant_id = g.tenant_id AND p.id = g.product_id
      JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = p.category_id
      WHERE g.tenant_id = ? AND c.active = 1 ORDER BY g.sort_order, g.id`,
      )
      .bind(tenantId),
    db
      .prepare(
        `SELECT m.id, m.group_id, m.label, m.delta_price_cents, m.available
      FROM modifiers m JOIN modifier_groups g ON g.tenant_id = m.tenant_id AND g.id = m.group_id
      JOIN products p ON p.tenant_id = g.tenant_id AND p.id = g.product_id
      JOIN categories c ON c.tenant_id = p.tenant_id AND c.id = p.category_id
      WHERE m.tenant_id = ? AND c.active = 1 ORDER BY m.sort_order, m.id`,
      )
      .bind(tenantId),
  ]);
  const groupMap = new Map<string, MenuModifierGroup>();
  for (const row of groups.results as GroupRow[]) {
    groupMap.set(row.id, {
      id: row.id,
      title: row.title,
      minSelect: row.min_select,
      maxSelect: row.max_select,
      modifiers: [],
    });
  }
  for (const row of modifiers.results as ModifierRow[]) {
    groupMap
      .get(row.group_id)
      ?.modifiers.push({
        id: row.id,
        label: row.label,
        deltaPriceCents: row.delta_price_cents,
        available: row.available === 1,
      });
  }
  const productMap = new Map<string, MenuProduct>();
  for (const row of products.results as ProductRow[]) {
    productMap.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      basePriceCents: row.base_price_cents,
      available: row.available === 1,
      modifierGroups: [],
    });
  }
  for (const row of groups.results as GroupRow[]) {
    productMap.get(row.product_id)?.modifierGroups.push(groupMap.get(row.id)!);
  }
  return {
    currency,
    categories: (categories.results as CategoryRow[]).map((category) => ({
      id: category.id,
      name: category.name,
      products: (products.results as ProductRow[])
        .filter((product) => product.category_id === category.id)
        .map((product) => productMap.get(product.id)!),
    })),
  };
};

export const getRequestMenu = async (
  event: RequestEventCommon,
): Promise<RestaurantMenu> => {
  const tenant = getRequestTenant(event);
  try {
    return await readMenu(
      event.platform.env.DB,
      tenant.id,
      tenant.site.currency,
    );
  } catch {
    const message =
      "Il menu è temporaneamente non disponibile. Riprova tra poco.";
    if (event.pathname.startsWith("/api/"))
      throw event.json(503, {
        error: {
          code: "MENU_UNAVAILABLE",
          message,
          requestId: crypto.randomUUID(),
        },
      });
    throw event.error(503, message);
  }
};
