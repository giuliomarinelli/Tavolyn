import { test, expect, type Page } from "@playwright/test";
const origin = (slug: string) => `http://${slug}.localhost:8788`;
const me = (page: Page) =>
  page.evaluate(async () => {
    const r = await fetch("/api/staff/me");
    return { status: r.status, body: await r.text() };
  });
const signin = async (page: Page, slug: string, subject: string) => {
  await page.goto(`${origin(slug)}/login/`);
  await page.getByRole("link", { name: "Accedi con il provider" }).click();
  await expect(
    page.getByRole("heading", { name: "Provider OIDC locale di test" }),
  ).toBeVisible();
  await page.getByLabel("Identità fixture").selectOption(subject);
  await page.getByRole("button", { name: "Autorizza fixture" }).click();
  await expect(page).toHaveURL(new RegExp(`${slug}\\.localhost:8788/login/`));
};
for (const slug of ["aurora", "nodo"]) {
  for (const width of [1440, 390]) {
    test(`${slug} OIDC login and logout at ${width}px`, async ({
      page,
      context,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const subject =
        slug === "aurora" ? "fixture-aurora-owner" : "fixture-nodo-operator";
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await signin(page, slug, subject);
      await expect(
        page.getByRole("heading", { name: "Sessione attiva" }),
      ).toBeVisible();
      await expect(
        page.getByText(`Ruolo: ${slug === "aurora" ? "OWNER" : "OPERATOR"}`),
      ).toBeVisible();
      const api = await me(page);
      expect(api.status).toBe(200);
      expect(api.body).not.toMatch(
        /access_token|refresh_token|session_hash|cognito_sub|fixture-/,
      );
      const cookies = await context.cookies(origin(slug));
      const session = cookies.find((c) => c.name === "tavolyn-local-session")!;
      expect(session).toMatchObject({
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        path: "/",
        domain: `${slug}.localhost`,
      });
      expect(cookies.some((c) => c.name.includes("login"))).toBe(false);
      const html = await page.content();
      expect(html).not.toContain(session.value);
      expect(html).not.toContain(subject);
      expect(
        await page.evaluate(() => ({
          local: { ...localStorage },
          session: { ...sessionStorage },
          cookies: document.cookie,
        })),
      ).toEqual({ local: {}, session: {}, cookies: "" });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Sessione attiva" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("login-authenticated.png"),
        fullPage: true,
      });
      await page.goto(
        `${origin(slug === "aurora" ? "nodo" : "aurora")}/login/`,
      );
      await expect(
        page.getByRole("link", { name: "Accedi con il provider" }),
      ).toBeVisible();
      expect((await me(page)).status).toBe(401);
      await page.goto(`${origin(slug)}/login/`);
      await page.getByRole("button", { name: "Esci", exact: true }).click();
      await expect(page.getByText("Disconnessione completata.")).toBeVisible();
      expect((await me(page)).status).toBe(401);
      expect(
        (await context.cookies(origin(slug))).some(
          (c) => c.name === "tavolyn-local-session",
        ),
      ).toBe(false);
      await page.screenshot({
        path: info.outputPath("login-signed-out.png"),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }
}
test("authenticated fixture without membership sees a safe denial", async ({
  page,
}) => {
  await signin(page, "aurora", "fixture-unassigned");
  await expect(page.getByRole("status")).toContainText("Accesso negato");
  expect((await me(page)).status).toBe(401);
});
test("expired session and failed login have safe recovery states", async ({
  page,
  context,
}, info) => {
  await context.addCookies([
    {
      name: "tavolyn-local-session",
      value: "A".repeat(43),
      url: origin("aurora"),
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`${origin("aurora")}/login/`);
  await expect(page.getByRole("status")).toContainText(
    "Sessione scaduta o revocata",
  );
  await expect(
    page.getByRole("link", { name: "Accedi con il provider" }),
  ).toBeVisible();
  await page.goto(`${origin("aurora")}/login/?result=failed`);
  await expect(page.getByRole("status")).toContainText("Accesso non riuscito");
  await page.screenshot({
    path: info.outputPath("login-error.png"),
    fullPage: true,
  });
});
test("cross-site logout is denied while the session remains usable", async ({
  page,
}) => {
  await signin(page, "aurora", "fixture-aurora-owner");
  await page.goto(`${origin("nodo")}/login/`);
  const result = page.waitForResponse(
    (r) =>
      r.url() === `${origin("aurora")}/api/auth/logout` &&
      r.request().method() === "POST",
  );
  await page.evaluate(
    (target) => {
      const form = document.createElement("form");
      form.action = target;
      form.method = "post";
      document.body.appendChild(form);
      form.submit();
    },
    `${origin("aurora")}/api/auth/logout`,
  );
  expect((await result).status()).toBe(403);
  await page.waitForURL(`${origin("aurora")}/api/auth/logout`);
  await page.goto(`${origin("aurora")}/login/`);
  expect((await me(page)).status).toBe(200);
});
