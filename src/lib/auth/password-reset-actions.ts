"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyTurnstile } from "@/lib/captcha/turnstile";
import { clientIpFromHeaders } from "@/lib/http/rate-limit";

import { RESET_TICKET_COOKIE, RESET_TICKET_TTL_SECONDS } from "./constants";
import {
  requestPasswordReset,
  resetPasswordWithTicket,
  verifyPasswordResetOtp,
} from "./password-reset";
import { authThrottle } from "./throttle";
import {
  flattenFieldErrors,
  otpSchema,
  resetPasswordSchema,
  signupSchema,
  type AuthFormState,
} from "./validation";

const captchaToken = (formData: FormData): string =>
  String(formData.get("captchaToken") ?? "").trim();

async function captchaOk(formData: FormData): Promise<boolean> {
  const ip = await clientIpFromHeaders();
  const result = await verifyTurnstile(captchaToken(formData), ip);
  return result.ok;
}

/** Step 1 — request a code for the given email. */
export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = signupSchema.pick({ email: true }).safeParse({ email: rawEmail });
  const values = { email: rawEmail };

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted field.",
      errors: flattenFieldErrors(parsed.error),
      values,
    };
  }

  if (!(await captchaOk(formData))) {
    return { status: "error", message: "Captcha check failed. Please try again.", values };
  }

  const throttle = await authThrottle("reset-request", parsed.data.email);
  if (!throttle.allowed) {
    return {
      status: "error",
      message: `Too many requests. Try again in ${throttle.retryAfterMinutes} minute(s).`,
      values,
    };
  }

  const ip = await clientIpFromHeaders();
  await requestPasswordReset({ email: parsed.data.email, ip });

  redirect(`/forgot-password/verify?email=${encodeURIComponent(parsed.data.email)}`);
}

/** Step 2 — check the code and issue a reset ticket. */
export async function verifyResetOtpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = otpSchema.safeParse({ otp: formData.get("otp") });

  if (!email) return { status: "error", message: "Missing email address." };

  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the 6-digit code we emailed you.",
      errors: flattenFieldErrors(parsed.error),
    };
  }

  const throttle = await authThrottle("reset-verify", `${email}:${parsed.data.otp}`);
  if (!throttle.allowed) {
    return {
      status: "error",
      message: `Too many attempts. Try again in ${throttle.retryAfterMinutes} minute(s).`,
    };
  }

  const outcome = await verifyPasswordResetOtp({ email, otp: parsed.data.otp });
  if (!outcome.ok) {
    return {
      status: "error",
      message:
        outcome.reason === "too_many"
          ? "Too many incorrect attempts. Request a new code."
          : "That code is incorrect or has expired.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(RESET_TICKET_COOKIE, outcome.ticket, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RESET_TICKET_TTL_SECONDS,
  });

  redirect("/reset-password");
}

/** Step 3 — set the new password (captcha protected) and revoke all sessions. */
export async function resetPasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenFieldErrors(parsed.error),
    };
  }

  if (!(await captchaOk(formData))) {
    return { status: "error", message: "Captcha check failed. Please try again." };
  }

  const cookieStore = await cookies();
  const ticket = cookieStore.get(RESET_TICKET_COOKIE)?.value;
  if (!ticket) {
    return {
      status: "error",
      message: "Your reset link has expired. Start again from the forgot password page.",
    };
  }

  const outcome = await resetPasswordWithTicket({ ticket, password: parsed.data.password });
  cookieStore.delete(RESET_TICKET_COOKIE);

  if (!outcome.ok) {
    return {
      status: "error",
      message: "That reset link is no longer valid. Request a new code.",
    };
  }

  redirect("/login?reset=1");
}

/** Resend helper used by the verify screen. */
export async function resendResetCodeAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) redirect("/forgot-password");

  const ip = await clientIpFromHeaders();
  await requestPasswordReset({ email, ip });
  redirect(`/forgot-password/verify?email=${encodeURIComponent(email)}&resent=1`);
}
