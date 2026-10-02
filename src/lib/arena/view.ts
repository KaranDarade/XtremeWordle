import type { AvatarConfig } from "@/lib/avatar/config";
import type { LetterFeedback } from "@/lib/words/feedback";

import type { LeagueName } from "./config";

/** Client-facing match payload. Free of Prisma imports so it is bundle-safe. */
export interface ArenaBoardRow {
  round: number;
  guess: string;
  feedback: LetterFeedback[];
  correct: boolean;
  mine: boolean;
}

export interface ArenaSide {
  playerId: string;
  displayName: string;
  league: LeagueName;
  avatar: AvatarConfig;
}

export interface ArenaState {
  matchId: string;
  status: "PLAYING" | "FINISHED" | "ABANDONED";
  version: number;
  serverNow: number;
  phase: "countdown" | "play" | "reveal" | "finished";
  round: number;
  roundCount: number;
  roundMs: number;
  breakMs: number;
  msRemaining: number;
  phaseProgress: number;
  playEndsAt: number;
  roundEndsAt: number;
  word: string | null;
  endReason: string | null;
  winnerPlayerId: string | null;
  isDraw: boolean;
  isCasual: boolean;
  canGuess: boolean;
  me: ArenaSide & {
    pointsDelta: number;
    result: string | null;
    solvedRound: number | null;
    guessedRounds: number[];
  };
  opponent: ArenaSide & {
    isBot: boolean;
    solvedRound: number | null;
    guessedRounds: number[];
    connected: boolean;
  };
  board: ArenaBoardRow[];
  reactions: { from: "me" | "opponent"; emoji: string; at: number }[];
}

export const ARENA_REACTIONS = ["😂", "😭", "😡", "🔥", "👏"] as const;
export type ArenaReaction = (typeof ARENA_REACTIONS)[number];

export const ARENA_RULES = [
  "You both get the same five-letter word.",
  "One guess per row, 12 seconds each — six rows.",
  "Your current row stays hidden; finished rows are revealed to both.",
  "Solve first to win. Nobody solves? Closest guess takes it.",
] as const;
