import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthDivider, GoogleButton, OAuthError } from "@/components/auth/google-button";
import { GlassCard } from "@/components/ui/glass-card";
import { loginAction } from "@/lib/auth/actions";
import { isGoogleConfigured } from "@/lib/auth/google";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const justReset = params.reset === "1";
  const googleEnabled = isGoogleConfigured();

  return (
    <section className="mx-auto flex w-full max-w-md flex-col px-4 pt-14 pb-4 sm:pt-20">
      <GlassCard className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to save your streaks, stats and arena rank. You can always play as a guest.
        </p>

        {justReset ? (
          <p
            role="status"
            data-testid="reset-success"
            className="mt-5 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success"
          >
            Password updated. Sign in with your new password.
          </p>
        ) : null}

        {error ? (
          <div className="mt-5">
            <OAuthError code={error} />
          </div>
        ) : null}

        {googleEnabled ? (
          <div className="mt-6 space-y-4">
            <GoogleButton next={next} />
            <AuthDivider label="or sign in with email" />
          </div>
        ) : null}

        <div className={googleEnabled ? "" : "mt-6"}>
          <AuthForm mode="login" action={loginAction} next={next} />
        </div>

        <p className="mt-4 text-center text-sm">
          <Link
            href="/forgot-password"
            data-testid="forgot-password-link"
            className="font-medium text-muted hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </GlassCard>
    </section>
  );
}
