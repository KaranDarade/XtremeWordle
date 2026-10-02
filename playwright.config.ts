import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // E2E mutates shared database state (games, words, users), so run serially
  // to keep tests deterministic.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Run E2E against a production build: no on-demand compilation, stable
    // timings, and it also validates `next build` on every phase.
    command: "npm run build && npm run start",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      // Write reset codes to .mail-outbox.log so tests can complete the flow.
      MAIL_PROVIDER: "file",
      // All E2E traffic comes from 127.0.0.1, so the per-IP throttle that
      // protects production would otherwise block the reset tests.
      RESET_REQUESTS_PER_IP_PER_HOUR: "1000",
      // The suite signs in as the same admin many times from one IP.
      AUTH_RATE_LIMIT: "1000",
      // Force the captcha bypass so the reset flow stays offline/deterministic
      // even when real Turnstile keys are configured in `.env`.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
      // Keep the "Google sign-in is hidden when unconfigured" assertions
      // deterministic even when real OAuth credentials live in `.env`.
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REDIRECT_URI: "",
      // Short arena rounds so a full duel finishes inside a test.
      ARENA_ROUND_MS: "4000",
      ARENA_BREAK_MS: "800",
      ARENA_COUNTDOWN_MS: "500",
      ARENA_ROUND_COUNT: "4",
    },
  },
});
