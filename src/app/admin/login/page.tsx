import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { GlassCard } from "@/components/ui/glass-card";
import { adminLoginAction } from "@/lib/admin/actions";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/admin";
  const showUnauthorized = params.error === "unauthorized";

  return (
    <section className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
      <GlassCard className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin sign in</h1>
            <p className="text-xs text-muted">Restricted area — staff only.</p>
          </div>
        </div>

        {showUnauthorized ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-medium text-warning"
          >
            Please sign in to access the dashboard.
          </p>
        ) : null}

        <div className="mt-6">
          <AuthForm mode="login" action={adminLoginAction} next={next} />
        </div>
      </GlassCard>
    </section>
  );
}
