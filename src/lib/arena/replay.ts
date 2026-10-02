import { avatarFromSeed, normalizeAvatar, type AvatarConfig } from "@/lib/avatar/config";
import type { LeagueName } from "@/lib/arena/config";
import { prisma } from "@/lib/db";
import type { LetterFeedback } from "@/lib/words/feedback";

export interface ReplayRow {
  round: number;
  guess: string;
  feedback: LetterFeedback[];
  correct: boolean;
}

export interface ReplayPlayer {
  id: string;
  slot: number;
  displayName: string;
  username: string | null;
  isBot: boolean;
  league: LeagueName;
  avatar: AvatarConfig;
  result: string | null;
  solvedRound: number | null;
  pointsDelta: number;
  rows: ReplayRow[];
}

export interface ReplayMatch {
  id: string;
  status: string;
  word: string;
  roundCount: number;
  startedAt: Date;
  finishedAt: Date | null;
  winnerPlayerId: string | null;
  isDraw: boolean;
  endReason: string | null;
  isCasual: boolean;
  players: ReplayPlayer[];
}

/** Loads a finished match for the read-only replay view. */
export async function getMatchReplay(matchId: string): Promise<ReplayMatch | null> {
  const match = await prisma.arenaMatch.findUnique({
    where: { id: matchId },
    include: {
      players: {
        orderBy: { slot: "asc" },
        include: { user: { select: { avatarConfig: true } }, guesses: true },
      },
    },
  });

  if (!match) return null;

  return {
    id: match.id,
    status: match.status,
    word: match.word,
    roundCount: match.roundCount,
    startedAt: match.startedAt,
    finishedAt: match.finishedAt,
    winnerPlayerId: match.winnerPlayerId,
    isDraw: match.isDraw,
    endReason: match.endReason,
    isCasual: match.isCasual,
    players: match.players.map((player) => ({
      id: player.id,
      slot: player.slot,
      displayName: player.displayName,
      username: player.username,
      isBot: player.isBot,
      league: player.league as LeagueName,
      avatar: player.user?.avatarConfig
        ? normalizeAvatar(player.user.avatarConfig)
        : avatarFromSeed(player.avatarSeed ?? player.displayName),
      result: player.result,
      solvedRound: player.solvedRound,
      pointsDelta: player.pointsDelta,
      rows: [...player.guesses]
        .sort((a, b) => a.round - b.round)
        .map((guess) => ({
          round: guess.round,
          guess: guess.guess,
          feedback: (guess.feedback as LetterFeedback[]) ?? [],
          correct: guess.correct,
        })),
    })),
  };
}
