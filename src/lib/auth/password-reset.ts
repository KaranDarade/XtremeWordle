import { prisma } from "@/lib/db";
import { getMailer } from "@/lib/mail/mailer";

import { hashPassword } from "./password";
import {
  generateOtp,
  hashOtp,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  otpMatches,
  signResetTicket,
  verifyResetTicket,
} from "./otp";
import { revokeAllSessions } from "./session";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Per-address cap: keeps a single mailbox from being spammed. */
export const RESET_REQUESTS_PER_EMAIL_PER_HOUR = positiveInt(
  process.env.RESET_REQUESTS_PER_EMAIL_PER_HOUR,
  3,
);

/**
 * Per-IP cap. Deliberately generous: offices, schools and mobile carriers share
 * addresses, so a tight limit locks out legitimate users.
 */
export const RESET_REQUESTS_PER_IP_PER_HOUR = positiveInt(
  process.env.RESET_REQUESTS_PER_IP_PER_HOUR,
  30,
);

const HOUR_MS = 60 * 60 * 1000;

export type RequestResetResult = { ok: true };

/**
 * Starts a password reset.
 *
 * Always reports success so the endpoint cannot be used to discover which
 * addresses have accounts; the OTP is only generated and sent when the account
 * exists and the rate limits allow it.
 */
export async function requestPasswordReset(input: {
  email: string;
  ip?: string | null;
}): Promise<RequestResetResult> {
  const email = input.email.trim().toLowerCase();
  const since = new Date(Date.now() - HOUR_MS);

  const [byEmail, byIp] = await Promise.all([
    prisma.passwordResetOtp.count({ where: { email, createdAt: { gte: since } } }),
    input.ip
      ? prisma.passwordResetOtp.count({ where: { requestIp: input.ip, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ]);

  if (byEmail >= RESET_REQUESTS_PER_EMAIL_PER_HOUR) return { ok: true };
  if (byIp >= RESET_REQUESTS_PER_IP_PER_HOUR) return { ok: true };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return { ok: true };

  // Invalidate any outstanding codes for this address.
  await prisma.passwordResetOtp.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const otp = generateOtp();
  await prisma.passwordResetOtp.create({
    data: {
      email,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      requestIp: input.ip ?? null,
    },
  });

  const code = otp;
  await getMailer().send({
    to: email,
    subject: `${code} is your Wordle Arena reset code`,
    text: [
      `Hi${user.name ? ` ${user.name}` : ""},`,
      "",
      `Your Wordle Arena password reset code is: ${code}`,
      "",
      "It expires in 10 minutes. If you did not request this, you can ignore this email.",
    ].join("\n"),
  });

  return { ok: true };
}

export type VerifyOtpResult =
  { ok: true; ticket: string } | { ok: false; reason: "invalid" | "too_many" };

/** Checks an OTP and, on success, issues a short-lived reset ticket. */
export async function verifyPasswordResetOtp(input: {
  email: string;
  otp: string;
}): Promise<VerifyOtpResult> {
  const email = input.email.trim().toLowerCase();

  const record = await prisma.passwordResetOtp.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  await prisma.passwordResetOtp.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  });

  if (!otpMatches(input.otp.trim(), record.otpHash)) return { ok: false, reason: "invalid" };

  await prisma.passwordResetOtp.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true, ticket: signResetTicket({ email, otpId: record.id }) };
}

export type ResetPasswordResult =
  { ok: true; email: string } | { ok: false; reason: "invalid_ticket" | "no_account" };

/**
 * Completes the reset: updates the password hash and revokes every existing
 * session so a compromised account is signed out everywhere.
 */
export async function resetPasswordWithTicket(input: {
  ticket: string;
  password: string;
}): Promise<ResetPasswordResult> {
  const payload = verifyResetTicket(input.ticket);
  if (!payload) return { ok: false, reason: "invalid_ticket" };

  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });
  if (!user) return { ok: false, reason: "no_account" };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      passwordUpdatedAt: new Date(),
    },
  });

  await revokeAllSessions(user.id);
  await prisma.passwordResetOtp.updateMany({
    where: { email: payload.email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  return { ok: true, email: payload.email };
}
