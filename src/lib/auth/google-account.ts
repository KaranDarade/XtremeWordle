import { prisma } from "@/lib/db";

import type { GoogleProfile } from "./google";
import { pickAvailableUsername } from "./username";

export type GoogleAccountOutcome =
  | { status: "ok"; userId: string; created: boolean; linked: boolean }
  | { status: "error"; reason: "unverified_email" | "banned" };

/**
 * Maps a verified Google profile onto a local account.
 *
 * - Known `googleId` → sign in.
 * - Existing account with the same email → link the Google id (Google has
 *   verified ownership of the address, so this is safe), keeping any password.
 * - Otherwise → create a Google-only account with no password.
 */
export async function resolveGoogleAccount(profile: GoogleProfile): Promise<GoogleAccountOutcome> {
  if (!profile.emailVerified) return { status: "error", reason: "unverified_email" };

  const byGoogleId = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
  if (byGoogleId) {
    if (byGoogleId.isBanned) return { status: "error", reason: "banned" };
    return { status: "ok", userId: byGoogleId.id, created: false, linked: false };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    if (byEmail.isBanned) return { status: "error", reason: "banned" };

    await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.googleId,
        name: byEmail.name ?? profile.name,
        lastLoginAt: new Date(),
      },
    });

    return { status: "ok", userId: byEmail.id, created: false, linked: true };
  }

  const created = await prisma.user.create({
    data: {
      email: profile.email,
      username: await pickAvailableUsername(profile.email, profile.name),
      name: profile.name,
      googleId: profile.googleId,
      lastLoginAt: new Date(),
      // No passwordHash: this is a Google-only account.
    },
  });

  return { status: "ok", userId: created.id, created: true, linked: false };
}
