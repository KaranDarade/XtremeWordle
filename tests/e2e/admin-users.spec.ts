import { expect, test } from "@playwright/test";

import { adminLogin, openPage, signIn, signOut, signUp, uniqueEmail } from "./helpers";

test.describe("@heavy admin users", () => {
  test("searches, filters and opens a user", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/users");

    // Search narrows the list to a known seeded account.
    await page.getByLabel("Search").fill("user@demo.local");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("user@demo.local")).toBeVisible();

    // The role filter works too.
    await page.goto("/admin/users?role=ADMIN");
    await expect(page.getByText("ADMIN").first()).toBeVisible();
  });

  test("resets a user's password and the new password works", async ({ page }) => {
    const email = uniqueEmail("e2e-admin-reset");
    await signUp(page, "Reset Target", email);
    await signOut(page);

    await adminLogin(page);
    await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
    await page.getByRole("link", { name: "Reset Target" }).first().click();
    await expect(page.getByTestId("user-detail-name")).toHaveText("Reset Target");

    await page.getByTestId("reset-password").fill("AdminSet123");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByTestId("user-notice")).toContainText("Password reset");

    // The new password works and the old one does not.
    await page.goto("/login");
    await signIn(page, email, "Passw0rd123");
    await expect(page.getByTestId("auth-error")).toContainText("Incorrect email or password");

    await signIn(page, email, "AdminSet123");
    await expect(page.getByTestId("header-user")).toHaveText("Reset Target");
  });

  test("revoking sessions signs the user out everywhere", async ({ browser }) => {
    const email = uniqueEmail("e2e-admin-revoke");

    const player = await browser.newContext();
    const playerPage = await player.newPage();
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();

    try {
      await signUp(playerPage, "Revoke Target", email);
      await expect(playerPage.getByTestId("header-user")).toBeVisible();

      await adminLogin(adminPage);
      await adminPage.goto(`/admin/users?q=${encodeURIComponent(email)}`);
      await adminPage.getByRole("link", { name: "Revoke Target" }).first().click();

      await adminPage.getByTestId("revoke-sessions").click();
      await expect(adminPage.getByTestId("revoke-notice")).toContainText("revoked");

      // The player's next request is no longer authenticated.
      await playerPage.goto("/profile");
      await expect(playerPage).toHaveURL(/\/login/);
    } finally {
      await player.close();
      await admin.close();
    }
  });

  test("banning blocks sign-in until the user is unbanned", async ({ page }) => {
    const email = uniqueEmail("e2e-admin-ban");
    await signUp(page, "Ban Target", email);
    await signOut(page);

    await adminLogin(page);
    await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
    await page.getByRole("link", { name: "Ban Target" }).first().click();
    await expect(page.getByTestId("user-detail-name")).toHaveText("Ban Target");

    await page.getByTestId("toggle-ban").click();
    await expect(page.getByTestId("toggle-ban")).toContainText("Unban");

    await page.goto("/login");
    await signIn(page, email, "Passw0rd123");
    await expect(page.getByTestId("auth-error")).toContainText("suspended");

    // Unban and confirm access is restored.
    await adminLogin(page);
    await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
    await page.getByRole("link", { name: "Ban Target" }).first().click();
    await page.getByTestId("toggle-ban").click();
    await expect(page.getByTestId("toggle-ban")).toContainText("Ban user");

    await page.goto("/login");
    await signIn(page, email, "Passw0rd123");
    await expect(page.getByTestId("header-user")).toHaveText("Ban Target");
  });

  test("the admin user list is reachable from the sidebar", async ({ page }) => {
    await adminLogin(page);
    await page.getByTestId("admin-nav-users").click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test("a banned user is flagged in the list", async ({ page }) => {
    const email = uniqueEmail("e2e-admin-flag");
    await signUp(page, "Flag Target", email);
    await signOut(page);

    await adminLogin(page);
    await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
    await page.getByRole("link", { name: "Flag Target" }).first().click();
    await page.getByTestId("toggle-ban").click();
    await expect(page.getByTestId("toggle-ban")).toContainText("Unban");

    await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
    await expect(page.getByText("BANNED")).toBeVisible();

    // Clean up so the account does not linger in a banned state.
    await page.getByRole("link", { name: "Flag Target" }).first().click();
    await page.getByTestId("toggle-ban").click();
  });
});

test.describe("@heavy admin public pages", () => {
  test("the schedule page renders the assignment form", async ({ page }) => {
    await adminLogin(page);
    await openPage(page, "/admin/schedule");
    await expect(page.getByTestId("schedule-word")).toBeVisible();
  });
});
