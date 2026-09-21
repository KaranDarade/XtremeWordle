import { beforeEach, describe, expect, it } from "vitest";

import { guardRequest } from "@/lib/http/guard";
import { resetRateLimits } from "@/lib/http/rate-limit";

/**
 * Builds a minimal Request-like object. We avoid `new Request()` because the
 * `Host` header is forbidden in the fetch spec and would be stripped.
 */
function makeRequest(init: { origin?: string; host?: string; ip?: string } = {}): Request {
  const headers = new Map<string, string>();
  if (init.origin) headers.set("origin", init.origin);
  if (init.host) headers.set("host", init.host);
  if (init.ip) headers.set("x-forwarded-for", init.ip);

  return {
    headers: { get: (key: string) => headers.get(key.toLowerCase()) ?? null },
  } as unknown as Request;
}

describe("guardRequest", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows a same-origin request", () => {
    const blocked = guardRequest(
      makeRequest({ origin: "http://localhost:3000", host: "localhost:3000" }),
      "test",
      5,
    );
    expect(blocked).toBeNull();
  });

  it("allows non-browser clients that send no origin", () => {
    expect(guardRequest(makeRequest(), "test", 5)).toBeNull();
  });

  it("rejects a cross-origin request with 403", async () => {
    const response = guardRequest(
      makeRequest({ origin: "https://evil.example", host: "localhost:3000" }),
      "test",
      5,
    );
    expect(response?.status).toBe(403);
    expect((await response?.json()).error).toContain("Invalid origin");
  });

  it("rejects a malformed origin", () => {
    const response = guardRequest(
      makeRequest({ origin: "not-a-url", host: "localhost:3000" }),
      "test",
      5,
    );
    expect(response?.status).toBe(403);
  });

  it("returns 429 with a retry-after header once the limit is exceeded", async () => {
    for (let index = 0; index < 3; index += 1) {
      expect(guardRequest(makeRequest({ ip: "1.2.3.4" }), "scope", 3)).toBeNull();
    }

    const blocked = guardRequest(makeRequest({ ip: "1.2.3.4" }), "scope", 3);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("retry-after")).toBeTruthy();
    expect((await blocked?.json()).error).toContain("Too many requests");
  });

  it("tracks limits independently per IP", () => {
    for (let index = 0; index < 3; index += 1) {
      guardRequest(makeRequest({ ip: "5.5.5.5" }), "scope2", 3);
    }
    expect(guardRequest(makeRequest({ ip: "5.5.5.5" }), "scope2", 3)?.status).toBe(429);
    expect(guardRequest(makeRequest({ ip: "6.6.6.6" }), "scope2", 3)).toBeNull();
  });

  it("tracks limits independently per scope", () => {
    for (let index = 0; index < 2; index += 1) {
      guardRequest(makeRequest({ ip: "9.9.9.9" }), "scopeA", 2);
    }
    expect(guardRequest(makeRequest({ ip: "9.9.9.9" }), "scopeA", 2)?.status).toBe(429);
    expect(guardRequest(makeRequest({ ip: "9.9.9.9" }), "scopeB", 2)).toBeNull();
  });
});
