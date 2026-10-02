import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const OUTBOX = path.join(process.cwd(), ".mail-outbox.log");

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** The server writes reset codes to the outbox via the `file` mail provider. */
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
        // Ignore partially written lines.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No reset code arrived for ${address}`);
}

async function signUp(page: Page, email: string, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Passw0rd123");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("header-user")).toHaveText(name);
  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("login-link")).toBeVisible();
}

test.describe("@heavy password reset", () => {
  test("resets the password end to end with an emailed code", async ({ page }) => {
    const email = uniqueEmail("e2e-reset");
    const newPassword = "FreshPassw0rd9";

    await signUp(page, email, "Reset Flow");

    // Step 1 — request a code.
    await page.goto("/login");
    await page.getByTestId("forgot-password-link").click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    await page.getByLabel("Email").fill(email);
    await page.getByTestId("reset-request-submit").click();
    await expect(page).toHaveURL(/\/forgot-password\/verify/);
    await expect(page.getByLabel("6-digit code")).toBeVisible();

    // Step 2 — enter the code that was "emailed".
    const otp = await waitForOtp(email);
    await page.getByLabel("6-digit code").fill(otp);
    await page.getByTestId("reset-verify-submit").click();
    await expect(page).toHaveURL(/\/reset-password$/);

    // Step 3 — choose a new password.
    await page.getByLabel("New password").fill(newPassword);
    await page.getByLabel("Confirm password").fill(newPassword);
    await page.getByTestId("reset-password-submit").click();

    await expect(page).toHaveURL(/\/login\?reset=1/);
    await expect(page.getByTestId("reset-success")).toBeVisible();

    // The old password no longer works.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("auth-error")).toContainText("Incorrect email or password");

    // The new password does.
    await page.getByLabel("Password").fill(newPassword);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("header-user")).toHaveText("Reset Flow");
  });

  test("rejects a wrong code and allows a retry", async ({ page }) => {
    const email = uniqueEmail("e2e-reset-wrong");

    await signUp(page, email, "Wrong Code");

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByTestId("reset-request-submit").click();
    await expect(page).toHaveURL(/\/forgot-password\/verify/);

    const otp = await waitForOtp(email);
    const wrong = otp === "000000" ? "111111" : "000000";

    await page.getByLabel("6-digit code").fill(wrong);
    await page.getByTestId("reset-verify-submit").click();
    await expect(page.getByTestId("reset-error")).toContainText("incorrect or has expired");
    await expect(page).toHaveURL(/\/forgot-password\/verify/);

    // The real code still works afterwards.
    await page.getByLabel("6-digit code").fill(otp);
    await page.getByTestId("reset-verify-submit").click();
    await expect(page).toHaveURL(/\/reset-password$/);
  });

  test("does not reveal whether an email is registered", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(uniqueEmail("e2e-reset-missing"));
    await page.getByTestId("reset-request-submit").click();

    // Same outcome as a real account: the code screen.
    await expect(page).toHaveURL(/\/forgot-password\/verify/);
  });
});
