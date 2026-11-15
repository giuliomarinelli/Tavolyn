import { expect, test } from "@playwright/test";

for (const slug of ["aurora", "nodo"]) {
  for (const width of [1440, 390, 320]) {
    test(`${slug} menu and cart at ${width}px`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://${slug}.localhost:8787/`);
      await page.getByRole("link", { name: "Scopri il nostro menu" }).click();
      await expect(page).toHaveURL(/\/menu\//);
      await expect(page.locator(".cart-count")).toHaveText("0");
      await expect(page.locator(".product-card")).toHaveCount(
        slug === "aurora" ? 15 : 12,
      );
      await expect(page.locator(".sold-out").first()).toContainText(
        "Esaurito per oggi",
      );
      await expect(page.locator(".sold-out button")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("menu.png"),
        fullPage: true,
      });

      // Native details/checkboxes are keyboard operable, with enforced bounds.
      const product = page.locator(
        `[data-product="${slug === "aurora" ? "margherita" : "margherita-lab"}"]`,
      );
      await product.locator("summary").focus();
      await page.keyboard.press("Enter");
      const add = product.getByRole("button", { name: /Aggiungi/ });
      await expect(add).toBeDisabled();
      await product
        .getByLabel(slug === "aurora" ? "Integrale" : "Multicereali")
        .check();
      await expect(
        product.getByLabel(slug === "aurora" ? "Classico" : "Impasto Lab"),
      ).toBeDisabled();
      const extras =
        slug === "aurora"
          ? ["Burrata", "Olive", "Funghi"]
          : ["Stracciatella", "Cipolla croccante", "Olio piccante"];
      await product.getByLabel(extras[0], { exact: false }).check();
      await product.getByLabel(extras[1], { exact: false }).check();
      await expect(
        product.getByLabel(extras[2], { exact: false }),
      ).toBeDisabled();
      await expect(
        product.getByLabel(slug === "aurora" ? /Carciofi/ : /Tartufo/),
      ).toBeDisabled();
      await add.click();
      await expect(page.locator(".cart-count")).toHaveText("1");
      await expect(product.getByRole("status")).toContainText(
        "aggiunto al carrello",
      );
      await add.click();
      await expect(page.locator(".cart-count")).toHaveText("2");
      await page.screenshot({
        path: testInfo.outputPath("configuration.png"),
        fullPage: true,
      });
      await page
        .getByRole("link", { name: /Carrello/ })
        .first()
        .click();
      await expect(page.locator(".cart-item")).toHaveCount(1);
      const quantity = page.getByRole("spinbutton");
      await expect(quantity).toHaveValue("2");
      await expect(page.getByTestId("cart-total")).toContainText(
        slug === "aurora" ? "26,00" : "32,00",
      );
      await page.getByRole("button", { name: /Aumenta/ }).click();
      await expect(quantity).toHaveValue("3");
      await page.getByRole("button", { name: /Riduci/ }).click();
      await expect(quantity).toHaveValue("2");
      await quantity.fill("4");
      await quantity.press("Tab");
      await expect(page.getByTestId("cart-total")).toContainText(
        slug === "aurora" ? "52,00" : "64,00",
      );
      await page.reload();
      await expect(quantity).toHaveValue("4");
      await expect(page.locator(".cart-item")).toContainText(extras[0]);
      await expect(page.locator(".checkout-note")).toContainText(
        "checkout sarà integrato",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("cart.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: /Rimuovi/ }).click();
      await expect(
        page.getByText("Il tuo carrello è vuoto.", { exact: false }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("link", { name: "Esplora il menu" }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("cart-empty.png"),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }
}

test("tenant carts stay distinct through hostname changes and forged stored IDs", async ({
  page,
}) => {
  await page.goto("http://aurora.localhost:8787/menu/");
  const aurora = page.locator('[data-product="margherita"]');
  await aurora.locator("summary").click();
  await aurora.getByLabel("Classico").check();
  await aurora.getByRole("button", { name: /Aggiungi/ }).click();
  await expect(page.locator(".cart-count")).toHaveText("1");
  const saved = await page.evaluate(() =>
    localStorage.getItem("tavolyn:cart:v1:aurora"),
  );
  await page
    .getByRole("navigation", { name: "Anteprima locale" })
    .getByRole("link", { name: "Nodo" })
    .click();
  await expect(page.locator(".cart-count")).toHaveText("0");
  // Even a forged copy under Nodo's key cannot resolve Aurora product IDs.
  await page.evaluate(
    (raw) => localStorage.setItem("tavolyn:cart:v1:nodo", raw!),
    saved,
  );
  await page.reload();
  await expect(page.locator(".cart-count")).toHaveText("0");
  await expect(page.locator(".cart-notice")).toContainText("aggiornato");
  const nodo = page.locator('[data-product="margherita-lab"]');
  await nodo.locator("summary").click();
  await nodo.getByLabel("Impasto Lab").check();
  await nodo.getByRole("button", { name: /Aggiungi/ }).click();
  await expect(page.locator(".cart-count")).toHaveText("1");
  await page.goto("http://aurora.localhost:8787/cart/");
  await expect(page.locator(".cart-item")).toHaveCount(1);
  await expect(page.locator(".cart-item h2")).toHaveText("Margherita");
  await expect(page.getByTestId("cart-total")).toContainText("8,00");
  await page.goto("http://nodo.localhost:8787/cart/");
  await expect(page.locator(".cart-item h2")).toHaveText("Margherita Lab");
  await expect(page.getByTestId("cart-total")).toContainText("9,50");
});

test("corrupt or inaccessible local storage leaves the shop usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://aurora.localhost:8787/cart/");
  await expect(page.getByRole("link", { name: "Esplora il menu" })).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("tavolyn:cart:v1:aurora", "invalid json"),
  );
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Esplora il menu" }),
  ).toBeVisible();
  await expect(page.locator(".cart-notice")).toContainText("aggiornato");
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage disabled");
      },
    });
  });
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Esplora il menu" }),
  ).toBeVisible();
  await expect(page.locator(".cart-notice")).toContainText("browser");
  expect(errors).toEqual([]);
});

test("different configurations remain separate and quantity limits survive input", async ({
  page,
}) => {
  await page.goto("http://aurora.localhost:8787/menu/");
  const product = page.locator('[data-product="margherita"]');
  await product.locator("summary").click();
  await product.getByLabel("Classico").check();
  await product.getByRole("button", { name: /Aggiungi/ }).click();
  await product.getByLabel("Classico").uncheck();
  await expect(
    product.getByRole("button", { name: /Aggiungi/ }),
  ).toBeDisabled();
  await product.getByLabel("Integrale").check();
  await product.getByRole("button", { name: /Aggiungi/ }).click();
  await page
    .getByRole("link", { name: /Carrello/ })
    .first()
    .click();
  await expect(page.locator(".cart-item")).toHaveCount(2);
  const first = page.locator(".cart-item").first();
  const qty = first.getByRole("spinbutton");
  await expect(first.getByRole("button", { name: /Riduci/ })).toBeDisabled();
  await qty.fill("99");
  await qty.press("Tab");
  await expect(first.getByRole("button", { name: /Aumenta/ })).toBeDisabled();
  await qty.fill("100");
  await qty.press("Tab");
  await expect(qty).toHaveValue("99");
  await qty.fill("1.5");
  await qty.press("Tab");
  await expect(qty).toHaveValue("99");
  await page.reload();
  await expect(page.locator(".cart-item")).toHaveCount(2);
  await expect(page.getByRole("spinbutton").first()).toHaveValue("99");
});
