import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createTestHarness, unstable_splitSqlQuery } from "wrangler";
import type { RestaurantMenu } from "../src/lib/shared/catalog";
import type {
  OrderInput,
  OrderResponse,
  Quote,
} from "../src/lib/shared/checkout";
import { digest } from "../src/lib/server/checkout/crypto";

const aurora = "https://aurora.tavolyn.test";
const nodo = "https://nodo.tavolyn.test";
const tenantA = "bbf324b9-0aab-4e61-9001-4ed11d0e05b1";
const tenantN = "0fb0bff7-67e2-4848-9002-c975c0748af2";
const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
  n.toString(16).padStart(2, "0"),
).join("");
const config = {
  configPath: "./wrangler.jsonc",
  vars: { ORDER_TOKEN_KEY: secret },
};
const server = createTestHarness({ workers: [config] });
let db: D1Database;
const sql = async (source: string) => {
  await db.batch(unstable_splitSqlQuery(source).map((s) => db.prepare(s)));
};
const post = (
  path: string,
  body: unknown,
  origin = aurora,
  headers: Record<string, string> = {},
) =>
  server.fetch(`${origin}/api/public/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...headers },
    body: JSON.stringify(body),
  });
const menu = async (origin = aurora) =>
  (await (
    await server.fetch(`${origin}/api/public/menu`)
  ).json()) as RestaurantMenu;
const cart = async (origin = aurora) => {
  const catalog = await menu(origin);
  const product = catalog.categories
    .flatMap((c) => c.products)
    .find(
      (p) => p.slug === (origin === aurora ? "margherita" : "margherita-lab"),
    )!;
  return {
    productId: product.id,
    quantity: 2,
    modifierIds: product.modifierGroups.flatMap((g) =>
      g.modifiers
        .filter((m) => m.available)
        .slice(0, g.minSelect)
        .map((m) => m.id),
    ),
  };
};
const command = async (
  origin = aurora,
  override: Partial<OrderInput> = {},
): Promise<OrderInput> => {
  const items = [await cart(origin)];
  const response = await post(
    "quote",
    { items, fulfillment: override.fulfillment || "PICKUP" },
    origin,
  );
  expect(response.status).toBe(200);
  const quote = (await response.json()) as Quote;
  return {
    idempotencyKey: crypto.randomUUID(),
    cart: { items },
    fulfillment: "PICKUP",
    quoteFingerprint: quote.quoteFingerprint,
    contact: {
      name: "Visitatore Demo",
      email: "ospite@example.test",
      phone: "+39 000 000 0000",
    },
    address: null,
    paymentMethod: "MOCK_CARD",
    mockPaymentResult: "SUCCESS",
    notes: "Solo dati fittizi",
    ...override,
  };
};
const counts = async () => {
  const values: unknown[] = [];
  for (const table of [
    "orders",
    "order_items",
    "order_access",
    "idempotency_records",
  ])
    values.push(
      await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first("n"),
    );
  return values;
};

beforeAll(async () => {
  await server.listen();
  db = (await server.getWorker<Env>().getEnv()).DB;
  for (const file of [
    "migrations/0001_tenants.sql",
    "seeds/demo-tenants.sql",
    "migrations/0002_catalog.sql",
    "seeds/demo-catalog.sql",
    "migrations/0003_checkout.sql",
    "seeds/demo-checkout.sql",
  ])
    await sql(await readFile(file, "utf8"));
});
afterAll(async () => {
  await server.close();
});

describe("server-authoritative quotes", () => {
  it.each([
    [aurora, 2600, 350],
    [nodo, 3200, 450],
  ] as const)(
    "calculates supplements, quantity and tenant delivery for %s",
    async (origin, subtotal, fee) => {
      const catalog = await menu(origin);
      const product = catalog.categories
        .flatMap((c) => c.products)
        .find(
          (p) =>
            p.slug === (origin === aurora ? "margherita" : "margherita-lab"),
        )!;
      const modifierIds = [
        product.modifierGroups[0].modifiers[1].id,
        ...product.modifierGroups[1].modifiers.slice(0, 2).map((m) => m.id),
      ];
      for (const fulfillment of ["PICKUP", "DELIVERY"]) {
        const response = await post(
          "quote",
          {
            items: [
              {
                productId: product.id,
                quantity: 2,
                modifierIds,
                unitPriceCents: 1,
              },
            ],
            fulfillment,
            totalCents: 1,
            tenantId: origin === aurora ? tenantN : tenantA,
          },
          origin,
        );
        expect(response.status).toBe(200);
        const result = (await response.json()) as Quote;
        expect(result.subtotalCents).toBe(subtotal);
        expect(result.deliveryFeeCents).toBe(
          fulfillment === "PICKUP" ? 0 : fee,
        );
        expect(result.totalCents).toBe(
          subtotal + (fulfillment === "PICKUP" ? 0 : fee),
        );
        expect(result.items[0].modifiers).toHaveLength(3);
        expect(result.currency).toBe("EUR");
        expect(result.quoteFingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      }
    },
  );
  it("rejects foreign, missing and unavailable products and invalid modifiers", async () => {
    const own = await cart();
    const foreign = await cart(nodo);
    const catalog = await menu();
    const unavailable = catalog.categories
      .flatMap((c) => c.products)
      .find((p) => !p.available)!;
    const product = catalog.categories
      .flatMap((c) => c.products)
      .find((p) => p.id === own.productId)!;
    for (const item of [
      foreign,
      { ...own, productId: "missing" },
      { ...own, productId: unavailable.id },
      { ...own, modifierIds: [] },
      {
        ...own,
        modifierIds: [
          product.modifierGroups[0].modifiers[0].id,
          product.modifierGroups[0].modifiers[1].id,
        ],
      },
      {
        ...own,
        modifierIds: [
          ...own.modifierIds,
          ...product.modifierGroups[1].modifiers.slice(0, 3).map((m) => m.id),
        ],
      },
      {
        ...own,
        modifierIds: [
          ...own.modifierIds,
          product.modifierGroups[1].modifiers.find((m) => !m.available)!.id,
        ],
      },
    ]) {
      const response = await post("quote", {
        items: [item],
        fulfillment: "PICKUP",
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: { code: "CART_CHANGED" },
      });
    }
  });
  it.each([0, -1, 100, 1.5, "2"])(
    "rejects invalid quantity %j",
    async (quantity) => {
      expect(
        (
          await post("quote", {
            items: [{ ...(await cart()), quantity }],
            fulfillment: "PICKUP",
          })
        ).status,
      ).toBe(422);
    },
  );
  it("bounds request size, cart size, duplicates and total quantity", async () => {
    const item = await cart();
    for (const items of [
      [],
      Array(51).fill(item),
      [item, item],
      [
        { ...item, quantity: 99 },
        { ...item, modifierIds: [...item.modifierIds, "extra"], quantity: 2 },
      ],
    ])
      expect(
        (await post("quote", { items, fulfillment: "PICKUP" })).status,
      ).toBe(422);
    expect(
      (
        await post("quote", {
          items: [item],
          fulfillment: "PICKUP",
          extra: "x".repeat(40000),
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await post("quote", { items: [item], fulfillment: "PICKUP" }, aurora, {
          Origin: nodo,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post("quote", { items: [item], fulfillment: "PICKUP" }, aurora, {
          "Content-Type": "text/plain",
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
  });
  it("fails safely for malformed JSON and unsupported methods", async () => {
    const bad = await server.fetch(`${aurora}/api/public/quote`, {
      method: "POST",
      headers: { Origin: aurora, "Content-Type": "application/json" },
      body: "{",
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: "INVALID_JSON" } });
    expect((await server.fetch(`${aurora}/api/public/orders`)).status).toBe(
      405,
    );
    expect(
      (
        await server.fetch("https://unknown.test/api/public/quote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://unknown.test",
          },
        })
      ).status,
    ).toBe(404);
  });
  it("respects delivery availability, order amount limit and seed edits", async () => {
    const original = await db
      .prepare("SELECT * FROM tenant_checkout_settings ORDER BY tenant_id")
      .all();
    await db
      .prepare(
        "UPDATE tenant_checkout_settings SET delivery_enabled = 0, delivery_fee_cents = 777 WHERE tenant_id = ?",
      )
      .bind(tenantA)
      .run();
    try {
      await sql(await readFile("seeds/demo-checkout.sql", "utf8"));
      expect(
        await db
          .prepare(
            "SELECT delivery_fee_cents FROM tenant_checkout_settings WHERE tenant_id = ?",
          )
          .bind(tenantA)
          .first("delivery_fee_cents"),
      ).toBe(777);
      expect(
        (
          await post("quote", {
            items: [await cart()],
            fulfillment: "DELIVERY",
          })
        ).status,
      ).toBe(409);
    } finally {
      await db
        .prepare(
          "UPDATE tenant_checkout_settings SET delivery_enabled = 1, delivery_fee_cents = 350 WHERE tenant_id = ?",
        )
        .bind(tenantA)
        .run();
    }
    expect(
      (
        await db
          .prepare("SELECT * FROM tenant_checkout_settings ORDER BY tenant_id")
          .all()
      ).results,
    ).toEqual(original.results);
    const item = await cart();
    await db
      .prepare(
        "UPDATE products SET base_price_cents = 150000 WHERE tenant_id = ? AND id = ?",
      )
      .bind(tenantA, item.productId)
      .run();
    try {
      expect(
        (await post("quote", { items: [item], fulfillment: "PICKUP" })).status,
      ).toBe(422);
    } finally {
      await db
        .prepare(
          "UPDATE products SET base_price_cents = 800 WHERE tenant_id = ? AND id = ?",
        )
        .bind(tenantA, item.productId)
        .run();
    }
  });
});

describe("atomic, idempotent guest orders", () => {
  it("persists snapshots, hashes only and an immutable simulated payment", async () => {
    const input = await command();
    const response = await post("orders", {
      ...input,
      tenantId: tenantN,
      totalCents: 1,
      status: "COMPLETED",
      paymentStatus: "UNPAID",
    });
    expect(response.status).toBe(201);
    const result = (await response.json()) as OrderResponse;
    expect(result).toMatchObject({
      totalCents: 1600,
      status: "NEW",
      paymentStatus: "PAID_SIMULATED",
      paymentMethod: "MOCK_CARD",
    });
    expect(result.trackingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.trackingToken).not.toBe(result.orderNumber);
    const order = await db
      .prepare("SELECT * FROM orders WHERE tenant_id = ? AND order_number = ?")
      .bind(tenantA, result.orderNumber)
      .first<{
        id: string;
        total_cents: number;
        contact_snapshot_json: string;
        created_at: string;
      }>();
    expect(order?.total_cents).toBe(1600);
    expect(JSON.parse(order!.contact_snapshot_json)).toEqual(input.contact);
    expect(order!.created_at).toBe(result.createdAt);
    const access = await db
      .prepare(
        "SELECT * FROM order_access WHERE tenant_id = ? AND order_id = ?",
      )
      .bind(tenantA, order!.id)
      .first<{ tracking_hash: string; token_nonce: string }>();
    expect(access!.tracking_hash).toBe(await digest(result.trackingToken));
    const record = await db
      .prepare(
        "SELECT * FROM idempotency_records WHERE tenant_id = ? AND order_id = ?",
      )
      .bind(tenantA, order!.id)
      .first();
    expect(JSON.stringify(record)).not.toContain(result.trackingToken);
    expect(JSON.stringify(record)).not.toContain(input.idempotencyKey);
    expect(JSON.stringify(record)).not.toContain(input.contact.email);
    const items = await db
      .prepare("SELECT * FROM order_items WHERE tenant_id = ? AND order_id = ?")
      .bind(tenantA, order!.id)
      .all();
    expect(items.results).toHaveLength(1);
    expect(items.results[0]).toMatchObject({
      qty: 2,
      unit_price_cents: 800,
      line_total_cents: 1600,
      name_snapshot: "Margherita",
    });
    await expect(
      db
        .prepare(
          "UPDATE order_items SET unit_price_cents = 1 WHERE tenant_id = ? AND order_id = ?",
        )
        .bind(tenantA, order!.id)
        .run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare(
          "UPDATE orders SET notes = 'changed' WHERE tenant_id = ? AND id = ?",
        )
        .bind(tenantA, order!.id)
        .run(),
    ).rejects.toThrow();
    const retry = await post("orders", input);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(result);
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ? AND order_number = ?",
        )
        .bind(tenantN, result.orderNumber)
        .first("n"),
    ).toBe(0);
    expect(
      (await server.fetch(`${nodo}/api/public/orders/${result.trackingToken}`))
        .status,
    ).toBe(404);
  });
  it("records cash delivery as unpaid and keeps the address snapshot", async () => {
    const input = await command(nodo, {
      fulfillment: "DELIVERY",
      paymentMethod: "CASH",
      mockPaymentResult: null,
      notes: "Prima riga\nSeconda riga",
      address: {
        street: "Via Demo 12",
        city: "Città Inventata",
        postalCode: "00000",
      },
    });
    const response = await post("orders", input, nodo);
    expect(response.status).toBe(201);
    const result = (await response.json()) as OrderResponse;
    expect(result).toMatchObject({
      paymentStatus: "UNPAID",
      deliveryFeeCents: 450,
      totalCents: 2350,
    });
    const row = await db
      .prepare(
        "SELECT address_snapshot_json FROM orders WHERE tenant_id = ? AND order_number = ?",
      )
      .bind(tenantN, result.orderNumber)
      .first<string>("address_snapshot_json");
    expect(JSON.parse(row!)).toEqual(input.address);
  });
  it("does not persist any part of a failed simulated payment", async () => {
    const input = await command(aurora, { mockPaymentResult: "FAILURE" });
    const before = await counts();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await post("orders", input);
      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({
        error: { code: "PAYMENT_SIMULATED_FAILED" },
      });
    }
    expect(await counts()).toEqual(before);
  });
  it("rolls back the entire batch when an item insertion fails", async () => {
    const input = await command();
    const before = await counts();
    await db
      .prepare(
        "CREATE TRIGGER fail_item_for_test BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
      )
      .run();
    try {
      const response = await post("orders", input);
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(body).not.toMatch(/injected|SQL|INSERT|order_items/);
      expect(await counts()).toEqual(before);
    } finally {
      await db.prepare("DROP TRIGGER fail_item_for_test").run();
    }
    expect((await post("orders", input)).status).toBe(201);
  });
  it("serializes concurrent identical requests with a unique constraint", async () => {
    const input = await command();
    const before = (await counts()) as number[];
    // Concurrency is the behavior under test, not parallel agent/task execution.
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => post("orders", input)),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([
      200, 200, 200, 200, 201,
    ]);
    const bodies: OrderResponse[] = [];
    for (const response of responses)
      bodies.push((await response.json()) as OrderResponse);
    expect(new Set(bodies.map((b) => b.orderNumber)).size).toBe(1);
    expect(new Set(bodies.map((b) => b.trackingToken)).size).toBe(1);
    expect(await counts()).toEqual(before.map((n) => n + 1));
  });
  it("rejects a different payload on the same key, including concurrent races", async () => {
    const input = await command();
    const other = { ...input, notes: "Altra richiesta" };
    const responses = await Promise.all([
      post("orders", input),
      post("orders", other),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    for (const response of responses) await response.body?.cancel();
    const saved = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM idempotency_records WHERE tenant_id = ? AND key_hash = ?",
      )
      .bind(tenantA, await digest(input.idempotencyKey))
      .first("n");
    expect(saved).toBe(1);
  });
  it("replays the stored economics even after catalog changes and response interruption", async () => {
    const input = await command();
    const first = await post("orders", input);
    expect(first.status).toBe(201);
    await first.body?.cancel();
    const productId = input.cart.items[0].productId;
    await db
      .prepare(
        "UPDATE products SET base_price_cents = 9999, available = 0 WHERE tenant_id = ? AND id = ?",
      )
      .bind(tenantA, productId)
      .run();
    try {
      const retry = await post("orders", input);
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({ totalCents: 1600 });
    } finally {
      await db
        .prepare(
          "UPDATE products SET base_price_cents = 800, available = 1 WHERE tenant_id = ? AND id = ?",
        )
        .bind(tenantA, productId)
        .run();
    }
  });
  it("rejects a stale quote instead of charging new prices silently", async () => {
    const input = await command();
    const before = await counts();
    const id = input.cart.items[0].productId;
    await db
      .prepare(
        "UPDATE products SET base_price_cents = 850 WHERE tenant_id = ? AND id = ?",
      )
      .bind(tenantA, id)
      .run();
    try {
      const response = await post("orders", input);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: { code: "QUOTE_CHANGED" },
      });
      expect(await counts()).toEqual(before);
    } finally {
      await db
        .prepare(
          "UPDATE products SET base_price_cents = 800 WHERE tenant_id = ? AND id = ?",
        )
        .bind(tenantA, id)
        .run();
    }
  });
  it("scopes identical idempotency keys to the resolved tenant", async () => {
    const a = await command();
    const n = await command(nodo, { idempotencyKey: a.idempotencyKey });
    const first = await post("orders", a);
    const second = await post("orders", n, nodo);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const r1 = (await first.json()) as OrderResponse;
    const r2 = (await second.json()) as OrderResponse;
    expect(r1.trackingToken).not.toBe(r2.trackingToken);
    expect(r1.orderNumber).not.toBe(r2.orderNumber);
    expect((await post("orders", a, nodo)).status).toBe(409);
  });
  it("rejects invalid contacts/address/payment and missing signing material without partial writes", async () => {
    const input = await command();
    const before = await counts();
    for (const invalid of [
      { ...input, contact: { ...input.contact, email: "bad" } },
      { ...input, fulfillment: "DELIVERY", address: null },
      { ...input, paymentMethod: "REAL_CARD" },
      { ...input, notes: "a".repeat(501) },
      { ...input, idempotencyKey: "predictable" },
    ])
      expect((await post("orders", invalid)).status).toBe(422);
    await server.update({
      workers: [{ ...config, vars: { ORDER_TOKEN_KEY: "" } }],
    });
    db = (await server.getWorker<Env>().getEnv()).DB;
    try {
      expect((await post("orders", input)).status).toBe(503);
      expect(await counts()).toEqual(before);
    } finally {
      await server.update({ workers: [config] });
      db = (await server.getWorker<Env>().getEnv()).DB;
    }
  });
  it("enforces cross-tenant foreign keys on order children", async () => {
    const input = await command();
    const response = await post("orders", input);
    const result = (await response.json()) as OrderResponse;
    const id = await db
      .prepare("SELECT id FROM orders WHERE tenant_id = ? AND order_number = ?")
      .bind(tenantA, result.orderNumber)
      .first<string>("id");
    await expect(
      db
        .prepare(
          "INSERT INTO order_access (tenant_id,order_id,tracking_hash,token_nonce,key_version,created_at) VALUES (?,?,?,?,1,?)",
        )
        .bind(
          tenantN,
          id,
          "a".repeat(64),
          "b".repeat(64),
          new Date().toISOString(),
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    expect(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
    ).toEqual([]);
  });
});
