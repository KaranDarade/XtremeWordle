"use client";

import Link from "next/link";
import { useActionState } from "react";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Field, Notice, SubmitButton, TextInput } from "@/components/ui/form";
import {
  requestPasswordResetAction,
  resendResetCodeAction,
  resetPasswordAction,
  verifyResetOtpAction,
} from "@/lib/auth/password-reset-actions";
import type { AuthFormState } from "@/lib/auth/validation";

const IDLE: AuthFormState = { status: "idle" };

const OTP_HINT = "Enter the 6-digit code we sent to your email. It expires in 10 minutes.";

export function RequestResetForm({ siteKey }: { siteKey: string | null }) {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, IDLE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="Email"
        htmlFor="reset-email"
        error={state.errors?.email?.[0]}
        hint="We'll email you a 6-digit code if an account exists."
      >
        <TextInput
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          required
        />
      </Field>

      {siteKey ? <TurnstileWidget siteKey={siteKey} /> : null}

      {state.status === "error" && state.message ? (
        <p role="alert" data-testid="reset-error" className="text-sm font-medium text-danger">
          {state.message}
        </p>
      ) : null}

      <SubmitButton pending={pending} data-testid="reset-request-submit">
        {pending ? "Sending…" : "Send reset code"}
      </SubmitButton>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function VerifyOtpForm({
  email,
  resent,
  siteKey,
}: {
  email: string;
  resent?: boolean;
  siteKey: string | null;
}) {
  const [state, formAction, pending] = useActionState(verifyResetOtpAction, IDLE);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="email" value={email} />

        <p className="text-sm text-muted">
          We sent a code to <span className="font-medium text-foreground">{email}</span>.
        </p>

        {resent ? (
          <p data-testid="reset-resent" className="text-sm font-medium text-success">
            A new code is on its way.
          </p>
        ) : null}

        <Field label="6-digit code" htmlFor="otp" error={state.errors?.otp?.[0]} hint={OTP_HINT}>
          <TextInput
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="text-center text-lg tracking-[0.4em]"
            required
          />
        </Field>

        {siteKey ? <TurnstileWidget siteKey={siteKey} /> : null}

        {state.status === "error" && state.message ? (
          <p role="alert" data-testid="reset-error" className="text-sm font-medium text-danger">
            {state.message}
          </p>
        ) : null}

        <SubmitButton pending={pending} data-testid="reset-verify-submit">
          {pending ? "Checking…" : "Verify code"}
        </SubmitButton>
      </form>

      <form action={resendResetCodeAction} className="text-center">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          data-testid="reset-resend"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Resend code
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
          Use a different email
        </Link>
      </p>
    </div>
  );
}

export function SetPasswordForm({ siteKey }: { siteKey: string | null }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, IDLE);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="New password"
        htmlFor="new-password"
        error={state.errors?.password?.[0]}
        hint="At least 8 characters, including a letter and a number."
      >
        <TextInput
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label="Confirm password" htmlFor="confirm-password" error={state.errors?.confirm?.[0]}>
        <TextInput
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      {siteKey ? <TurnstileWidget siteKey={siteKey} /> : null}

      <Notice status={state.status} message={state.message} />

      <SubmitButton pending={pending} data-testid="reset-password-submit">
        {pending ? "Updating…" : "Set new password"}
      </SubmitButton>

      <p className="text-center text-xs text-muted">
        All other devices will be signed out once your password changes.
      </p>
    </form>
  );
}
