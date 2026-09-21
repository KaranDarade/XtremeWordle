"use client";

import { useActionState } from "react";

import { Field, SubmitButton, TextInput } from "@/components/ui/form";
import type { AuthFormState } from "@/lib/auth/validation";

type AuthAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: "login" | "signup";
  action: AuthAction;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {
    status: "idle",
  });

  const errors = state.errors ?? {};
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {isSignup ? (
        <Field label="Name" htmlFor="name" error={errors.name?.[0]}>
          <TextInput
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={state.values?.name}
            required
          />
        </Field>
      ) : null}

      <Field label="Email" htmlFor="email" error={errors.email?.[0]}>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.[0]}
        hint={isSignup ? "At least 8 characters, including a letter and a number." : undefined}
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
        />
      </Field>

      {state.status === "error" && state.message ? (
        <p
          role="alert"
          data-testid="auth-error"
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton pending={pending} data-testid="auth-submit">
        {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
      </SubmitButton>
    </form>
  );
}
