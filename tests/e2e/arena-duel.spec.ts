import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Two real players, two browser contexts, one match.
 *
 * This is the only spec that exercises the actual queue → pairing → duel path
 * between two humans; everything else uses the bot.
 */

async function openLobby(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/arena");
  const consent = page.getByTestId("consent-all");
  if (await consent.isVisible().catch(() => false)) await consent.click();
  return { context, page };
}

/**
 * Both players must join before either can pair, so the queue clicks have to
 * happen before we wait for a match.
 */
async function startBoth(alpha: Page, beta: Page) {
  await alpha.getByTestId("arena-find").click();
  await beta.getByTestId("arena-find").click();

  await expect(alpha.getByTestId("arena-grid")).toBeVisible({ timeout: 30_000 });
  await expect(beta.getByTestId("arena-grid")).toBeVisible({ timeout: 30_000 });
}

/** Waits until a play window is open, then submits with the keyboard. */
async function guessOnce(page: Page, word: string) {
  await expect(page.getByTestId("arena-phase")).toContainText("Round", { timeout: 20_000 });
  await page.keyboard.type(word);
  await page.keyboard.press("Enter");
}

test.describe("@heavy human duel", () => {
  test("two players pair, hide each other's live row, then reveal it", async ({ browser }) => {
    const alpha = await openLobby(browser);
    const beta = await openLobby(browser);

    try {
      await startBoth(alpha.page, beta.page);

      // Each player sees a different opponent (they are distinct guests).
      const alphaOpponent = await alpha.page.getByTestId("arena-opponent-name").innerText();
      const betaOpponent = await beta.page.getByTestId("arena-opponent-name").innerText();
      expect(alphaOpponent).not.toBe(betaOpponent);

      // Alpha plays a word in round 1.
      await guessOnce(alpha.page, "crane");
      await expect(alpha.page.getByTestId("arena-grid")).toContainText(/crane/i);

      // Beta must NOT see alpha's in-progress row while the round is live.
      const betaSeesAlpha = await beta.page.getByTestId("arena-opponent-board").innerText();
      expect(betaSeesAlpha.toLowerCase()).not.toContain("crane");

      // Once the round ends the row is revealed to the opponent.
      await expect(beta.page.getByTestId("arena-opponent-board")).toContainText(/crane/i, {
        timeout: 25_000,
      });
    } finally {
      await alpha.context.close();
      await beta.context.close();
    }
  });

  test("a player who stops responding forfeits the match", async ({ browser }) => {
    const alpha = await openLobby(browser);
    const beta = await openLobby(browser);

    try {
      await startBoth(alpha.page, beta.page);

      // Beta leaves — alpha should be declared the winner.
      await beta.page.getByRole("button", { name: /Leave match/i }).click();

      await expect(alpha.page.getByTestId("arena-result")).toBeVisible({ timeout: 30_000 });
      await expect(alpha.page.getByTestId("arena-result-title")).toContainText(/win/i);
    } finally {
      await alpha.context.close();
      await beta.context.close();
    }
  });
});
