import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AvatarBuilder } from "@/components/avatar/avatar-builder";
import { GlassCard } from "@/components/ui/glass-card";
import { normalizeAvatar } from "@/lib/avatar/config";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Customise avatar", robots: { index: false } };

export default async function AvatarSettingsPage() {
  const user = await requireUser();

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarConfig: true },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-10">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to profile
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your avatar</h1>
        <p className="mt-1 text-sm text-muted">
          Design the face opponents see in matches, on the leaderboard and on your profile.
        </p>
      </header>

      <GlassCard className="mt-6 p-5 sm:p-6">
        <AvatarBuilder initial={normalizeAvatar(record?.avatarConfig)} />
      </GlassCard>
    </div>
  );
}
