import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractCronToken, isCronAuthorized } from "@/lib/cron/auth";

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL;
});

describe("isCronAuthorized", () => {
  it("accepts the correct secret", () => {
    expect(isCronAuthorized("test-cron-secret")).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(isCronAuthorized("nope")).toBe(false);
    expect(isCronAuthorized("test-cron-secre")).toBe(false);
  });

  it("rejects missing values", () => {
    expect(isCronAuthorized(null)).toBe(false);
    expect(isCronAuthorized("")).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized("test-cron-secret")).toBe(false);
  });
});

describe("extractCronToken", () => {
  it("reads a bearer token", () => {
    const request = new Request("http://localhost/api/cron/rotate-words", {
      headers: { authorization: "Bearer abc123" },
    });
    expect(extractCronToken(request)).toBe("abc123");
  });

  it("is case-insensitive for the scheme", () => {
    const request = new Request("http://localhost/api/cron/rotate-words", {
      headers: { authorization: "bearer abc123" },
    });
    expect(extractCronToken(request)).toBe("abc123");
  });

  it("falls back to a query parameter", () => {
    const request = new Request("http://localhost/api/cron/rotate-words?secret=xyz");
    expect(extractCronToken(request)).toBe("xyz");
  });

  it("returns null when nothing is supplied", () => {
    const request = new Request("http://localhost/api/cron/rotate-words");
    expect(extractCronToken(request)).toBeNull();
  });
});
