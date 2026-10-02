import { expect, test } from "@playwright/test";

import { adminLogin } from "./helpers";

/** A date offset in days, expressed in IST (YYYY-MM-DD). */
function istDate(offsetDays: number): string {
  const shifted = new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** The tagline seeded for Spelling Bee; used so the edit test is repeatable. */
const CANONICAL_TAGLINE = "Make words from 7 letters";

test.describe("@heavy admin word schedule", () => {
  test("assigns a daily word and protects it from automation", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/schedule");

    const date = istDate(7);
    await page.getByTestId("schedule-word").fill("crane");
    await page.locator('input[name="date"]').fill(date);
    await page.getByTestId("schedule-submit").click();
    await expect(page.getByTestId("schedule-form-notice")).toContainText("crane");

    const row = page.getByTestId(`schedule-row-${date}`);
    await expect(row).toContainText("MANUAL");

    // Regenerate must refuse to overwrite a manual slot.
    await page.getByTestId(`regenerate-${date}`).click();
    await expect(page.getByTestId("schedule-row-notice")).toContainText(
      "manual word is already set",
    );

    // Force new is the explicit override and succeeds.
    await page.getByTestId(`force-${date}`).click();
    await expect(page.getByTestId("schedule-row-notice")).toContainText("Regenerated");
    await expect(page.getByTestId(`schedule-row-${date}`)).toContainText("AUTO");
  });

  test("assigns a twelve-hour slot and the form follows the page mode", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/schedule?mode=twelve-hour");

    // The form's rotation select mirrors the page's chosen rotation.
    await expect(page.locator('select[name="mode"]')).toHaveValue("twelve-hour");
    await expect(page.locator('select[name="half"]')).toBeVisible();

    const date = istDate(6);
    await page.getByTestId("schedule-word").fill("brave");
    await page.locator('input[name="date"]').fill(date);
    await page.locator('select[name="half"]').selectOption("12");
    await page.getByTestId("schedule-submit").click();

    await expect(page.getByTestId("schedule-form-notice")).toContainText(`${date}-12`);
    await expect(page.getByTestId(`schedule-row-${date}-12`)).toContainText("MANUAL");
  });

  test("rejects a word that is not in the game list", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/schedule");

    await page.getByTestId("schedule-word").fill("zzzzz");
    await page.locator('input[name="date"]').fill(istDate(9));
    await page.getByTestId("schedule-submit").click();
    await expect(page.getByTestId("schedule-form-notice")).toContainText("not in this game");
  });

  test("blocks an empty word with native validation", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/schedule");

    await page.locator('input[name="date"]').fill(istDate(9));
    await page.getByTestId("schedule-submit").click();

    const invalid = await page
      .getByTestId("schedule-word")
      .evaluate((element) => !(element as HTMLInputElement).checkValidity());

    expect(invalid).toBe(true);
    await expect(page.getByTestId("schedule-form-notice")).toHaveCount(0);
  });

  test("switching game and rotation updates the table", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/schedule");
    await expect(page.getByText("Current slot:")).toBeVisible();

    await page.getByRole("link", { name: "Connections" }).click();
    await expect(page).toHaveURL(/game=connections/);

    await page.getByRole("link", { name: "Every 12h" }).click();
    await expect(page).toHaveURL(/mode=twelve-hour/);
  });
});

test.describe("@heavy admin games and words", () => {
  test("edits a game's details and persists them", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/games");

    const card = page.getByTestId("game-spelling-bee");
    await card.getByText("Edit details").click();
    await card.locator('input[name="tagline"]').fill(`${CANONICAL_TAGLINE} (edited)`);
    await card.getByRole("button", { name: "Save game" }).click();
    await expect(card.getByTestId(/^game-notice-/)).toContainText("Saved");

    // Details collapse on reload, so reopen before reading the value back.
    await page.reload();
    const reloaded = page.getByTestId("game-spelling-bee");
    await reloaded.getByText("Edit details").click();
    await expect(reloaded.locator('input[name="tagline"]')).toHaveValue(
      `${CANONICAL_TAGLINE} (edited)`,
    );

    // Restore the seeded copy so other specs see the original.
    await reloaded.locator('input[name="tagline"]').fill(CANONICAL_TAGLINE);
    await reloaded.getByRole("button", { name: "Save game" }).click();
    await expect(reloaded.getByTestId(/^game-notice-/)).toContainText("Saved");
  });

  test("filters word lists by pool and searches", async ({ page }) => {
    await adminLogin(page);

    // Answer pool contains known answers.
    await page.goto("/admin/words?game=wordle&pool=ANSWERS&q=crane");
    await expect(page.getByText("crane", { exact: true })).toBeVisible();

    // The validation pool is a separate list, so answers are not in it.
    await page.goto("/admin/words?game=wordle&pool=VALIDATION&q=crane");
    await expect(page.getByText("No words match this filter.")).toBeVisible();
  });

  test("renders the analytics dashboard", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/analytics");

    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText("Total plays")).toBeVisible();
    await expect(page.getByText("Plays in the last 14 days")).toBeVisible();

    // The 14-day chart must actually draw bars, not just headings: percentage
    // heights silently collapse to zero if the parent has no definite height.
    const bars = page.getByTestId("analytics-bar");
    await expect(bars).toHaveCount(14);

    const drawn = await bars.evaluateAll(
      (nodes) =>
        nodes.filter((node) => (node as HTMLElement).getBoundingClientRect().height > 0).length,
    );
    expect(drawn).toBeGreaterThan(0);
  });
});

test.describe("@heavy admin arena", () => {
  test("shows arena stats and can force-end a live match", async ({ browser }) => {
    // A guest starts a duel so there is something live to end.
    const player = await browser.newContext();
    const playerPage = await player.newPage();
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();

    try {
      await playerPage.goto("/arena");
      const consent = playerPage.getByTestId("consent-all");
      if (await consent.isVisible().catch(() => false)) await consent.click();
      await playerPage.getByTestId("arena-bot").click();
      await expect(playerPage.getByTestId("arena-grid")).toBeVisible({ timeout: 20_000 });

      await adminLogin(adminPage);
      await adminPage.goto("/admin/arena");

      await expect(adminPage.getByRole("heading", { name: "Arena" })).toBeVisible();
      await expect(adminPage.getByText("Live matches", { exact: true })).toBeVisible();
      await expect(adminPage.getByText("Waiting in queue", { exact: true })).toBeVisible();

      // Loading the dashboard cleans up abandoned matches, so exactly the one
      // we just started should be live.
      const forceEnd = adminPage.getByRole("button", { name: "Force end" });
      await expect(forceEnd).toHaveCount(1, { timeout: 10_000 });
      await forceEnd.first().click();

      await expect(forceEnd).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await player.close();
      await admin.close();
    }
  });
});

test.describe("@heavy admin audit", () => {
  test("records admin activity", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/audit");

    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("admin.login").first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Action" })).toBeVisible();
  });
});
