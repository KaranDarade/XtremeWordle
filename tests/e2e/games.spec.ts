import { expect, test, type Page } from "@playwright/test";

async function openGame(page: Page, slug: string, startTestId: string) {
  await page.goto("/");
  await page.goto(`/games/${slug}`);
  if (
    await page
      .getByTestId(startTestId)
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId(startTestId).click();
  }
}

test.describe("spelling bee", () => {
  test("starts today's hive with seven letter tiles", async ({ page }) => {
    await openGame(page, "spelling-bee", "bee-start");

    await expect(page.getByTestId("bee-centre")).toBeVisible();
    await expect(page.locator('[data-testid^="bee-letter-"]')).toHaveCount(6);
    await expect(page.getByTestId("bee-score")).toContainText("points");
    await expect(page.getByTestId("bee-progress")).toContainText("/");
  });

  test("clicking tiles and the centre fills the input", async ({ page }) => {
    await openGame(page, "spelling-bee", "bee-start");

    await page.locator('[data-testid^="bee-letter-"]').first().click();
    await page.getByTestId("bee-centre").click();
    const value = await page.getByTestId("bee-input").inputValue();
    expect(value.length).toBe(2);
  });

  test("every word must use the centre letter", async ({ page }) => {
    await openGame(page, "spelling-bee", "bee-start");

    const centre = (await page.getByTestId("bee-centre").innerText()).trim().toLowerCase();
    const tiles = page.locator('[data-testid^="bee-letter-"]');
    const outerLetters = await tiles.allInnerTexts();

    const nonCentre = outerLetters
      .map((letter) => letter.trim().toLowerCase())
      .find((letter) => letter !== centre);
    expect(nonCentre).toBeTruthy();

    await page.getByTestId("bee-input").fill(nonCentre!.repeat(4));
    await page.getByTestId("bee-submit").click();

    await expect(page.getByTestId("bee-error")).toContainText("centre letter");
  });

  test("rejects well-formed words that are not in the dictionary", async ({ page }) => {
    await openGame(page, "spelling-bee", "bee-start");

    const centre = (await page.getByTestId("bee-centre").innerText()).trim().toLowerCase();
    await page.getByTestId("bee-input").fill(centre.repeat(4));
    await page.getByTestId("bee-submit").click();

    await expect(page.getByTestId("bee-error")).toContainText("Not in word list");
  });
});

test.describe("connections", () => {
  test("renders a sixteen word board", async ({ page }) => {
    await openGame(page, "connections", "conn-start");

    await expect(page.locator('[data-testid^="conn-tile-"]')).toHaveCount(16);
    await expect(page.getByTestId("conn-mistakes")).toContainText("0 / 4");
    await expect(page.getByTestId("conn-solved")).toContainText("0 / 4");
  });

  test("requires exactly four tiles before submitting", async ({ page }) => {
    await openGame(page, "connections", "conn-start");

    const tiles = page.locator('[data-testid^="conn-tile-"]');
    await expect(page.getByTestId("conn-submit")).toBeDisabled();

    await tiles.nth(0).click();
    await tiles.nth(1).click();
    await tiles.nth(2).click();
    await expect(page.getByTestId("conn-submit")).toBeDisabled();

    await tiles.nth(3).click();
    await expect(page.getByTestId("conn-submit")).toBeEnabled();

    // Selecting a fifth tile does nothing once four are chosen.
    await tiles.nth(4).click();
    await expect(tiles.nth(4)).toHaveAttribute("data-selected", "false");
  });

  test("plays through to the revealed solution", async ({ page }) => {
    await openGame(page, "connections", "conn-start");

    const tiles = page.locator('[data-testid^="conn-tile-"]');
    const selectedTiles = page.locator('[data-testid^="conn-tile-"][data-selected="true"]');
    await expect(tiles).toHaveCount(16);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (
        await page
          .getByTestId("conn-complete")
          .isVisible()
          .catch(() => false)
      )
        break;
      if ((await tiles.count()) < 4) break;

      for (let index = 0; index < 4; index += 1) {
        await tiles.nth(index).click();
      }

      await expect(page.getByTestId("conn-submit")).toBeEnabled();
      await page.getByTestId("conn-submit").click();

      // Wait for the server response to clear the selection before continuing.
      await expect(selectedTiles).toHaveCount(0);
    }

    await expect(page.getByTestId("conn-complete")).toBeVisible();
    await expect(page.locator('[data-testid^="conn-category-"]')).toHaveCount(4);

    const mistakes = Number(
      ((await page.getByTestId("conn-mistakes").innerText()).match(/(\d+) \/ (\d+)/) ?? [])[1] ?? 0,
    );
    expect(mistakes).toBeLessThanOrEqual(4);
  });
});
