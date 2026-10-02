import type { Game, GameResult, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Identity } from "@/lib/session/identity";
import { identityWhere } from "@/lib/session/identity";
import { ownsResult } from "@/lib/session/result";
import { dailyBucketKey, twelveHourBucketKey } from "@/lib/time/buckets";
import { evaluateGuess, type GuessRow } from "@/lib/words/feedback";
import { parseGameSettings, resolvePuzzle } from "@/lib/words/resolver";
import { getUnlimitedAnswer } from "@/lib/words/rotation";

import type { WordleMode, WordleView } from "./wordle-view";

export const WORDLE_SLUG = "wordle";

export async function getWordleGame(): Promise<Game | null> {
  return prisma.game.findFirst({ where: { slug: WORDLE_SLUG, isActive: true } });
}

function readBoard(value: Prisma.JsonValue): GuessRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as { word?: unknown; feedback?: unknown };
    if (typeof row.word !== "string" || !Array.isArray(row.feedback)) return [];
    return [{ word: row.word, feedback: row.feedback as GuessRow["feedback"] }];
  });
}

function toView(result: GameResult, wordLength: number, maxAttempts: number): WordleView {
  const board = readBoard(result.guesses);
  const completed = result.solved || result.completedAt !== null;
  const mode = result.mode === "UNLIMITED" ? "UNLIMITED" : "DAILY";

  return {
    resultId: result.id,
    mode,
    bucketKey: result.bucketKey ?? "",
    wordLength,
    maxAttempts,
    board,
    solved: result.solved,
    completed,
    answer: completed ? result.answer : null,
    title: mode === "DAILY" ? `Wordle Arena #${result.bucketKey}` : "Wordle Arena Unlimited",
  };
}

function limits(game: Game) {
  const settings = parseGameSettings(game.settings);
  return {
    wordLength: settings.answerLength ?? 5,
    maxAttempts: settings.maxAttempts ?? 6,
  };
}

/**
 * Starts (or resumes) a game.
 *
 * Daily games are locked per player per IST day: calling this twice returns the
 * same row so a refresh never resets progress. Unlimited games always create a
 * fresh row with a new answer from the current 12-hour pool.
 */
export async function startWordle(
  game: Game,
  identity: Identity,
  mode: WordleMode,
): Promise<WordleView | null> {
  const { wordLength, maxAttempts } = limits(game);

  if (mode === "DAILY") {
    const bucketKey = dailyBucketKey();
    const existing = await prisma.gameResult.findFirst({
      where: { gameId: game.id, mode: "DAILY", bucketKey, ...identityWhere(identity) },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return toView(existing, wordLength, maxAttempts);
  }

  const bucketKey = mode === "DAILY" ? dailyBucketKey() : twelveHourBucketKey();
  const answer =
    mode === "DAILY"
      ? ((await resolvePuzzle(game, bucketKey))?.normalized ?? null)
      : await getUnlimitedAnswer(game);

  if (!answer) return null;

  const created = await prisma.gameResult.create({
    data: {
      gameId: game.id,
      mode,
      bucketKey,
      answer,
      guesses: [],
      userId: identity.userId,
      guestId: identity.guestId,
    },
  });

  return toView(created, wordLength, maxAttempts);
}

export type GuessOutcome =
  { ok: true; view: WordleView } | { ok: false; status: number; error: string };

/** Validates a guess server-side so the answer never has to reach the browser. */
export async function submitWordleGuess(
  game: Game,
  identity: Identity,
  resultId: string,
  rawGuess: string,
): Promise<GuessOutcome> {
  const { wordLength, maxAttempts } = limits(game);

  const result = await prisma.gameResult.findUnique({ where: { id: resultId } });
  if (!result || result.gameId !== game.id) {
    return { ok: false, status: 404, error: "Game not found." };
  }
  if (!ownsResult(result, identity)) {
    return { ok: false, status: 403, error: "This game belongs to another player." };
  }
  if (result.solved || result.completedAt) {
    return { ok: false, status: 409, error: "This game has already finished." };
  }

  const answer = result.answer;
  if (!answer) {
    return { ok: false, status: 409, error: "This game has no answer recorded." };
  }

  const guess = rawGuess.trim().toLowerCase();
  if (!/^[a-z]+$/.test(guess) || guess.length !== wordLength) {
    return { ok: false, status: 422, error: `Enter a ${wordLength}-letter word.` };
  }

  const known = await prisma.wordEntry.findFirst({
    where: { gameId: game.id, normalized: guess },
    select: { id: true },
  });
  if (!known) {
    return { ok: false, status: 422, error: "Not in word list." };
  }

  const board = readBoard(result.guesses);
  if (board.length >= maxAttempts) {
    return { ok: false, status: 409, error: "No attempts remaining." };
  }

  board.push({ word: guess, feedback: evaluateGuess(answer, guess) });

  const solved = guess === answer;
  const attempts = board.length;
  const completed = solved || attempts >= maxAttempts;

  const updated = await prisma.gameResult.update({
    where: { id: result.id },
    data: {
      guesses: board as unknown as Prisma.InputJsonValue,
      attempts,
      solved,
      completedAt: completed ? new Date() : null,
      durationMs: completed ? Math.max(0, Date.now() - result.startedAt.getTime()) : undefined,
    },
  });

  return { ok: true, view: toView(updated, wordLength, maxAttempts) };
}

/** Recent finished daily results for a player (used on the results panel). */
export async function getRecentWordleStats(gameId: string, identity: Identity) {
  const rows = await prisma.gameResult.findMany({
    where: { gameId, ...identityWhere(identity) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { solved: true, attempts: true, mode: true, bucketKey: true, createdAt: true },
  });

  const daily = rows.filter((row) => row.mode === "DAILY");
  const solved = daily.filter((row) => row.solved).length;

  return {
    played: daily.length,
    solved,
    winRate: daily.length === 0 ? 0 : Math.round((solved / daily.length) * 100),
    streak: currentStreak(daily),
  };
}

function currentStreak(rows: { solved: boolean }[]): number {
  let streak = 0;
  for (const row of rows) {
    if (row.solved) streak += 1;
    else break;
  }
  return streak;
}
