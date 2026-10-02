import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  generateOtp,
  hashOtp,
  otpMatches,
  signResetTicket,
  verifyResetTicket,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from "@/lib/auth/otp";
import {
  isTurnstileConfigured,
  turnstileSiteKey,
  verifyTurnstile,
  TURNSTILE_VERIFY_ENDPOINT,
} from "@/lib/captcha/turnstile";
import { getMailer, mailProviderName } from "@/lib/mail/mailer";

const ENV = {
  provider: process.env.MAIL_PROVIDER,
  siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  secret: process.env.TURNSTILE_SECRET_KEY,
};

afterEach(() => {
  process.env.MAIL_PROVIDER = ENV.provider;
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = ENV.siteKey;
  process.env.TURNSTILE_SECRET_KEY = ENV.secret;
});

describe("OTP codes", () => {
  it("generates a zero-padded six digit code", () => {
    for (let i = 0; i < 40; i += 1) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it("hashes codes and compares them in constant time", () => {
    const otp = generateOtp();
    const hash = hashOtp(otp);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(otp);
    expect(otpMatches(otp, hash)).toBe(true);
    expect(otpMatches("000000", hash)).toBe(false);
  });

  it("never stores the same digest for different codes", () => {
    expect(hashOtp("123456")).not.toBe(hashOtp("654321"));
  });

  it("uses a 10 minute lifetime and 5 attempts", () => {
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });
});

describe("reset tickets", () => {
  const payload = { email: "player@example.com", otpId: "otp-1" };

  it("round-trips a signed ticket", () => {
    const ticket = signResetTicket(payload);
    const verified = verifyResetTicket(ticket);

    expect(verified?.email).toBe(payload.email);
    expect(verified?.otpId).toBe(payload.otpId);
  });

  it("rejects a tampered ticket", () => {
    const ticket = signResetTicket(payload);
    const [body, signature] = ticket.split(".");

    expect(verifyResetTicket(`${body}.${signature.slice(0, -2)}xx`)).toBeNull();
    expect(verifyResetTicket(`x${body}.${signature}`)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyResetTicket(null)).toBeNull();
    expect(verifyResetTicket("")).toBeNull();
    expect(verifyResetTicket("no-signature")).toBeNull();
    expect(verifyResetTicket("a.b.c")).toBeNull();
  });

  it("rejects an expired ticket", () => {
    const expired = signResetTicket(payload, -1000);
    expect(verifyResetTicket(expired)).toBeNull();
  });
});

describe("mailer selection", () => {
  beforeEach(() => {
    delete process.env.MAIL_PROVIDER;
  });

  it("defaults to the console provider", () => {
    expect(mailProviderName()).toBe("console");
    expect(getMailer().name).toBe("console");
  });

  it("honours MAIL_PROVIDER", () => {
    process.env.MAIL_PROVIDER = "file";
    expect(mailProviderName()).toBe("file");
    expect(getMailer().name).toBe("file");

    process.env.MAIL_PROVIDER = "resend";
    expect(getMailer().name).toBe("resend");
  });

  it("falls back to console for unknown values", () => {
    process.env.MAIL_PROVIDER = "carrier-pigeon";
    expect(getMailer().name).toBe("console");
  });
});

describe("turnstile", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("is disabled until both keys exist", () => {
    expect(isTurnstileConfigured()).toBe(false);
    expect(turnstileSiteKey()).toBeNull();

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site";
    expect(isTurnstileConfigured()).toBe(false);

    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(isTurnstileConfigured()).toBe(true);
    expect(turnstileSiteKey()).toBe("site");
  });

  it("skips verification when unconfigured", async () => {
    await expect(verifyTurnstile("anything")).resolves.toEqual({ ok: true, skipped: true });
  });

  it("rejects a missing token when configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    await expect(verifyTurnstile(null)).resolves.toEqual({ ok: false, skipped: false });
  });

  it("posts the token and trusts the success flag", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";

    let seenBody = "";
    const stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(TURNSTILE_VERIFY_ENDPOINT);
      seenBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(verifyTurnstile("token-123", "1.2.3.4", stub)).resolves.toEqual({
      ok: true,
      skipped: false,
    });
    expect(seenBody).toContain("response=token-123");
    expect(seenBody).toContain("remoteip=1.2.3.4");
  });

  it("fails when the provider reports failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const stub = (async () =>
      new Response(JSON.stringify({ success: false }), { status: 200 })) as unknown as typeof fetch;

    await expect(verifyTurnstile("bad", null, stub)).resolves.toEqual({
      ok: false,
      skipped: false,
    });
  });
});
