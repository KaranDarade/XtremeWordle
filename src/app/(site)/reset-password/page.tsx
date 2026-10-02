import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SetPasswordForm } from "@/components/auth/password-reset-forms";
import { GlassCard } from "@/components/ui/glass-card";
import { RESET_TICKET_COOKIE } from "@/lib/auth/constants";
import { turnstileSiteKey } from "@/lib/captcha/turnstile";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(RESET_TICKET_COOKIE)?.value) redirect("/forgot-password");

  return (
    <section className="mx-auto flex w-full max-w-md flex-col px-4 pt-14 pb-4 sm:pt-20">
      <GlassCard className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted">
          Your code is verified — choose a new password to finish.
        </p>
        <div className="mt-6">
          <SetPasswordForm siteKey={turnstileSiteKey()} />
        </div>
      </GlassCard>
    </section>
  );
}
