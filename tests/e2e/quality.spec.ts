import { expect, test, type Page } from "@playwright/test";

import { AVATAR_CATEGORIES } from "../../src/lib/avatar/config";
import { adminLogin, openPage, signUp, uniqueEmail } from "./helpers";

interface RuntimeIssue {
  kind: string;
  detail: string;
}

function watchRuntime(page: Page): RuntimeIssue[] {
  const issues: RuntimeIssue[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") issues.push({ kind: "console", detail: message.text() });
  });
  page.on("pageerror", (error) => issues.push({ kind: "pageerror", detail: error.message }));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      issues.push({ kind: "http", detail: `${response.status()} ${response.url()}` });
    }
  });

  return issues;
}

function report(issues: RuntimeIssue[]): string {
  return `\n${issues.map((issue) => `  [${issue.kind}] ${issue.detail}`).join("\n")}\n`;
}

const PUBLIC_PAGES = [
  "/",
  "/games",
  "/arena",
  "/leaderboard",
  "/games/wordle",
  "/games/spelling-bee",
  "/games/connections",
  "/login",
  "/signup",
  "/forgot-password",
  "/privacy",
  "/terms",
];

test.describe("@heavy theme across every page", () => {
  test("toggling light and dark is clean everywhere", async ({ page }) => {
    const issues = watchRuntime(page);

    for (const path of PUBLIC_PAGES) {
      await openPage(page, path);
      await page.getByTestId("theme-toggle").click();
      await page.getByTestId("theme-toggle").click();
    }

    expect(issues, report(issues)).toEqual([]);
  });
});

test.describe("@heavy avatar builder coverage", () => {
  test("every option in every category can be selected without errors", async ({ page }) => {
    await signUp(page, "Avatar Crawl", uniqueEmail("e2e-avatar-crawl"));
    const issues = watchRuntime(page);

    await page.goto("/profile/avatar");
    await expect(page.getByTestId("avatar-preview")).toBeVisible();

    for (const category of AVATAR_CATEGORIES) {
      for (const option of category.options) {
        await page.getByTestId(`avatar-${category.key}-${option}`).click();
        await expect(page.getByTestId(`avatar-${category.key}-${option}`)).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
    }

    await page.getByTestId("avatar-randomise").click();
    await page.getByRole("button", { name: "Reset" }).click();

    expect(issues, report(issues)).toEqual([]);
  });
});

test.describe("@heavy admin interactions", () => {
  test("expanding every game editor is clean", async ({ page }) => {
    await adminLogin(page);
    const issues = watchRuntime(page);

    await page.goto("/admin/games");
    const summaries = page.locator("summary");
    const count = await summaries.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      await summaries.nth(index).click();
    }

    // Theme toggle on each admin page too.
    for (const path of [
      "/admin",
      "/admin/users",
      "/admin/games",
      "/admin/schedule",
      "/admin/words",
      "/admin/analytics",
      "/admin/arena",
      "/admin/audit",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.getByTestId("theme-toggle").click();
      await page.getByTestId("theme-toggle").click();
    }

    expect(issues, report(issues)).toEqual([]);
  });
});

test.describe("sound preference", () => {
  test("toggling sound persists across a reload", async ({ page }) => {
    await openPage(page, "/arena");
    await page.getByTestId("arena-bot").click();
    await expect(page.getByTestId("arena-grid")).toBeVisible({ timeout: 20_000 });

    const toggle = page.getByTestId("arena-sound-toggle");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.getByTestId("arena-sound-toggle")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("@heavy responsive layout", () => {
  const PAGES = ["/", "/games", "/arena", "/leaderboard", "/games/wordle", "/privacy"];

  test("every key page fits horizontally at every width", async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      for (const path of PAGES) {
        await openPage(page, path);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflowed at ${width}px`).toBeLessThanOrEqual(1);

        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      }
    }
  });

  test("the arena band stacks cleanly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openPage(page, "/");

    const band = page.getByTestId("arena-band");
    await expect(band).toBeVisible();
    await expect(page.getByTestId("arena-band-play")).toBeVisible();

    const box = await band.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  });
});
