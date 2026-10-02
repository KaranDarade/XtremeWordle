import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  requestPasswordReset,
  resetPasswordWithTicket,
  verifyPasswordResetOtp,
} from "@/lib/auth/password-reset";
import { hashToken } from "@/lib/auth/tokens";
import { createPrismaClient } from "@/lib/prisma";
import { OUTBOX_PATH } from "@/lib/mail/mailer";

// Use the file provider so the "sent" code can be inspected.
process.env.MAIL_PROVIDER = "file";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const run = Date.now().toString(36);
const email = `reset-${run}@example.com`;
const originalPassword = "OldPassw0rd";
const newPassword = "BrandNew1";

let userId = "";

/** Reads the most recent code emailed to `address`. */
async function latestOtpFor(address: string): Promise<string> {
  const contents = await readFile(OUTBOX_PATH, "utf8").catch(() => "");
  const messages = contents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { to: string; text: string; at: string })
    .filter((message) => message.to === address);

  const latest = messages[messages.length - 1];
  if (!latest) throw new Error(`no mail found for ${address}`);

  const match = latest.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("no code found in mail body");
  return match[1];
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email,
      username: `reset-${run}`,
      name: "Reset Tester",
      passwordHash: await hashPassword(originalPassword),
    },
  });
  userId = user.id;
});

beforeEach(async () => {
  await prisma.passwordResetOtp.deleteMany({ where: { email } });
});

afterAll(async () => {
  await prisma.passwordResetOtp.deleteMany({ where: { email } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("requestPasswordReset", () => {
  it("emails a code and stores only its hash", async () => {
    await requestPasswordReset({ email, ip: "10.0.0.1" });

    const record = await prisma.passwordResetOtp.findFirstOrThrow({ where: { email } });
    const otp = await latestOtpFor(email);

    expect(record.otpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(record.otpHash).not.toBe(otp);
    expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(record.consumedAt).toBeNull();
  });

  it("does not reveal whether an account exists", async () => {
    const result = await requestPasswordReset({ email: `nobody-${run}@example.com` });
    expect(result.ok).toBe(true);
    expect(
      await prisma.passwordResetOtp.count({ where: { email: `nobody-${run}@example.com` } }),
    ).toBe(0);
  });

  it("rate limits repeated requests per email", async () => {
    for (let i = 0; i < 3; i += 1) {
      await requestPasswordReset({ email, ip: "10.0.0.2" });
    }

    const before = await prisma.passwordResetOtp.count({ where: { email } });
    await requestPasswordReset({ email, ip: "10.0.0.2" });
    const after = await prisma.passwordResetOtp.count({ where: { email } });

    // The fourth request within the hour is accepted silently but not stored.
    expect(before).toBe(3);
    expect(after).toBe(before);
  });
});

describe("verifyPasswordResetOtp", () => {
  it("rejects a wrong code without consuming the ticket", async () => {
    await requestPasswordReset({ email });
    const real = await latestOtpFor(email);
    const wrong = real === "000000" ? "111111" : "000000";

    const outcome = await verifyPasswordResetOtp({ email, otp: wrong });
    expect(outcome).toEqual({ ok: false, reason: "invalid" });

    const record = await prisma.passwordResetOtp.findFirstOrThrow({ where: { email } });
    expect(record.attempts).toBe(1);
    expect(record.consumedAt).toBeNull();
  });

  it("issues a ticket for the correct code and burns it", async () => {
    await requestPasswordReset({ email });
    const otp = await latestOtpFor(email);

    const outcome = await verifyPasswordResetOtp({ email, otp });
    expect(outcome.ok).toBe(true);

    const record = await prisma.passwordResetOtp.findFirstOrThrow({ where: { email } });
    expect(record.consumedAt).not.toBeNull();

    // The same code cannot be reused.
    expect(await verifyPasswordResetOtp({ email, otp })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("gives up after too many attempts", async () => {
    await requestPasswordReset({ email });
    await prisma.passwordResetOtp.updateMany({
      where: { email },
      data: { attempts: 5 },
    });

    const outcome = await verifyPasswordResetOtp({ email, otp: "123456" });
    expect(outcome).toEqual({ ok: false, reason: "too_many" });
  });
});

describe("resetPasswordWithTicket", () => {
  it("changes the password and revokes every session", async () => {
    await prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(`session-${run}`),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await requestPasswordReset({ email });
    const otp = await latestOtpFor(email);
    const verified = await verifyPasswordResetOtp({ email, otp });
    if (!verified.ok) throw new Error("expected the code to verify");

    const outcome = await resetPasswordWithTicket({
      ticket: verified.ticket,
      password: newPassword,
    });
    expect(outcome).toEqual({ ok: true, email });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword(newPassword, user.passwordHash!)).toBe(true);
    expect(await verifyPassword(originalPassword, user.passwordHash!)).toBe(false);
    expect(user.passwordUpdatedAt).not.toBeNull();

    const active = await prisma.session.count({ where: { userId, revokedAt: null } });
    expect(active).toBe(0);

    await prisma.session.deleteMany({ where: { userId } });
  });

  it("rejects an invalid or tampered ticket", async () => {
    expect(await resetPasswordWithTicket({ ticket: "nonsense", password: newPassword })).toEqual({
      ok: false,
      reason: "invalid_ticket",
    });
  });
});
