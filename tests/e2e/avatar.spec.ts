import { expect, test } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

test.describe("avatar", () => {
  test("customises, saves and persists an avatar", async ({ page }) => {
    const email = uniqueEmail("e2e-avatar");

    await page.goto("/signup");
    await page.getByLabel("Name").fill("Avatar Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("header-user")).toHaveText("Avatar Tester");

    // The header shows an avatar for signed-in users.
    await expect(page.locator("header .avatar")).toHaveCount(1);

    await page.goto("/profile/avatar");
    await expect(page.getByTestId("avatar-preview")).toBeVisible();

    await page.getByTestId("avatar-skin-espresso").click();
    await page.getByTestId("avatar-hairstyle-curly").click();
    await page.getByTestId("avatar-glasses-round").click();

    await expect(page.getByTestId("avatar-skin-espresso")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("avatar-save").click();
    await expect(page.getByTestId("avatar-notice")).toContainText("Avatar saved");

    // Selections survive a reload (persisted on the account).
    await page.reload();
    await expect(page.getByTestId("avatar-skin-espresso")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("avatar-hairstyle-curly")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("avatar-glasses-round")).toHaveAttribute("aria-pressed", "true");
  });

  test("surprises with a valid random avatar", async ({ page }) => {
    const email = uniqueEmail("e2e-avatar-rand");

    await page.goto("/signup");
    await page.getByLabel("Name").fill("Random Avatar");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("header-user")).toHaveText("Random Avatar");

    await page.goto("/profile/avatar");
    await page.getByTestId("avatar-randomise").click();
    await page.getByTestId("avatar-save").click();
    await expect(page.getByTestId("avatar-notice")).toContainText("Avatar saved");
  });

  test("requires an account to customise an avatar", async ({ page }) => {
    await page.goto("/profile/avatar");
    await expect(page).toHaveURL(/\/login/);
  });
});
