import { cache } from "react";

import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

import { GUEST_COOKIE } from "@/lib/auth/constants";

/**
 * Resolves the anonymous visitor from the `ew_guest` cookie that `proxy.ts`
 * sets. The DB row is created lazily on first use so guest play never
 * requires an account.
 */
export const getGuestSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE)?.value;
  if (!token) return null;

  return prisma.guestSession.upsert({
    where: { token },
    update: {},
    create: { token },
  });
});

/**
 * Hands a guest's history to a freshly signed-in account.
 *
 * If the account already has a result for the same game/mode/bucket (for
 * example today's Daily) the guest's duplicate is dropped so Daily stays
 * one-play-per-day.
 */
export async function migrateGuestToUser(userId: string): Promise<number> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE)?.value;
  if (!token) return 0;

  const guest = await prisma.guestSession.findUnique({ where: { token } });
  if (!guest) return 0;

  const results = await prisma.gameResult.findMany({ where: { guestId: guest.id } });
  let moved = 0;

  for (const result of results) {
    const conflict = await prisma.gameResult.findFirst({
      where: {
        userId,
        gameId: result.gameId,
        mode: result.mode,
        bucketKey: result.bucketKey,
      },
      select: { id: true },
    });

    if (conflict) {
      await prisma.gameResult.delete({ where: { id: result.id } });
    } else {
      await prisma.gameResult.update({
        where: { id: result.id },
        data: { userId, guestId: null },
      });
      moved += 1;
    }
  }

  await prisma.guestSession.update({
    where: { id: guest.id },
    data: { convertedToUserId: userId },
  });

  return moved;
}
