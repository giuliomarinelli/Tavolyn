import { expect, test } from "@playwright/test";

const restaurants = [
  {
    slug: "aurora",
    name: "Trattoria Aurora",
    other: "Nodo Pizza Lab",
    next: "Nodo",
  },
  {
    slug: "nodo",
    name: "Nodo Pizza Lab",
    other: "Trattoria Aurora",
    next: "Aurora",
  },
];

for (const restaurant of restaurants) {
  for (const width of [1440, 390, 320]) {
    test(`${restaurant.slug} homepage at ${width}px`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(
        `http://${restaurant.slug}.localhost:8787/`,
      );
      expect(response?.status()).toBe(200);
      const runtime = await page.evaluate(async () => {
        const site = await fetch("/api/public/site");
        const health = await fetch("/api/health");
        return {
          siteStatus: site.status,
          site: await site.json(),
          healthStatus: health.status,
          health: await health.json(),
        };
      });
      expect(runtime.siteStatus).toBe(200);
      expect(runtime.site).toMatchObject({
        name: restaurant.name,
        slug: restaurant.slug,
      });
      expect(runtime.healthStatus).toBe(200);
      expect(runtime.health).toEqual({ status: "ok", service: "tavolyn" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        restaurant.name,
      );
      await expect(page.locator(".restaurant")).toHaveAttribute(
        "data-brand",
        restaurant.slug,
      );
      await expect(page.locator(".brand-lockup img")).toHaveJSProperty(
        "complete",
        true,
      );
      expect(
        await page
          .locator(".brand-lockup img")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      ).toBeGreaterThan(0);
      await expect(page.locator(".brand-lockup img")).toHaveAttribute(
        "src",
        `/brands/${restaurant.slug}.svg`,
      );
      await expect(
        page.getByText(restaurant.other, { exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator(".hero h2")
          .evaluate((heading) => heading.scrollWidth <= heading.clientWidth),
      ).toBe(true);
      await expect(page.locator(".powered-by")).toContainText("Tavolyn");
      await page.screenshot({
        path: testInfo.outputPath("homepage.png"),
        fullPage: true,
      });
      await page.getByRole("link", { name: /Dove siamo/ }).click();
      await expect(
        page.getByRole("heading", { name: /Facciamo spazio/ }),
      ).toBeInViewport();
      await page
        .getByRole("navigation", { name: "Anteprima locale" })
        .getByRole("link", { name: restaurant.next })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        restaurant.other,
      );
      expect(errors).toEqual([]);
    });
  }
}
