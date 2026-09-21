import { expect, test } from "@playwright/test";

test("home page responds and renders the app", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("body")).toBeVisible();
});
