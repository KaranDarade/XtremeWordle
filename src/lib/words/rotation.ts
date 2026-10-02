import { createHmac } from "node:crypto";

import { prisma } from "@/lib/db";
import { requiredSecret } from "@/lib/env";
import { bucketKeyForMode, nextBucketKey, twelveHourBucketKey } from "@/lib/time/buckets";

import { listAnswerWords, parseGameSettings, resolvePuzzle, type GameRef } from "./resolver";

export interface RotationSummary {
  slug: string;
  bucketKey: string;
  word: string | null;
  nextBucketKey: string;
  nextWord: string | null;
  poolBucket: string | null;
}

/** Deterministic seed for a rotation window (used for reproducible pools). */
export function rotationSeed(gameId: string, bucketKey: string): string {
  const secret = requiredSecret("SEED_SECRET", "extreme-wordle-dev-seed");
  return createHmac("sha256", secret)
    .update(`pool:${gameId}:${bucketKey}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Records the rotating word-pool snapshot for a 12-hour window. Wordle
 * Unlimited draws from this pool, which refreshes at 00:00 and 12:00 IST.
 */
export async function ensurePoolRotation(game: GameRef, bucketKey: string) {
  return prisma.poolRotation.upsert({
    where: { gameId_bucketKey: { gameId: game.id, bucketKey } },
    update: {},
    create: { gameId: game.id, bucketKey, seed: rotationSeed(game.id, bucketKey) },
  });
}

/**
 * Chooses an answer for unlimited play that has not already been served in the
 * current 12-hour window. Falls back to the whole pool once it is exhausted.
 */
export async function getUnlimitedAnswer(game: GameRef): Promise<string | null> {
  if (parseGameSettings(game.settings).resolver === "puzzle") return null;

  const bucketKey = twelveHourBucketKey();
  await ensurePoolRotation(game, bucketKey);

  const words = await listAnswerWords(game);
  if (words.length === 0) return null;

  const served = await prisma.gameResult.findMany({
    where: { gameId: game.id, mode: "UNLIMITED", bucketKey, answer: { not: null } },
    select: { answer: true },
  });
  const used = new Set(served.map((row) => row.answer));
  const available = words.filter((word) => !used.has(word));
  const pool = available.length > 0 ? available : words;

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/**
 * Materialises the current and next rotation for every active game.
 *
 * This is what the scheduler calls. It is intentionally idempotent: running it
 * repeatedly never changes an already-materialised slot, and because answers are
 * derived deterministically the site still works if the scheduler never runs.
 */
export async function rotateAllGames(): Promise<RotationSummary[]> {
  const games = await prisma.game.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const summaries: RotationSummary[] = [];

  for (const game of games) {
    const settings = parseGameSettings(game.settings);
    const mode = settings.rotation === "twelve-hour" ? "twelve-hour" : "daily";

    const bucketKey = bucketKeyForMode(mode);
    const word = await resolvePuzzle(game, bucketKey);

    const upcomingKey = nextBucketKey(mode);
    const upcoming = await resolvePuzzle(game, upcomingKey);

    let poolBucket: string | null = null;
    if (settings.unlimitedRotation === "twelve-hour") {
      const rotation = await ensurePoolRotation(game, twelveHourBucketKey());
      poolBucket = rotation.bucketKey;
    }

    summaries.push({
      slug: game.slug,
      bucketKey,
      word: word?.word ?? null,
      nextBucketKey: upcomingKey,
      nextWord: upcoming?.word ?? null,
      poolBucket,
    });
  }

  return summaries;
}
