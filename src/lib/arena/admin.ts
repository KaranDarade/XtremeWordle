import { finalizeMatch, resolveOutcome } from "./engine";
import { prisma } from "@/lib/db";

/**
 * Admin-only helpers for the arena. Kept out of `engine.ts` so the player-facing
 * module has no admin concerns.
 */

/** Ends a stuck match using the same solver/closest-guess rules as a natural finish. */
export async function applyResultForAdmin(matchId: string): Promise<boolean> {
  const match = await prisma.arenaMatch.findUnique({
    where: { id: matchId },
    include: { players: true },
  });
  if (!match || match.status !== "PLAYING") return false;

  const outcome = resolveOutcome(match.players);
  await finalizeMatch(matchId, outcome.winnerPlayerId, outcome.reason, outcome.isDraw);

  return true;
}
