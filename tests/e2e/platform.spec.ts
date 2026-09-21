import { expect, test } from "@playwright/test";

test.describe("platform", () => {
  test("health endpoint reports database status", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as { ok: boolean; database: string };
    expect(body.ok).toBe(true);
    expect(body.database).toBe("up");
  });

  test("responses include hardening headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("unknown routes render the custom 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("the skip link targets the main landmark", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await expect(page.locator("#main-content")).toHaveCount(1);
  });

  test("sitemap lists every published game", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const body = await response.text();

    expect(body).toContain("/games/wordle");
    expect(body).toContain("/games/spelling-bee");
    expect(body).toContain("/games/connections");
  });

  test("the landing page advertises structured data", async ({ page }) => {
    await page.goto("/");
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toContain("WebSite");
    expect(jsonLd).toContain("ItemList");
  });

  test("game boards expose accessible controls", async ({ page }) => {
    await page.goto("/");
    await page.goto("/games/wordle");

    await expect(page.getByTestId("wordle-grid")).toHaveAttribute("aria-label", "Wordle board");
    await expect(page.getByLabel("On-screen keyboard")).toBeVisible();
    await expect(page.getByTestId("wordle-key-enter")).toBeVisible();
  });
});
