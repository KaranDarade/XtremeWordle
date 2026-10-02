"use server";

import { revalidatePath } from "next/cache";

import { cleanupArena } from "@/lib/arena/cleanup";
import { requireAdmin } from "@/lib/auth/dal";
import { applyResultForAdmin } from "@/lib/arena/admin";
import { getOnlineCounts } from "@/lib/arena/presence";
import { prisma } from "@/lib/db";

import { logAdminAction } from "./audit";

export interface ArenaAdminMatch {
  id: string;
  status: string;
  word: string;
  isCasual: boolean;
  isDraw: boolean;
  endReason: string | null;
  startedAt: Date;
  players: string[];
}

export interface ArenaAdminOverview {
  liveMatches: number;
  queued: number;
  online: number;
  inMatch: number;
  finishedToday: number;
  matches: ArenaAdminMatch[];
}

export async function getArenaAdminOverview(): Promise<ArenaAdminOverview> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Finish anything whose clock ran out but which nobody polled, so the
  // dashboard reflects reality instead of a backlog of zombie matches.
  await cleanupArena();

  const [liveMatches, queued, online, finishedToday, matches] = await Promise.all([
    prisma.arenaMatch.count({ where: { status: "PLAYING" } }),
    prisma.arenaQueue.count({ where: { status: "WAITING" } }),
    getOnlineCounts(),
    prisma.arenaMatch.count({ where: { status: "FINISHED", finishedAt: { gte: dayAgo } } }),
    prisma.arenaMatch.findMany({
      orderBy: { startedAt: "desc" },
      take: 25,
      include: { players: { orderBy: { slot: "asc" }, select: { displayName: true } } },
    }),
  ]);

  return {
    liveMatches,
    queued,
    online: online.total,
    inMatch: online.inMatch,
    finishedToday,
    matches: matches.map((match) => ({
      id: match.id,
      status: match.status,
      word: match.word,
      isCasual: match.isCasual,
      isDraw: match.isDraw,
      endReason: match.endReason,
      startedAt: match.startedAt,
      players: match.players.map((player) => player.displayName),
    })),
  };
}

/** Admin escape hatch for a match that got stuck. */
export async function forceEndMatchAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  if (!matchId) return;

  const ended = await applyResultForAdmin(matchId);
  if (!ended) return;

  await logAdminAction({
    adminId: admin.id,
    action: "arena.forceEnd",
    targetType: "ArenaMatch",
    targetId: matchId,
  });

  revalidatePath("/admin/arena");
}
