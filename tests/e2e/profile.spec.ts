import { expect, test } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

async function signUp(page: import("@playwright/test").Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Passw0rd123");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("header-user")).toHaveText(name);
}

test.describe("profile", () => {
  test("shows a new player's empty but complete profile", async ({ page }) => {
    const email = uniqueEmail("e2e-profile");
    await signUp(page, "Profile Player", email);

    await page.getByTestId("header-profile-link").click();
    await expect(page).toHaveURL(/\/profile$/);

    await expect(page.getByTestId("profile-name")).toHaveText("Profile Player");
    await expect(page.getByTestId("league-name")).toContainText("Bronze");
    await expect(page.getByTestId("rank-points")).toHaveText("0");
    await expect(page.getByTestId("league-progress")).toContainText("points to silver");
    await expect(page.getByTestId("no-matches")).toBeVisible();
    await expect(page.getByTestId("league-badge-bronze")).toBeVisible();
  });

  test("publishes a read-only public profile at /u/[username]", async ({ page }) => {
    const email = uniqueEmail("e2e-public");
    await signUp(page, "Public Player", email);

    await page.goto("/profile");
    const handle = (await page.getByTestId("profile-username").innerText()).replace("@", "").trim();
    expect(handle.length).toBeGreaterThan(1);

    // The owner sees management actions on their own public page.
    await page.goto(`/u/${handle}`);
    await expect(page.getByTestId("profile-name")).toHaveText("Public Player");
    await expect(page.getByRole("link", { name: "Customise avatar" })).toBeVisible();

    // Everyone else gets a read-only view.
    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("login-link")).toBeVisible();

    await page.goto(`/u/${handle}`);
    await expect(page.getByTestId("profile-name")).toHaveText("Public Player");
    await expect(page.getByText("Public profile")).toBeVisible();
    await expect(page.getByRole("link", { name: "Customise avatar" })).toHaveCount(0);
  });

  test("returns 404 for an unknown handle", async ({ page }) => {
    const response = await page.goto(`/u/nobody-${Date.now()}`);
    expect(response?.status()).toBe(404);
  });

  test("requires sign-in for the private dashboard", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });
});
