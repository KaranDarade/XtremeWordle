import "dotenv/config";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Entrance/hover animations fade content in, and axe samples computed colours
 * mid-transition (which always looks low-contrast). Audit with reduced motion
 * so we assert the settled UI — and cover the reduced-motion path too.
 */
test.use({ reducedMotion: "reduce" });

const PAGES: { name: string; path: string }[] = [
  { name: "landing", path: "/" },
  { name: "arena", path: "/arena" },
  { name: "leaderboard", path: "/leaderboard" },
  { name: "games hub", path: "/games" },
  { name: "wordle", path: "/games/wordle" },
  { name: "spelling bee", path: "/games/spelling-bee" },
  { name: "connections", path: "/games/connections" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "admin login", path: "/admin/login" },
  { name: "privacy policy", path: "/privacy" },
  { name: "terms of use", path: "/terms" },
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/users",
  "/admin/games",
  "/admin/arena",
  "/admin/schedule",
  "/admin/words",
  "/admin/analytics",
  "/admin/audit",
];

function describeViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 3)
        .map((node) => `      ${node.target.join(" ")}`)
        .join("\n");
      return `  ${violation.id} [${violation.impact}] ${violation.help}\n${nodes}`;
    })
    .join("\n");
}

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
}

for (const target of PAGES) {
  test(`no serious accessibility violations on ${target.name}`, async ({ page }) => {
    await page.goto(target.path);
    await page.locator("body").waitFor({ state: "visible" });

    const blocking = await blockingViolations(page);
    expect(blocking, `\n${describeViolations(blocking)}\n`).toEqual([]);
  });
}

test("scored Wordle board (green / amber / grey tiles) is accessible", async ({ page }) => {
  await page.goto("/");
  await page.goto("/games/wordle");

  const start = page.getByTestId("wordle-start-daily");
  if (await start.isVisible().catch(() => false)) await start.click();

  await page.keyboard.type("crane");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("wordle-row-0")).toBeVisible();

  const blocking = await blockingViolations(page);
  expect(blocking, `\n${describeViolations(blocking)}\n`).toEqual([]);
});

test("admin dashboard pages are accessible to signed-in staff", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const route of ADMIN_PAGES) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const blocking = await blockingViolations(page);
    expect(blocking, `${route}\n${describeViolations(blocking)}\n`).toEqual([]);
  }
});
