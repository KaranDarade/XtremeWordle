import { prisma } from "@/lib/db";

import { matchClock, totalMatchMs } from "./clock";
import { ARENA_QUEUE } from "./config";
import { finalizeMatch, resolveOutcome } from "./engine";

/**
 * Housekeeping for the arena.
 *
 * Nothing in the match engine needs a worker, but three things still accumulate
 * without one: matches that nobody is polling, stale queue rows, and expired
 * reset codes. This runs from the cron endpoint (and is safe to run repeatedly).
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface CleanupSummary {
  matchesFinalized: number;
  queueRemoved: number;
  otpsRemoved: number;
  presenceRemoved: number;
}

export async function cleanupArena(now: Date = new Date()): Promise<CleanupSummary> {
  // 1. Finish matches whose clock has fully run out but which nobody polled.
  const playing = await prisma.arenaMatch.findMany({
    where: { status: "PLAYING" },
    select: {
      id: true,
      startedAt: true,
      roundCount: true,
      roundMs: true,
      breakMs: true,
      countdownMs: true,
      players: {
        select: { id: true, solvedAt: true, bestGreens: true, bestYellows: true, bestAt: true },
      },
    },
  });

  let matchesFinalized = 0;
  for (const match of playing) {
    const timing = {
      startedAt: match.startedAt,
      roundCount: match.roundCount,
      roundMs: match.roundMs,
      breakMs: match.breakMs,
      countdownMs: match.countdownMs,
    };

    // Small grace beyond the final reveal so a live poller still wins the race.
    const elapsed = now.getTime() - match.startedAt.getTime();
    if (elapsed < totalMatchMs(timing) + 5_000) continue;
    if (matchClock(timing, now).phase !== "finished") continue;

    const outcome = resolveOutcome(match.players);
    await finalizeMatch(match.id, outcome.winnerPlayerId, outcome.reason, outcome.isDraw);
    matchesFinalized += 1;
  }

  const queueRemoved = (
    await prisma.arenaQueue.deleteMany({
      where: { lastSeenAt: { lt: new Date(now.getTime() - ARENA_QUEUE.staleMs * 4) } },
    })
  ).count;

  const otpsRemoved = (
    await prisma.passwordResetOtp.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - DAY_MS) } },
    })
  ).count;

  const presenceRemoved = (
    await prisma.presence.deleteMany({
      where: { lastSeenAt: { lt: new Date(now.getTime() - HOUR_MS) } },
    })
  ).count;

  return { matchesFinalized, queueRemoved, otpsRemoved, presenceRemoved };
}
