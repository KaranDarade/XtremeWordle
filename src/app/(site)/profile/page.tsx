import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileView } from "@/components/profile/profile-view";
import { requireUser } from "@/lib/auth/dal";
import { getProfileForUser } from "@/lib/profile/queries";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);

  if (!profile) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-10">
      <ProfileView profile={profile} isOwner />
    </div>
  );
}
