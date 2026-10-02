import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createOAuthState,
  createPkcePair,
  fetchGoogleProfile,
  googleAuthUrl,
  googleConfig,
  isGoogleConfigured,
  GOOGLE_AUTH_ENDPOINT,
} from "@/lib/auth/google";
import { safePath } from "@/lib/http/safe-path";

const ORIGINAL = {
  id: process.env.GOOGLE_CLIENT_ID,
  secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect: process.env.GOOGLE_REDIRECT_URI,
  site: process.env.NEXT_PUBLIC_SITE_URL,
};

beforeEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REDIRECT_URI;
  process.env.NEXT_PUBLIC_SITE_URL = "https://wordle-arena.test";
});

afterEach(() => {
  process.env.GOOGLE_CLIENT_ID = ORIGINAL.id;
  process.env.GOOGLE_CLIENT_SECRET = ORIGINAL.secret;
  process.env.GOOGLE_REDIRECT_URI = ORIGINAL.redirect;
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.site;
});

describe("createPkcePair", () => {
  it("derives the S256 challenge from the verifier", () => {
    const { verifier, challenge } = createPkcePair();
    const expected = createHash("sha256").update(verifier).digest("base64url");

    expect(challenge).toBe(expected);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a fresh pair each call", () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
    expect(createOAuthState()).not.toBe(createOAuthState());
  });
});

describe("googleAuthUrl", () => {
  it("requests an authorization code with PKCE", () => {
    const url = new URL(
      googleAuthUrl({
        state: "state-123",
        codeChallenge: "challenge-abc",
        clientId: "client-id",
        redirectUri: "https://wordle-arena.test/api/auth/google/callback",
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe(GOOGLE_AUTH_ENDPOINT);
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("scope")).toContain("email");
  });
});

describe("googleConfig", () => {
  it("is null until both credentials are present", () => {
    expect(googleConfig()).toBeNull();
    expect(isGoogleConfigured()).toBe(false);

    process.env.GOOGLE_CLIENT_ID = "id";
    expect(googleConfig()).toBeNull();

    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(isGoogleConfigured()).toBe(true);
  });

  it("derives the redirect uri from the site url", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";

    expect(googleConfig()?.redirectUri).toBe("https://wordle-arena.test/api/auth/google/callback");
  });

  it("prefers an explicit redirect uri", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URI = "https://custom.test/cb";

    expect(googleConfig()?.redirectUri).toBe("https://custom.test/cb");
  });
});

describe("fetchGoogleProfile", () => {
  it("normalises a verified profile", async () => {
    const stub = (async () =>
      new Response(
        JSON.stringify({
          sub: "google-123",
          email: "Player@Example.com ",
          email_verified: true,
          name: "Player One",
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    await expect(fetchGoogleProfile("token", stub)).resolves.toEqual({
      googleId: "google-123",
      email: "player@example.com",
      emailVerified: true,
      name: "Player One",
    });
  });

  it("returns null for a failed response or missing fields", async () => {
    const failing = (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    await expect(fetchGoogleProfile("token", failing)).resolves.toBeNull();

    const incomplete = (async () =>
      new Response(JSON.stringify({ sub: "x" }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchGoogleProfile("token", incomplete)).resolves.toBeNull();
  });
});

describe("safePath", () => {
  it("allows same-origin absolute paths", () => {
    expect(safePath("/arena")).toBe("/arena");
    expect(safePath("/u/karan")).toBe("/u/karan");
  });

  it("rejects open-redirect payloads", () => {
    expect(safePath("//evil.com")).toBe("/");
    expect(safePath("https://evil.com")).toBe("/");
    expect(safePath("/\\evil.com")).toBe("/");
    expect(safePath("arena")).toBe("/");
    expect(safePath(null)).toBe("/");
    expect(safePath(undefined, "/games")).toBe("/games");
  });
});
