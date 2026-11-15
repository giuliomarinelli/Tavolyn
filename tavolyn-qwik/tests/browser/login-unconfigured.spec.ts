import { test, expect } from "@playwright/test";
for (const slug of ["aurora", "nodo"]) {
  for (const width of [1440, 390]) {
    test(`${slug} unconfigured staff login at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://${slug}.localhost:8787/login/`);
      await expect(
        page.getByRole("heading", { name: "Accesso riservato allo staff" }),
      ).toBeVisible();
      await expect(
        page.getByText("Il login staff è temporaneamente indisponibile", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Accedi con il provider" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("login-unconfigured.png"),
        fullPage: true,
      });
      expect(
        await page.evaluate(async () => (await fetch("/api/staff/me")).status),
      ).toBe(401);
    });
  }
}
