import { expect, test, type Page } from "@playwright/test";

const prepareCheckout = async (
  page: Page,
  slug = "aurora",
  hostname = `${slug}.localhost`,
) => {
  await page.goto(`http://${hostname}:8787/menu/`);
  const product = page.locator(
    `[data-product="${slug === "aurora" ? "margherita" : "margherita-lab"}"]`,
  );
  await product.locator("summary").click();
  await product
    .getByLabel(slug === "aurora" ? "Classico" : "Impasto Lab")
    .check();
  await product.getByRole("button", { name: /Aggiungi/ }).click();
  await expect(page.locator(".cart-count")).toHaveText("1");
  await product.getByRole("button", { name: /Aggiungi/ }).click();
  await expect(page.locator(".cart-count")).toHaveText("2");
  await page
    .getByRole("link", { name: /Carrello/ })
    .first()
    .click();
  await page.getByRole("link", { name: "Vai al checkout" }).click();
  await expect(page.getByTestId("quote-total")).toContainText(
    slug === "aurora" ? "16,00" : "19,00",
  );
  await page.getByLabel("Nome", { exact: true }).fill("Ospite Demo");
  await page.getByLabel("Email", { exact: true }).fill("ospite@example.test");
  await page.getByLabel("Telefono", { exact: true }).fill("+39 000 000 0000");
};

for (const slug of ["aurora", "nodo"]) {
  for (const width of [1440, 390]) {
    test(`${slug} guest checkout at ${width}px`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await prepareCheckout(page, slug);
      if (slug === "nodo") {
        await page.getByLabel(/Consegna ·/).check();
        await expect(page.getByTestId("quote-total")).toContainText("23,50");
        await page
          .getByLabel("Via e numero", { exact: true })
          .fill("Via Demo 12");
        await page.getByLabel("Città", { exact: true }).fill("Città Inventata");
        await page.getByLabel("CAP", { exact: true }).fill("00000");
        await page.getByLabel(/Contanti alla consegna/).check();
        await expect(
          page.getByText("Nessun anticipo.", { exact: false }),
        ).toBeVisible();
      }
      expect(
        await page.locator('input[autocomplete="cc-number"]').count(),
      ).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("checkout.png"),
        fullPage: true,
      });
      const responseReady = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/public/orders") &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Conferma ordine demo", exact: true })
        .click();
      const response = await responseReady;
      expect(response.status()).toBe(201);
      const result = await response.json();
      await expect(
        page.getByRole("heading", { name: `Conferma ${result.orderNumber}` }),
      ).toBeVisible();
      await expect(page.locator(".order-confirmation")).toContainText(
        slug === "aurora" ? "Riuscito in simulazione" : "Contanti da pagare",
      );
      await expect(page.locator(".cart-count")).toHaveText("0");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const saved = await page.evaluate(() =>
        JSON.stringify({
          local: { ...localStorage },
          session: { ...sessionStorage },
        }),
      );
      expect(saved.includes(result.trackingToken)).toBe(false);
      expect(saved).not.toContain("ospite@example.test");
      await expect(
        page.getByRole("link", { name: "Segui il tuo ordine" }),
      ).toHaveAttribute("href", `/orders/${result.trackingToken}/`);
      await page.screenshot({
        path: testInfo.outputPath("confirmation.png"),
        fullPage: true,
      });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: `Conferma ${result.orderNumber}` }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test("failed mock payment preserves the cart and permits an unpaid cash order", async ({
  page,
}) => {
  await prepareCheckout(page);
  await page.getByLabel("Esito della simulazione").selectOption("FAILURE");
  await page
    .getByRole("button", { name: "Conferma ordine demo", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Pagamento simulato non riuscito",
  );
  await expect(page.locator(".order-confirmation")).toHaveCount(0);
  await expect(page.locator(".cart-count")).toHaveText("2");
  await page.getByLabel(/Contanti al ritiro/).check();
  await page
    .getByRole("button", { name: "Conferma ordine demo", exact: true })
    .click();
  await expect(page.locator(".order-confirmation")).toContainText(
    "Contanti da pagare",
  );
});

test("interrupted response survives refresh and replays the same committed order", async ({
  page,
}) => {
  // route.fetch uses Node DNS, which does not implement Chromium's *.localhost mapping.
  await prepareCheckout(page, "aurora", "127.0.0.1");
  let committedNumber = "";
  await page.route("**/api/public/orders", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    committedNumber = (await response.json()).orderNumber;
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Conferma ordine demo", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Esito non ricevuto");
  await page.unroute("**/api/public/orders");
  await page.reload();
  const retry = page.getByRole("button", {
    name: "Riprova la stessa conferma",
  });
  await expect(retry).toBeEnabled();
  const replayReady = page.waitForResponse((r) =>
    r.url().endsWith("/api/public/orders"),
  );
  await retry.click();
  expect((await replayReady).status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: `Conferma ${committedNumber}` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Segui il tuo ordine" }).click();
  await expect(
    page.getByRole("heading", { name: committedNumber, exact: true }),
  ).toBeVisible();
});

test("empty cart and invalid guest fields do not submit an order", async ({
  page,
}) => {
  await page.goto("http://aurora.localhost:8787/checkout/");
  await expect(
    page.getByRole("heading", { name: "Il tuo carrello è vuoto." }),
  ).toBeVisible();
  await prepareCheckout(page);
  await page.getByLabel("Email", { exact: true }).fill("invalid");
  await page
    .getByRole("button", { name: "Conferma ordine demo", exact: true })
    .click();
  expect(
    await page
      .getByLabel("Email", { exact: true })
      .evaluate((el: HTMLInputElement) => el.validity.typeMismatch),
  ).toBe(true);
  await expect(page.locator(".order-confirmation")).toHaveCount(0);
});
