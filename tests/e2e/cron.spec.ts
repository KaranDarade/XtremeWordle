import "dotenv/config";

import { expect, test } from "@playwright/test";

test.describe("cron rotation endpoint", () => {
  test("rejects requests with no secret", async ({ request }) => {
    const response = await request.get("/api/cron/rotate-words");
    expect(response.status()).toBe(401);
  });

  test("rejects requests with a wrong secret", async ({ request }) => {
    const response = await request.get("/api/cron/rotate-words?secret=definitely-wrong");
    expect(response.status()).toBe(401);
  });

  test("rotates every active game when authorised", async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    expect(secret, "CRON_SECRET must be set for this test").toBeTruthy();

    const response = await request.post("/api/cron/rotate-words", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as {
      ok: boolean;
      results: { slug: string; word: string | null; poolBucket: string | null }[];
    };

    expect(body.ok).toBe(true);
    expect(body.results.length).toBeGreaterThanOrEqual(3);

    const wordle = body.results.find((entry) => entry.slug === "wordle");
    expect(wordle?.word).toBeTruthy();
    expect(wordle?.poolBucket).toBeTruthy();

    const bee = body.results.find((entry) => entry.slug === "spelling-bee");
    expect(bee?.word).toBeTruthy();
  });

  test("is idempotent across repeated runs", async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    const headers = { authorization: `Bearer ${secret}` };

    const first = await request.post("/api/cron/rotate-words", { headers });
    const second = await request.post("/api/cron/rotate-words", { headers });

    const firstBody = (await first.json()) as { results: { slug: string; word: string | null }[] };
    const secondBody = (await second.json()) as {
      results: { slug: string; word: string | null }[];
    };

    for (const entry of firstBody.results) {
      const match = secondBody.results.find((candidate) => candidate.slug === entry.slug);
      expect(match?.word).toBe(entry.word);
    }
  });
});
