import { expect, test, type Page } from "@playwright/test";

/** Waits until a play window is open, then submits a word with the keyboard. */
async function guessOnce(page: Page, word: string) {
  await expect(page.getByTestId("arena-phase")).toContainText("Round", { timeout: 20_000 });
  await page.keyboard.type(word);
  await page.keyboard.press("Enter");
}

test.describe("arena lobby", () => {
  test("offers duels and shows who is online", async ({ page }) => {
    await page.goto("/arena");

    await expect(page.getByTestId("arena-find")).toBeVisible();
    await expect(page.getByTestId("arena-bot")).toBeVisible();
    await expect(page.getByTestId("arena-online-total")).toBeVisible();
    await expect(page.getByTestId("arena-online-matches")).toBeVisible();
  });

  test("is reachable from the landing page, the games hub and the Wordle page", async ({
    page,
  }) => {
    // Landing: the arena band is the primary entry point.
    await page.goto("/");
    await expect(page.getByTestId("arena-band")).toBeVisible();
    await page.getByTestId("arena-band-play").click();
    await expect(page).toHaveURL(/\/arena$/);

    // Games hub: the dedicated arena card.
    await page.goto("/games");
    await page.getByTestId("game-card-arena").click();
    await expect(page).toHaveURL(/\/arena$/);

    // Header call to action.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("nav-arena").click();
    await expect(page).toHaveURL(/\/arena$/);

    // Wordle page tab.
    await page.goto("/games/wordle");
    await page.getByTestId("wordle-mode-arena").click();
    await expect(page).toHaveURL(/\/arena$/);
  });
});

test.describe("@heavy duel", () => {
  test("plays a full duel against the bot", async ({ page }) => {
    await page.goto("/arena");
    await page.getByTestId("arena-bot").click();

    await expect(page.getByTestId("arena-grid")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("arena-timer")).toBeVisible();
    await expect(page.getByTestId("arena-opponent-name")).toContainText("BOT");

    await guessOnce(page, "crane");
    await expect(page.getByTestId("arena-grid")).toContainText(/crane/i);

    // The bot plays on its own until the match resolves.
    await expect(page.getByTestId("arena-result")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("arena-word")).not.toBeEmpty();
    await expect(page.getByTestId("arena-rematch")).toBeVisible();

    // Casual matches never move rank points.
    await expect(page.getByText("Casual match — no rank points changed.")).toBeVisible();
  });

  test("rejects a word that is not in the dictionary", async ({ page }) => {
    await page.goto("/arena");
    await page.getByTestId("arena-bot").click();
    await expect(page.getByTestId("arena-grid")).toBeVisible({ timeout: 20_000 });

    await guessOnce(page, "zzzzz");
    await expect(page.getByTestId("arena-error")).toContainText("Not in word list");
  });

  test("sends a reaction to the opponent", async ({ page }) => {
    await page.goto("/arena");
    await page.getByTestId("arena-bot").click();
    await expect(page.getByTestId("arena-grid")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("arena-reaction-😂").click();
    await expect(page.getByTestId("arena-reaction-log")).toContainText("😂");
  });

  test("leaves a match and returns to the lobby", async ({ page }) => {
    await page.goto("/arena");
    await page.getByTestId("arena-bot").click();
    await expect(page.getByTestId("arena-grid")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Leave match/i }).click();
    await expect(page.getByTestId("arena-find")).toBeVisible();
  });
});
