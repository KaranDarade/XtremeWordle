import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { requiredSecret } from "@/lib/env";

/** Numeric OTP lifetime and how many guesses a single code allows. */
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Signed reset ticket lifetime, issued after a correct OTP. */
export const TICKET_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  return requiredSecret("SESSION_SECRET", "wordle-arena-dev-secret");
}

/** Six digits, zero padded, uniformly random. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** OTPs are stored keyed-hashed, never in plain text. */
export function hashOtp(otp: string): string {
  return createHmac("sha256", secret()).update(`otp:${otp}`).digest("hex");
}

export function otpMatches(otp: string, hash: string): boolean {
  const provided = Buffer.from(hashOtp(otp), "hex");
  const expected = Buffer.from(hash, "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export interface ResetTicketPayload {
  email: string;
  otpId: string;
  exp: number;
}

/** Stateless HMAC-signed ticket so the final step needs no session. */
export function signResetTicket(
  payload: { email: string; otpId: string },
  ttlMs = TICKET_TTL_MS,
): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyResetTicket(ticket: string | null | undefined): ResetTicketPayload | null {
  if (!ticket) return null;

  const [body, signature] = ticket.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as ResetTicketPayload;
    if (
      typeof payload.email !== "string" ||
      typeof payload.otpId !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
