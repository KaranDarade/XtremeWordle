import type { Metadata } from "next";

import { RequestResetForm } from "@/components/auth/password-reset-forms";
import { GlassCard } from "@/components/ui/glass-card";
import { turnstileSiteKey } from "@/lib/captcha/turnstile";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col px-4 pt-14 pb-4 sm:pt-20">
      <GlassCard className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your registered email and we&apos;ll send you a 6-digit code.
        </p>

        <div className="mt-6">
          <RequestResetForm siteKey={turnstileSiteKey()} />
        </div>
      </GlassCard>
    </section>
  );
}
