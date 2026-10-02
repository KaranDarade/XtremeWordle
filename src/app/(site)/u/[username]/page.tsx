import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileView } from "@/components/profile/profile-view";
import { getCurrentUser } from "@/lib/auth/dal";
import { getProfileForUsername } from "@/lib/profile/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `Arena record, league and head-to-head stats for @${username} on Wordle Arena.`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [profile, viewer] = await Promise.all([getProfileForUsername(username), getCurrentUser()]);

  if (!profile) notFound();

  const isOwner = viewer?.id === profile.identity.id;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-10">
      <ProfileView profile={profile} isOwner={isOwner} />
    </div>
  );
}
