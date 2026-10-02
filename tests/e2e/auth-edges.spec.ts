import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { ADMIN_EMAIL, adminLogin, signUp, uniqueEmail } from "./helpers";

const OUTBOX = path.join(process.cwd(), ".mail-outbox.log");

async function waitForOtp(address: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const contents = await readFile(OUTBOX, "utf8").catch(() => "");
    const lines = contents.split("\n").filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const message = JSON.parse(lines[index]) as { to?: string; text?: string };
        if (message.to !== address) continue;
        const match = String(message.text ?? "").match(/\b(\d{6})\b/);
        if (match) return match[1];
      } catch {
        // Partial line, keep looking.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No reset code arrived for ${address}`);
}

async function requestReset(page: import("@playwright/test").Page, email: string) {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByTestId("reset-request-submit").click();
  await expect(page).toHaveURL(/\/forgot-password\/verify/);
}

/** Submits a code and waits for the server action to answer before continuing. */
async function submitOtp(page: import("@playwright/test").Page, code: string) {
  await page.getByLabel("6-digit code").fill(code);
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST", { timeout: 15_000 }),
    page.getByTestId("reset-verify-submit").click(),
  ]);
}

test.describe("password reset edges", () => {
  test("rejects mismatched passwords", async ({ page }) => {
    const email = uniqueEmail("e2e-edge-mismatch");
    await signUp(page, "Mismatch", email);
    await page.getByTestId("logout-button").click();

    await requestReset(page, email);
    await page.getByLabel("6-digit code").fill(await waitForOtp(email));
    await page.getByTestId("reset-verify-submit").click();
    await expect(page).toHaveURL(/\/reset-password$/);

    await page.getByLabel("New password").fill("BrandNew1");
    await page.getByLabel("Confirm password").fill("Different2");
    await page.getByTestId("reset-password-submit").click();

    // The specific message sits on the confirm field; the banner stays generic.
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password$/);
  });

  test("sends a new code when resend is used", async ({ page }) => {
    const email = uniqueEmail("e2e-edge-resend");
    await signUp(page, "Resend", email);
    await page.getByTestId("logout-button").click();

    await requestReset(page, email);
    await page.getByTestId("reset-resend").click();

    await expect(page).toHaveURL(/resent=1/);
    await expect(page.getByTestId("reset-resent")).toContainText("on its way");
  });

  test("gives up after too many incorrect codes", async ({ page }) => {
    const email = uniqueEmail("e2e-edge-attempts");
    await signUp(page, "Attempts", email);
    await page.getByTestId("logout-button").click();

    await requestReset(page, email);
    const real = await waitForOtp(email);
    const wrong = real === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitOtp(page, wrong);
      await expect(page.getByTestId("reset-error")).toContainText("incorrect or has expired");
    }

    await submitOtp(page, wrong);
    await expect(page.getByTestId("reset-error")).toContainText("Too many incorrect attempts");
  });

  test("a missing reset ticket sends the user back to the start", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("the verify page without an email redirects to the start", async ({ page }) => {
    await page.goto("/forgot-password/verify");
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("an unknown email still reaches the code screen", async ({ page }) => {
    await requestReset(page, uniqueEmail("e2e-edge-unknown"));
    await expect(page.getByLabel("6-digit code")).toBeVisible();
  });
});

test.describe("admin access edges", () => {
  test("a regular account is refused admin sign-in", async ({ page }) => {
    const email = uniqueEmail("e2e-edge-nonadmin");
    await signUp(page, "Not Admin", email);
    await page.getByTestId("logout-button").click();

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByTestId("auth-error")).toContainText("does not have admin access");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("the admin credentials work on the admin login", async ({ page }) => {
    await adminLogin(page);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("a signed-out visitor is redirected away from admin", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("admin sign-in rejects a wrong password then accepts the real one", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toContainText("Incorrect email or password");

    // Retry on the admin login page (not the site login page).
    await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "Admin@12345");
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});
