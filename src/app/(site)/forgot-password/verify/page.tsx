import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerifyOtpForm } from "@/components/auth/password-reset-forms";
import { GlassCard } from "@/components/ui/glass-card";
import { turnstileSiteKey } from "@/lib/captcha/turnstile";

export const metadata: Metadata = { title: "Enter your code" };

export default async function VerifyResetCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; resent?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";

  if (!email) redirect("/forgot-password");

  return (
    <section className="mx-auto flex w-full max-w-md flex-col px-4 pt-14 pb-4 sm:pt-20">
      <GlassCard className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <div className="mt-6">
          <VerifyOtpForm
            email={email}
            resent={params.resent === "1"}
            siteKey={turnstileSiteKey()}
          />
        </div>
      </GlassCard>
    </section>
  );
}
