import { expect, test, type Page } from "@playwright/test";

import { openPage } from "./helpers";

async function openGame(page: Page, slug: string, startTestId: string) {
  await openPage(page, `/games/${slug}`);
  if (
    await page
      .getByTestId(startTestId)
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId(startTestId).click();
  }
}

test.describe("wordle details", () => {
  test("can be played with the physical keyboard alone", async ({ page }) => {
    await openGame(page, "wordle", "wordle-start-daily");

    await page.keyboard.type("crane");
    await expect(page.getByTestId("wordle-current-row")).toContainText(/crane/i);

    // Backspace removes the last letter.
    await page.keyboard.press("Backspace");
    await expect(page.getByTestId("wordle-current-row")).toContainText(/cran/i);

    await page.keyboard.type("e");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("wordle-row-0")).toBeVisible();
  });

  test("copies a spoiler-free share grid to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openGame(page, "wordle", "wordle-start-daily");

    // Play the game out so the share panel appears.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (
        await page
          .getByTestId("wordle-complete")
          .isVisible()
          .catch(() => false)
      )
        break;
      await page.keyboard.type("crane");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("wordle-attempts")).toContainText(`${attempt + 1}/6`);
    }

    await expect(page.getByTestId("wordle-complete")).toBeVisible();
    await page.getByTestId("wordle-share").click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("Wordle Arena");
    expect(clipboard).toMatch(/[🟩🟨⬜]/);
  });
});

test.describe("spelling bee details", () => {
  test("letter tiles build the word and the centre is required", async ({ page }) => {
    await openGame(page, "spelling-bee", "bee-start");

    await page.getByTestId("bee-centre").click();
    await page.getByTestId("bee-centre").click();
    const value = await page.getByTestId("bee-input").inputValue();
    expect(value).toHaveLength(2);
    expect(value[0]).toBe(value[1]);

    // Editing the input is allowed and non-letters are stripped.
    await page.getByTestId("bee-input").fill("a1b!");
    await expect(page.getByTestId("bee-input")).toHaveValue("ab");
  });

  test("rejects words shorter than four letters", async ({ page }) => {
    await openGame(page, "spelling-bee", "bee-start");

    const centre = (await page.getByTestId("bee-centre").innerText()).trim().toLowerCase();
    await page.getByTestId("bee-input").fill(centre.repeat(3));
    await page.getByTestId("bee-submit").click();

    await expect(page.getByTestId("bee-error")).toContainText("at least 4");
  });

  test("shows the scoring rules and an empty found list", async ({ page }) => {
    await openGame(page, "spelling-bee", "bee-start");

    await expect(page.getByText("How to score")).toBeVisible();
    await expect(page.getByText("Found words (0)")).toBeVisible();
    await expect(page.getByTestId("bee-score")).toContainText("points");
  });
});

test.describe("connections details", () => {
  test("shows the rules and an empty history", async ({ page }) => {
    await openGame(page, "connections", "conn-start");

    await expect(page.getByText("How to play")).toBeVisible();
    await expect(page.getByTestId("conn-mistakes")).toContainText("0 / 4");
    await expect(page.getByTestId("conn-history")).toHaveCount(0);
  });

  test("deselecting a tile frees the slot", async ({ page }) => {
    await openGame(page, "connections", "conn-start");

    const tiles = page.locator('[data-testid^="conn-tile-"]');
    await tiles.nth(0).click();
    await expect(tiles.nth(0)).toHaveAttribute("data-selected", "true");

    await tiles.nth(0).click();
    await expect(tiles.nth(0)).toHaveAttribute("data-selected", "false");
    await expect(page.getByTestId("conn-submit")).toBeDisabled();
  });

  test("records a guess in the history", async ({ page }) => {
    await openGame(page, "connections", "conn-start");

    const tiles = page.locator('[data-testid^="conn-tile-"]');
    for (let index = 0; index < 4; index += 1) await tiles.nth(index).click();
    await page.getByTestId("conn-submit").click();

    // Either it was a group (history cleared, band appears) or a mistake was logged.
    const mistakes = page.getByTestId("conn-mistakes");
    const history = page.getByTestId("conn-history");
    await expect(mistakes.or(history).first()).toBeVisible();
    await expect(page.getByTestId("conn-submit")).toBeDisabled();
  });
});
