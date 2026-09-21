import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("leads with the games", async ({ page }) => {
    await page.goto("/");

    // The playable games must be the first meaningful content, not buried.
    const cards = page.locator('[data-testid^="game-card-"]');
    await expect(cards).toHaveCount(3);

    const firstCardTop = await cards
      .first()
      .boundingBox()
      .then((box) => box?.y ?? 9999);
    expect(firstCardTop).toBeLessThan(700);
  });

  test("fits horizontally with no overflow at any width", async ({ page }) => {
    for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });

  test("shows the games hub with cards loaded from the database", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("game-card-wordle")).toBeVisible();
    await expect(page.getByTestId("game-card-spelling-bee")).toBeVisible();
    await expect(page.getByTestId("game-card-connections")).toBeVisible();
    await expect(page.locator('[data-testid^="game-card-"]')).toHaveCount(3);
  });

  test("navigates from a game card to its detail page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("game-card-wordle").click();
    await expect(page).toHaveURL(/\/games\/wordle$/);
    await expect(page.getByRole("heading", { name: "Wordle", level: 1 })).toBeVisible();
  });

  test("games index lists every published game", async ({ page }) => {
    await page.goto("/games");
    await expect(page.getByRole("heading", { name: "All games", level: 1 })).toBeVisible();
    await expect(page.locator('[data-testid^="game-card-"]')).toHaveCount(3);
  });

  test("header navigation reaches the games hub", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("nav-games").click();
    await expect(page).toHaveURL(/\/games$/);
  });

  test("hero call to action starts the first game", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("hero-play").click();
    await expect(page).toHaveURL(/\/games\/wordle$/);
  });

  test("footer exposes the contact email", async ({ page }) => {
    await page.goto("/");

    const contact = page.getByTestId("footer-contact");
    await expect(contact).toBeVisible();
    await expect(contact).toContainText("daradekaran123@gmail.com");
    await expect(contact).toHaveAttribute("href", "mailto:daradekaran123@gmail.com");
  });

  test("the decorative bubble field is hidden from assistive tech", async ({ page }) => {
    await page.goto("/");

    const field = page.locator(".bubble-field");
    await expect(field).toHaveCount(1);
    await expect(field).toHaveAttribute("aria-hidden", "true");
  });
});

test.describe("legal pages and SEO", () => {
  test("privacy and terms render", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of use" })).toBeVisible();
  });

  test("robots.txt and sitemap.xml are published", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Sitemap:");
    expect(robotsBody).toContain("/admin");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain("/games/wordle");
  });

  test("unknown games return a 404", async ({ request }) => {
    const response = await request.get("/games/does-not-exist");
    expect(response.status()).toBe(404);
  });
});

function consentCookieOf(cookies: { name: string; value: string }[]): string {
  const raw = cookies.find((item) => item.name === "ew_consent")?.value ?? "";
  return decodeURIComponent(raw);
}

test.describe("cookie consent", () => {
  test("records a choice, then stays dismissed after reload", async ({ page, context }) => {
    await page.goto("/");

    const accept = page.getByTestId("consent-all");
    await expect(accept).toBeVisible();
    await accept.click();
    await expect(accept).toHaveCount(0);

    await expect.poll(async () => consentCookieOf(await context.cookies())).toContain("1:all");

    await page.reload();
    await expect(page.getByTestId("consent-all")).toHaveCount(0);
  });

  test("essential-only choice is also remembered", async ({ page, context }) => {
    await page.goto("/");
    await page.getByTestId("consent-essential").click();
    await expect(page.getByTestId("consent-essential")).toHaveCount(0);

    await expect
      .poll(async () => consentCookieOf(await context.cookies()))
      .toContain("1:essential");
  });
});
