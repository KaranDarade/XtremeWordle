import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

interface RuntimeIssue {
  kind: "console" | "pageerror" | "requestfailed" | "http";
  detail: string;
}

/**
 * Collects every client-side runtime signal that should never happen in a
 * healthy app: console errors, uncaught exceptions, failed requests and 4xx/5xx
 * responses. Navigation smoothness is asserted separately with link clicks.
 */
function watchRuntime(page: Page): RuntimeIssue[] {
  const issues: RuntimeIssue[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push({ kind: "console", detail: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    issues.push({ kind: "pageerror", detail: error.message });
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    // Aborted prefetches/navigations when a test moves on are not app errors.
    if (failure.includes("ERR_ABORTED")) return;
    issues.push({ kind: "requestfailed", detail: `${request.url()} — ${failure}` });
  });
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

const PUBLIC_ROUTES = [
  "/",
  "/arena",
  "/leaderboard",
  "/games",
  "/games/wordle",
  "/games/spelling-bee",
  "/games/connections",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
];

const ADMIN_ROUTES = [
  "/admin",
  "/admin/users",
  "/admin/games",
  "/admin/arena",
  "/admin/schedule",
  "/admin/words",
  "/admin/analytics",
  "/admin/audit",
];

test("every public page loads without runtime errors", async ({ page }) => {
  const issues = watchRuntime(page);

  for (const route of PUBLIC_ROUTES) {
    await page.goto(route);
    await page.locator("body").waitFor({ state: "visible" });
  }

  expect(issues, report(issues)).toEqual([]);
});

test("switching the theme on every page is clean", async ({ page }) => {
  const issues = watchRuntime(page);

  for (const route of ["/", "/games/wordle", "/games/spelling-bee", "/games/connections"]) {
    await page.goto(route);
    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("theme-toggle").click();
  }

  expect(issues, report(issues)).toEqual([]);
});

test("the games hub and each board render as expected", async ({ page }) => {
  const issues = watchRuntime(page);

  await page.goto("/games");
  await expect(page.locator('[data-testid^="game-card-"]')).toHaveCount(4);

  for (const game of ["wordle", "spelling-bee", "connections"]) {
    await page.getByTestId(`game-card-${game}`).click();
    await expect(page).toHaveURL(new RegExp(`/games/${game}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/games$/);
  }

  expect(issues, report(issues)).toEqual([]);
});

test("client-side navigation never falls back to a full reload", async ({ page }) => {
  const issues = watchRuntime(page);
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url());
  });

  await page.goto("/");
  const initialDocuments = documents.length;

  await page.getByTestId("nav-games").click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole("heading", { name: "All games" })).toBeVisible();

  await page.getByTestId("game-card-wordle").click();
  await expect(page).toHaveURL(/\/games\/wordle$/);

  await page.getByRole("link", { name: "All games" }).click();
  await expect(page).toHaveURL(/\/games$/);

  // Soft navigation must not request a new HTML document.
  expect(documents.length).toBe(initialDocuments);
  expect(issues, report(issues)).toEqual([]);
});

test("signed-in admin pages and flows load without runtime errors", async ({ page }) => {
  const issues = watchRuntime(page);

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const route of ADMIN_ROUTES) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  // Drill into a user detail page.
  await page.goto("/admin/users");
  await page
    .getByRole("link", { name: /Demo User|Unnamed/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/users\//);
  await expect(page.getByTestId("user-detail-name")).toBeVisible();

  expect(issues, report(issues)).toEqual([]);
});

test("the health endpoint and API surface respond correctly", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);

  const unauthorizedCron = await request.get("/api/cron/rotate-words");
  expect(unauthorizedCron.status()).toBe(401);

  const missingResult = await request.post("/api/games/wordle/guess", {
    data: { resultId: "does-not-exist", guess: "crane" },
  });
  expect([400, 404]).toContain(missingResult.status());
});
