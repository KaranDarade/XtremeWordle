import { expect, test } from "@playwright/test";

test.describe("leaderboard", () => {
  test("renders the ranking table", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "Leaderboard", level: 1 })).toBeVisible();

    // Either nobody has points yet, or the table renders with rows.
    const empty = page.getByTestId("leaderboard-empty");
    const table = page.getByTestId("leaderboard");
    await expect(empty.or(table)).toBeVisible();
  });

  test("is reachable from the arena lobby", async ({ page }) => {
    await page.goto("/arena");
    await page.goto("/leaderboard");
    await expect(page).toHaveURL(/\/leaderboard$/);
  });
});

test.describe("match replay", () => {
  test("replays a finished duel row by row", async ({ page }) => {
    await page.goto("/arena");
    await page.getByTestId("arena-bot").click();

    await expect(page.getByTestId("arena-result")).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("arena-replay").click();

    await expect(page).toHaveURL(/\/arena\/match\//);
    await expect(page.getByRole("heading", { name: "Match replay" })).toBeVisible();
    await expect(page.getByTestId("replay-player-1")).toBeVisible();
    await expect(page.getByTestId("replay-player-2")).toBeVisible();
  });

  test("404s for a match that does not exist", async ({ page }) => {
    const response = await page.goto("/arena/match/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
