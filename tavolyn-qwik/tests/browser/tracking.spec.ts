import { expect, test, type Page } from "@playwright/test";
import type { RestaurantMenu } from "../../src/lib/shared/catalog";
import type { Quote } from "../../src/lib/shared/checkout";

const createDemo = async (page: Page, slug: string) => {
  await page.goto(`http://${slug}.localhost:8787/`);
  return await page.evaluate(async () => {
    const menu = (await (
      await fetch("/api/public/menu")
    ).json()) as RestaurantMenu;
    const product = menu.categories
      .flatMap(
        (category: {
          products: {
            id: string;
            available: boolean;
            modifierGroups: {
              minSelect: number;
              modifiers: { id: string; available: boolean }[];
            }[];
          }[];
        }) => category.products,
      )
      .find((item: { available: boolean }) => item.available);
    if (!product) throw new Error("Demo menu has no available product");
    const items = [
      {
        productId: product.id,
        quantity: 2,
        modifierIds: product.modifierGroups.flatMap(
          (group: {
            minSelect: number;
            modifiers: { id: string; available: boolean }[];
          }) =>
            group.modifiers
              .filter((mod) => mod.available)
              .slice(0, group.minSelect)
              .map((mod) => mod.id),
        ),
      },
    ];
    const post = (path: string, body: unknown) =>
      fetch(`/api/public/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const quote = (await (
      await post("quote", { items, fulfillment: "PICKUP" })
    ).json()) as Quote;
    const result = await post("orders", {
      idempotencyKey: crypto.randomUUID(),
      cart: { items },
      fulfillment: "PICKUP",
      quoteFingerprint: quote.quoteFingerprint,
      contact: {
        name: "Cliente Demo Privato",
        email: "privato@example.test",
        phone: "+39 000 000 0000",
      },
      paymentMethod: "CASH",
      notes: "Nota privata demo",
    });
    if (result.status !== 201) throw new Error("Demo order was not created");
    return (await result.json()) as {
      orderNumber: string;
      trackingToken: string;
      totalCents: number;
    };
  });
};

for (const slug of ["aurora", "nodo"]) {
  for (const width of [1440, 390]) {
    test(`${slug} tracking at ${width}px`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      const order = await createDemo(page, slug);
      const response = await page.goto(
        `http://${slug}.localhost:8787/orders/${order.trackingToken}/`,
      );
      expect(response?.status()).toBe(200);
      expect(response?.headers()["cache-control"]).toBe("no-store");
      expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
      await expect(
        page.getByRole("heading", { name: order.orderNumber }),
      ).toBeVisible();
      await expect(page.getByTestId("order-status")).toHaveText(
        "Ordine ricevuto",
      );
      await expect(page.locator(".tracking-timeline li")).toHaveCount(1);
      await expect(page.locator(".tracking-timeline li")).toContainText(
        "Ordine ricevuto",
      );
      await expect(page.locator(".cart-summary")).toContainText(
        "Contanti da pagare",
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      expect(await page.title()).not.toContain(order.trackingToken);
      expect(await page.locator("body").innerText()).not.toMatch(
        /privato@example.test|Cliente Demo Privato|Nota privata demo/,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("tracking.png"),
        fullPage: true,
      });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: order.orderNumber }),
      ).toBeVisible();
      await expect(page.locator(".tracking-timeline li")).toHaveCount(1);
      const stored = await page.evaluate(() =>
        JSON.stringify({
          local: { ...localStorage },
          session: { ...sessionStorage },
        }),
      );
      expect(stored.includes(order.trackingToken)).toBe(false);
      const requestReady = page.waitForRequest(
        (request) =>
          request.isNavigationRequest() && request.url().endsWith("/menu/"),
      );
      await page.getByRole("link", { name: "Il menu", exact: true }).click();
      expect((await requestReady).headers()["referer"]).toBeUndefined();
      expect(errors).toEqual([]);
    });
  }
}

test("tracking rejects a foreign tenant and unknown tokens", async ({
  page,
}) => {
  const order = await createDemo(page, "aurora");
  const foreign = await page.goto(
    `http://nodo.localhost:8787/orders/${order.trackingToken}/`,
  );
  expect(foreign?.status()).toBe(404);
  expect(await page.locator("body").innerText()).not.toContain(
    order.orderNumber,
  );
  const missing = await page.goto(
    "http://aurora.localhost:8787/orders/invalid-token/",
  );
  expect(missing?.status()).toBe(404);
  expect(missing?.headers()["x-robots-tag"]).toContain("noindex");
});

test("polling pauses while hidden and resumes immediately when visible", async ({
  page,
}) => {
  const order = await createDemo(page, "aurora");
  await page.clock.install();
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/public/orders/")) requests++;
  });
  await page.goto(
    `http://aurora.localhost:8787/orders/${order.trackingToken}/`,
  );
  // Wait for Qwik's client task through an observable response before advancing virtual time.
  await page.getByRole("button", { name: "Aggiorna stato" }).click();
  await expect(page.locator(".tracking-connection")).toContainText(
    "Stato verificato",
  );
  const initialized = requests;
  await page.clock.runFor(8100);
  await expect.poll(() => requests).toBe(initialized + 1);
  await expect(page.locator(".tracking-connection")).not.toContainText(
    "in corso",
  );
  // Controlled visibility simulation; no browser-specific focus assumptions.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = requests;
  await page.clock.runFor(30000);
  expect(requests).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => requests).toBe(before + 1);
  await expect(page.getByTestId("order-status")).toHaveText("Ordine ricevuto");
});

test("temporary tracking errors retain the summary and allow an explicit retry", async ({
  page,
}) => {
  const order = await createDemo(page, "nodo");
  await page.goto(`http://nodo.localhost:8787/orders/${order.trackingToken}/`);
  await page.route("**/api/public/orders/*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":{"code":"TRACKING_UNAVAILABLE"}}',
    }),
  );
  await page.getByRole("button", { name: "Aggiorna stato" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "riepilogo precedente resta visibile",
  );
  await expect(
    page.getByRole("heading", { name: order.orderNumber }),
  ).toBeVisible();
  await page.unroute("**/api/public/orders/*");
  await page.getByRole("button", { name: "Aggiorna stato" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("order-status")).toHaveText("Ordine ricevuto");
});
