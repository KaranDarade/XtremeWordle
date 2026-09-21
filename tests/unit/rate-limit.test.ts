import { describe, expect, it } from "vitest";

import { rateLimit, resetRateLimits } from "@/lib/http/rate-limit";

describe("rateLimit", () => {
  it("allows calls up to the limit", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("k1", 3, 1000).allowed).toBe(true);
    }
  });

  it("blocks calls beyond the limit", () => {
    resetRateLimits();
    rateLimit("k2", 2, 1000);
    rateLimit("k2", 2, 1000);
    const blocked = rateLimit("k2", 2, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks keys independently", () => {
    resetRateLimits();
    rateLimit("a", 1, 1000);
    expect(rateLimit("a", 1, 1000).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000).allowed).toBe(true);
  });

  it("resets once the window elapses", async () => {
    resetRateLimits();
    rateLimit("k3", 1, 20);
    expect(rateLimit("k3", 1, 20).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rateLimit("k3", 1, 20).allowed).toBe(true);
  });

  it("reports remaining allowance", () => {
    resetRateLimits();
    expect(rateLimit("k4", 5, 1000).remaining).toBe(4);
    expect(rateLimit("k4", 5, 1000).remaining).toBe(3);
  });
});
