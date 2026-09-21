import { createHmac } from "node:crypto";

import type { Game, GamePuzzle, WordEntry } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface GameSettings {
  resolver?: "word" | "puzzle";
  rotation?: "daily" | "twelve-hour";
  answerLength?: number;
  maxAttempts?: number;
  unlimitedRotation?: "daily" | "twelve-hour";
  minWordLength?: number;
  requiredLetters?: number;
  groups?: number;
  wordsPerGroup?: number;
  maxMistakes?: number;
}

export function parseGameSettings(settings: unknown): GameSettings {
  if (!settings || typeof settings !== "object") return {};
  return settings as GameSettings;
}

export type GameRef = Pick<Game, "id" | "slug" | "settings">;

export interface PuzzlePreview {
  word: string;
  normalized: string;
  source: "AUTO" | "MANUAL";
  wordEntry: WordEntry | null;
  gamePuzzle: GamePuzzle | null;
}

/**
 * Deterministic, uniform index for a game/bucket pair. The same bucket always
 * resolves to the same word, even if the scheduler never runs.
 */
export async function deterministicIndex(gameId: string, bucketKey: string): Promise<number> {
  const seed = process.env.SEED_SECRET ?? "extreme-wordle-dev-seed";
  const digest = createHmac("sha256", seed).update(`${gameId}:${bucketKey}`).digest();
  return digest.readUInt32BE(0);
}

async function orderedAnswerIds(game: GameRef, exclude?: string): Promise<string[]> {
  const rows = await prisma.wordEntry.findMany({
    where: {
      gameId: game.id,
      isAnswerPool: true,
      isActive: true,
      ...(exclude ? { normalized: { not: exclude } } : {}),
    },
    orderBy: { word: "asc" },
    select: { normalized: true },
  });
  return rows.map((row) => row.normalized);
}

/** The full, stable answer pool for a word game (used by unlimited mode). */
export function listAnswerWords(game: GameRef, exclude?: string): Promise<string[]> {
  return orderedAnswerIds(game, exclude);
}

async function orderedPuzzleIds(game: GameRef, exclude?: string): Promise<string[]> {
  const rows = await prisma.gamePuzzle.findMany({
    where: {
      gameId: game.id,
      isActive: true,
      ...(exclude ? { externalId: { not: exclude } } : {}),
    },
    orderBy: { externalId: "asc" },
    select: { externalId: true },
  });
  return rows.map((row) => row.externalId);
}

function selectIndex(length: number, index: number | "random"): number {
  if (length === 0) return -1;
  if (index === "random") return Math.floor(Math.random() * length);
  return index % length;
}

/**
 * Picks the answer for a game without persisting anything.
 * `"random"` is used for a forced regenerate; a number is the deterministic
 * rotation index.
 */
export async function pickPuzzle(
  game: GameRef,
  index: number | "random",
  exclude?: string,
): Promise<PuzzlePreview | null> {
  const settings = parseGameSettings(game.settings);

  if (settings.resolver === "puzzle") {
    const ids = await orderedPuzzleIds(game, exclude);
    const position = selectIndex(ids.length, index);
    if (position < 0) return null;

    const row = await prisma.gamePuzzle.findUnique({
      where: { gameId_externalId: { gameId: game.id, externalId: ids[position] } },
    });
    if (!row) return null;

    return {
      word: row.externalId,
      normalized: row.externalId,
      source: "AUTO",
      wordEntry: null,
      gamePuzzle: row,
    };
  }

  const ids = await orderedAnswerIds(game, exclude);
  const position = selectIndex(ids.length, index);
  if (position < 0) return null;

  const row = await prisma.wordEntry.findUnique({
    where: { gameId_normalized: { gameId: game.id, normalized: ids[position] } },
  });
  if (!row) return null;

  return {
    word: row.word,
    normalized: row.normalized,
    source: "AUTO",
    wordEntry: row,
    gamePuzzle: null,
  };
}

export async function getPuzzle(gameId: string, bucketKey: string) {
  return prisma.dailyPuzzle.findUnique({
    where: { gameId_bucketKey: { gameId, bucketKey } },
  });
}

export async function listPuzzles(gameId: string, bucketKeys: string[]) {
  if (bucketKeys.length === 0) return [];
  return prisma.dailyPuzzle.findMany({ where: { gameId, bucketKey: { in: bucketKeys } } });
}

/** Computes what a bucket would resolve to, without writing it. */
export async function previewPuzzle(game: GameRef, bucketKey: string) {
  return pickPuzzle(game, await deterministicIndex(game.id, bucketKey));
}

/** Persists the deterministic auto answer if none exists yet. */
export async function resolvePuzzle(game: GameRef, bucketKey: string) {
  const existing = await getPuzzle(game.id, bucketKey);
  if (existing) return existing;

  const preview = await previewPuzzle(game, bucketKey);
  if (!preview) return null;

  try {
    return await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        bucketKey,
        word: preview.word,
        normalized: preview.normalized,
        source: "AUTO",
      },
    });
  } catch {
    // Another request materialised it first.
    return getPuzzle(game.id, bucketKey);
  }
}

/** Admin override. Always wins over auto rotation. */
export async function assignManualPuzzle(
  gameId: string,
  bucketKey: string,
  word: string,
  adminId: string,
) {
  const normalized = word.trim().toLowerCase();
  return prisma.dailyPuzzle.upsert({
    where: { gameId_bucketKey: { gameId, bucketKey } },
    update: { word: normalized, normalized, source: "MANUAL", createdByAdminId: adminId },
    create: {
      gameId,
      bucketKey,
      word: normalized,
      normalized,
      source: "MANUAL",
      createdByAdminId: adminId,
    },
  });
}

export interface RegenerateResult {
  puzzle: Awaited<ReturnType<typeof getPuzzle>>;
  skipped: boolean;
  reason?: string;
}

/**
 * Regenerates a bucket. Manual overrides are protected unless `force` is set.
 * A forced regenerate picks a random replacement so the admin sees a change.
 */
export async function regeneratePuzzle(
  game: GameRef,
  bucketKey: string,
  options: { force?: boolean } = {},
): Promise<RegenerateResult> {
  const existing = await getPuzzle(game.id, bucketKey);

  if (existing?.source === "MANUAL" && !options.force) {
    return {
      puzzle: existing,
      skipped: true,
      reason: "A manual word is already set for this slot.",
    };
  }

  const preview = options.force
    ? await pickPuzzle(game, "random", existing?.normalized)
    : await previewPuzzle(game, bucketKey);

  if (!preview) {
    return { puzzle: existing, skipped: true, reason: "No words are available to pick from." };
  }

  const puzzle = existing
    ? await prisma.dailyPuzzle.update({
        where: { id: existing.id },
        data: {
          word: preview.word,
          normalized: preview.normalized,
          source: "AUTO",
          createdByAdminId: null,
          publishedAt: new Date(),
        },
      })
    : await prisma.dailyPuzzle.create({
        data: {
          gameId: game.id,
          bucketKey,
          word: preview.word,
          normalized: preview.normalized,
          source: "AUTO",
        },
      });

  return { puzzle, skipped: false };
}
