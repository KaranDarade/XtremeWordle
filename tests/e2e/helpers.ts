import "dotenv/config";

import { expect, type Page } from "@playwright/test";

/** Shared helpers for the E2E specs. Not a spec file, so Playwright ignores it. */

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@extremewordle.local";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@12345";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Signs a brand-new account up and leaves the session active. */
export async function signUp(
  page: Page,
  name: string,
  email: string,
  password = "Passw0rd123",
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("header-user")).toHaveText(name);
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByTestId("auth-submit").click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("login-link")).toBeVisible();
}

export async function adminLogin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Visits a page and dismisses the consent banner if it appears. */
export async function openPage(page: Page, path: string): Promise<void> {
  await page.goto("/");
  await page.goto(path);
  const consent = page.getByTestId("consent-all");
  if (await consent.isVisible().catch(() => false)) await consent.click();
}
