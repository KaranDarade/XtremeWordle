import { expect, test } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${random}@example.com`;
}

function isDark(className: string | null): boolean {
  return (className ?? "").split(/\s+/).includes("dark");
}

test.describe("landing page", () => {
  test("renders for anonymous visitors without requiring an account", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Play. Guess.");
    await expect(page.getByTestId("login-link")).toBeVisible();
    await expect(page.getByTestId("signup-link")).toBeVisible();
  });

  test("sets an anonymous guest cookie", async ({ context, page }) => {
    await page.goto("/");
    const guest = (await context.cookies()).find((cookie) => cookie.name === "ew_guest");
    expect(guest?.value).toBeTruthy();
    expect(guest?.httpOnly).toBe(true);
  });
});

test.describe("theme", () => {
  test("toggles and persists across reloads", async ({ page }) => {
    await page.goto("/");

    const initial = isDark(await page.locator("html").getAttribute("class"));
    await page.getByTestId("theme-toggle").click();
    await expect
      .poll(async () => isDark(await page.locator("html").getAttribute("class")))
      .toBe(!initial);

    await page.reload();
    expect(isDark(await page.locator("html").getAttribute("class"))).toBe(!initial);
  });
});

test.describe("auth", () => {
  test("signup, sign out and sign back in", async ({ page }) => {
    const email = uniqueEmail("e2e-signup");

    await page.goto("/signup");
    await page.getByLabel("Name").fill("E2E User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("header-user")).toHaveText("E2E User");

    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("login-link")).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("header-user")).toHaveText("E2E User");
  });

  test("persists the account and session across reloads", async ({ page, context }) => {
    const email = uniqueEmail("e2e-persist");

    await page.goto("/signup");
    await page.getByLabel("Name").fill("Persist User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("header-user")).toHaveText("Persist User");

    // The session is server-side, so a reload must stay signed in.
    await page.reload();
    await expect(page.getByTestId("header-user")).toHaveText("Persist User");

    // Session cookie is opaque and HTTP-only, never readable by scripts.
    const session = (await context.cookies()).find((cookie) => cookie.name === "ew_session");
    expect(session?.value).toBeTruthy();
    expect(session?.httpOnly).toBe(true);

    // Credentials were persisted: a fresh sign-in with the same details works.
    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("login-link")).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("header-user")).toHaveText("Persist User");
  });

  test("rejects a weak password on signup", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Weak Password");
    await page.getByLabel("Email").fill(uniqueEmail("e2e-weak"));
    await page.getByLabel("Password").fill("short");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("rejects incorrect credentials on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail("e2e-nouser"));
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText("Incorrect email or password");
    await expect(page).toHaveURL(/\/login/);
  });
});
