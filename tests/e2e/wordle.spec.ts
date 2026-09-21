import { expect, test, type Page } from "@playwright/test";

/** Visit the landing page first so the guest cookie is issued before playing. */
async function openWordle(page: Page) {
  await page.goto("/");
  await page.goto("/games/wordle");

  if (
    await page
      .getByTestId("wordle-start-panel")
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId("wordle-start-daily").click();
  }
  await expect(page.getByTestId("wordle-grid")).toBeVisible();
}

async function typeWord(page: Page, word: string) {
  // Never type while a previous guess is still in flight.
  await expect(page.getByTestId("wordle-key-enter")).toBeEnabled();
  for (const letter of word) {
    await page.getByTestId(`wordle-key-${letter}`).click();
  }
  await page.getByTestId("wordle-key-enter").click();
}

/** Waits until the server has registered `count` attempts. */
async function waitForAttempts(page: Page, count: number) {
  await expect
    .poll(async () =>
      (await page.getByTestId("wordle-attempts").innerText()).includes(`· ${count}/6`),
    )
    .toBe(true);
}

test.describe("wordle", () => {
  test("renders the daily board and resumes progress after a reload", async ({ page }) => {
    await openWordle(page);

    await page.keyboard.type("crane");
    await expect(page.getByTestId("wordle-current-row")).toContainText(/crane/i);
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("wordle-row-0")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("wordle-row-0")).toBeVisible();
    await expect(page.getByTestId("wordle-row-0")).toContainText(/crane/i);
  });

  test("rejects words that are not in the dictionary", async ({ page }) => {
    await openWordle(page);

    await typeWord(page, "zzzzz");
    await expect(page.getByTestId("wordle-error")).toContainText("Not in word list");

    // The rejected guess must not occupy a board row.
    await expect(page.getByTestId("wordle-row-0")).toHaveCount(0);
  });

  test("plays a daily game to completion and reveals the answer", async ({ page }) => {
    await openWordle(page);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (
        await page
          .getByTestId("wordle-complete")
          .isVisible()
          .catch(() => false)
      )
        break;
      await typeWord(page, "slate");
      await waitForAttempts(page, attempt + 1);
    }

    await expect(page.getByTestId("wordle-complete")).toBeVisible();
    await expect(page.getByTestId("wordle-answer")).not.toBeEmpty();
  });

  test("shares a spoiler-free result", async ({ page }) => {
    await openWordle(page);

    // Play the daily game out, syncing on each registered attempt.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (
        await page
          .getByTestId("wordle-complete")
          .isVisible()
          .catch(() => false)
      )
        break;
      await typeWord(page, "crane");
      await waitForAttempts(page, attempt + 1);
    }

    await expect(page.getByTestId("wordle-complete")).toBeVisible();
    await page.getByTestId("wordle-share").click();
    await expect(page.getByTestId("wordle-notice")).toBeVisible();
  });

  test("switches to unlimited mode and starts a fresh word", async ({ page }) => {
    await openWordle(page);
    await typeWord(page, "slate");
    await expect(page.getByTestId("wordle-row-0")).toBeVisible();

    await page.getByTestId("wordle-mode-unlimited").click();
    await expect(page.getByTestId("wordle-row-0")).toHaveCount(0);
    await expect(page.getByTestId("wordle-attempts")).toContainText(/pool refreshes/i);

    await typeWord(page, "crane");
    await expect(page.getByTestId("wordle-row-0")).toBeVisible();
  });

  test("shows a guest prompt offering an optional account", async ({ page }) => {
    await openWordle(page);
    await expect(page.getByTestId("wordle-signin")).toBeVisible();
    await expect(page.getByTestId("wordle-signin")).toContainText("Create an account");
  });

  test("migrates guest progress into a newly created account", async ({ page }) => {
    await openWordle(page);
    await page.keyboard.type("crane");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("wordle-row-0")).toBeVisible();

    const email = `e2e-migrate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Migrating Player");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Passw0rd123");
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("/");

    // The guest's in-progress daily game now belongs to the account.
    await page.goto("/games/wordle");
    await expect(page.getByTestId("wordle-row-0")).toBeVisible();
    await expect(page.getByTestId("wordle-row-0")).toContainText(/crane/i);
    await expect(page.getByTestId("wordle-signin")).toHaveCount(0);
  });
});
