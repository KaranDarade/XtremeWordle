import { prisma } from "@/lib/db";

import { ARENA_QUEUE } from "./config";
import type { ArenaIdentity } from "./engine";

/**
 * Lightweight presence tracking for the "N online" counter.
 *
 * The count is cached in-process for a few seconds so a busy lobby cannot turn
 * every poll into a pair of COUNT queries.
 */
const CACHE_MS = 5000;

export interface OnlineCounts {
  browsing: number;
  inMatch: number;
  total: number;
}

let cached: { at: number; counts: OnlineCounts } | null = null;

function keyFor(identity: ArenaIdentity): string | null {
  if (identity.userId) return `u:${identity.userId}`;
  if (identity.guestId) return `g:${identity.guestId}`;
  return null;
}

export async function heartbeatPresence(
  identity: ArenaIdentity,
  status: "BROWSING" | "IN_MATCH",
): Promise<OnlineCounts> {
  const key = keyFor(identity);
  if (key) {
    await prisma.presence.upsert({
      where: { key },
      update: { status, lastSeenAt: new Date() },
      create: {
        key,
        userId: identity.userId,
        guestId: identity.guestId,
        status,
      },
    });
  }

  return getOnlineCounts(key ? false : true);
}

export async function getOnlineCounts(force = false): Promise<OnlineCounts> {
  const now = Date.now();
  if (!force && cached && now - cached.at < CACHE_MS) return cached.counts;

  const cutoff = new Date(now - ARENA_QUEUE.onlineWindowMs);
  const [browsing, inMatch] = await Promise.all([
    prisma.presence.count({ where: { lastSeenAt: { gt: cutoff }, status: "BROWSING" } }),
    prisma.presence.count({ where: { lastSeenAt: { gt: cutoff }, status: "IN_MATCH" } }),
  ]);

  const counts: OnlineCounts = { browsing, inMatch, total: browsing + inMatch };
  cached = { at: now, counts };
  return counts;
}

/** Test/ops helper so a fresh count can be forced. */
export function resetPresenceCache(): void {
  cached = null;
}
