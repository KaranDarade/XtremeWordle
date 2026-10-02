import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthDivider, GoogleButton, OAuthError } from "@/components/auth/google-button";
import { GlassCard } from "@/components/ui/glass-card";
import { signupAction } from "@/lib/auth/actions";
import { isGoogleConfigured } from "@/lib/auth/google";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const googleEnabled = isGoogleConfigured();

  return (
    <section className="mx-auto flex w-full max-w-md flex-col px-4 pt-14 pb-4 sm:pt-20">
      <GlassCard className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Optional — but it keeps your stats, streaks and arena rank across devices.
        </p>

        {error ? (
          <div className="mt-5">
            <OAuthError code={error} />
          </div>
        ) : null}

        {googleEnabled ? (
          <div className="mt-6 space-y-4">
            <GoogleButton next={next} label="Sign up with Google" />
            <AuthDivider label="or sign up with email" />
          </div>
        ) : null}

        <div className={googleEnabled ? "" : "mt-6"}>
          <AuthForm mode="signup" action={signupAction} next={next} />
        </div>

        <p className="mt-5 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </GlassCard>
    </section>
  );
}
