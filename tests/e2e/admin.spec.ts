import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@extremewordle.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@12345";
const DEMO_EMAIL = "user@demo.local";
const DEMO_PASSWORD = "Demo@12345";

async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** A date offset in days, expressed in IST (YYYY-MM-DD). */
function istDate(offsetDays: number): string {
  const shifted = new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

test.describe("admin access control", () => {
  test("anonymous visitors are sent to the admin login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a signed-in non-admin is refused the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/$/);

    await page
      .getByTestId("admin-link")
      .waitFor({ state: "detached" })
      .catch(() => {});

    await page.goto("/admin");
    await expect(page).toHaveURL(/error=forbidden/);

    await page.goto("/");
    await expect(page.getByTestId("admin-link")).toHaveCount(0);
  });
});

test.describe("@heavy admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("renders the overview with live stats", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Guest sessions")).toBeVisible();
    await expect(page.getByText("Solve rate (7d)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent signups" })).toBeVisible();
  });

  test("lists users and opens a user detail page", async ({ page }) => {
    await page.goto("/admin/users");

    // Search so the assertion does not depend on list ordering or page size.
    await page.getByLabel("Search").fill(DEMO_EMAIL);
    await page.getByRole("button", { name: "Filter" }).click();

    await expect(page.getByText(DEMO_EMAIL)).toBeVisible();

    await page.getByRole("link", { name: "Demo User" }).first().click();
    await expect(page).toHaveURL(/\/admin\/users\//);
    await expect(page.getByTestId("user-detail-name")).toHaveText("Demo User");
    await expect(page.getByText("Account actions")).toBeVisible();
    await expect(page.getByText("Game history")).toBeVisible();
  });

  test("assigns a manual word to a future slot", async ({ page }) => {
    const date = istDate(3);

    await page.goto("/admin/schedule");
    await page.getByTestId("schedule-word").fill("crane");
    await page.locator('input[name="date"]').fill(date);
    await page.getByTestId("schedule-submit").click();

    await expect(page.getByTestId("schedule-form-notice")).toContainText("crane");

    const row = page.getByTestId(`schedule-row-${date}`);
    await expect(row).toContainText("crane");
    await expect(row).toContainText("MANUAL");
  });

  test("rejects a word that is not in the game list", async ({ page }) => {
    await page.goto("/admin/schedule");
    await page.getByTestId("schedule-word").fill("zzzzz");
    await page.locator('input[name="date"]').fill(istDate(5));
    await page.getByTestId("schedule-submit").click();

    await expect(page.getByTestId("schedule-form-notice")).toContainText("not in this game");
  });

  test("imports words and finds them in the list", async ({ page }) => {
    const unique = `qz${Date.now().toString(36).replace(/[0-9]/g, "x")}`;

    await page.goto("/admin/words");

    // The dashboard streams a loading fallback, so wait for the page to settle
    // (the streamed placeholder briefly duplicates content).
    await expect(page.getByTestId("import-csv")).toHaveCount(1);

    await page.getByTestId("import-csv").fill(`alpha\n${unique}\nbeta`);
    await page.getByTestId("import-submit").click();
    await expect(page.getByTestId("import-notice")).toContainText("Imported");

    await page.goto(`/admin/words?game=wordle&q=${unique}`);
    await expect(page.getByText(unique, { exact: true })).toHaveCount(1);
  });

  test("shows the audit log with recorded admin actions", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("admin.login").first()).toBeVisible();
  });

  test("toggles a game's visibility and restores it", async ({ page }) => {
    await page.goto("/admin/games");

    // The dashboard streams a loading fallback, so wait for the page to settle
    // before interacting (the streamed placeholder briefly duplicates content).
    await expect(page.getByTestId("game-connections")).toHaveCount(1);

    const card = page.getByTestId("game-connections");
    const toggle = card.getByTestId("toggle-game-connections");
    const before = await toggle.getAttribute("aria-pressed");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", before ?? "true");
  });
});
