import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { GoogleConfig, GoogleProfile } from "@/lib/auth/google";
import { resolveGoogleAccount } from "@/lib/auth/google-account";
import { completeGoogleSignIn } from "@/lib/auth/google-signin";
import { createPrismaClient } from "@/lib/prisma";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const run = Date.now().toString(36);

const CONFIG: GoogleConfig = {
  clientId: "test-client",
  clientSecret: "test-secret",
  redirectUri: "http://localhost:3000/api/auth/google/callback",
};

function profile(overrides: Partial<GoogleProfile> = {}): GoogleProfile {
  return {
    googleId: `google-${run}`,
    email: `google-${run}@example.com`,
    emailVerified: true,
    name: "Google Player",
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

describe("resolveGoogleAccount", () => {
  it("creates a passwordless account for a new Google user", async () => {
    const result = await resolveGoogleAccount(profile());

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.created).toBe(true);
    expect(result.linked).toBe(false);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.googleId).toBe(`google-${run}`);
    expect(user.passwordHash).toBeNull();
    expect(user.username).toBeTruthy();
    expect(user.name).toBe("Google Player");
    expect(user.league).toBe("BRONZE");
  });

  it("signs the same Google id back in without duplicating", async () => {
    const first = await resolveGoogleAccount(profile());
    const second = await resolveGoogleAccount(profile());

    expect(second.status).toBe("ok");
    if (first.status !== "ok" || second.status !== "ok") return;
    expect(second.userId).toBe(first.userId);
    expect(second.created).toBe(false);
  });

  it("links an existing email account and keeps its password", async () => {
    const existing = await prisma.user.create({
      data: {
        email: `linked-${run}@example.com`,
        username: `linked-${run}`,
        passwordHash: "existing-hash",
        name: "Existing",
      },
    });

    const result = await resolveGoogleAccount(
      profile({ email: `linked-${run}@example.com`, googleId: `google-linked-${run}` }),
    );

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.linked).toBe(true);
    expect(result.userId).toBe(existing.id);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(updated.googleId).toBe(`google-linked-${run}`);
    expect(updated.passwordHash).toBe("existing-hash");
  });

  it("refuses an unverified Google email", async () => {
    const result = await resolveGoogleAccount(profile({ emailVerified: false }));
    expect(result).toEqual({ status: "error", reason: "unverified_email" });
  });

  it("refuses a banned account", async () => {
    await prisma.user.create({
      data: {
        email: `banned-${run}@example.com`,
        username: `banned-${run}`,
        passwordHash: "x",
        isBanned: true,
      },
    });

    const result = await resolveGoogleAccount(profile({ email: `banned-${run}@example.com` }));
    expect(result).toEqual({ status: "error", reason: "banned" });
  });
});

describe("completeGoogleSignIn", () => {
  const tokenExchanger = async () => "access-token";

  it("requires configuration", async () => {
    const result = await completeGoogleSignIn({
      code: "c",
      state: "s",
      denied: null,
      savedState: "s",
      verifier: "v",
      config: null,
    });
    expect(result).toEqual({ ok: false, reason: "google_unavailable" });
  });

  it("reports a cancelled consent screen", async () => {
    const result = await completeGoogleSignIn({
      code: null,
      state: "s",
      denied: "access_denied",
      savedState: "s",
      verifier: "v",
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: "google_denied" });
  });

  it("rejects a mismatched state (CSRF)", async () => {
    const result = await completeGoogleSignIn({
      code: "c",
      state: "attacker",
      denied: null,
      savedState: "legit",
      verifier: "v",
      config: CONFIG,
      tokenExchanger,
    });
    expect(result).toEqual({ ok: false, reason: "google_state" });
  });

  it("fails when the token exchange fails", async () => {
    const result = await completeGoogleSignIn({
      code: "c",
      state: "s",
      denied: null,
      savedState: "s",
      verifier: "v",
      config: CONFIG,
      tokenExchanger: async () => null,
    });
    expect(result).toEqual({ ok: false, reason: "google_token" });
  });

  it("signs in successfully end to end", async () => {
    const result = await completeGoogleSignIn({
      code: "c",
      state: "s",
      denied: null,
      savedState: "s",
      verifier: "v",
      config: CONFIG,
      tokenExchanger,
      profileLoader: async () => profile(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.googleId).toBe(`google-${run}`);
  });
});
