import type { Game, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Identity } from "@/lib/session/identity";
import { identityWhere } from "@/lib/session/identity";
import { ownsResult, readStringArray } from "@/lib/session/result";
import { dailyBucketKey } from "@/lib/time/buckets";
import { parseGameSettings, resolvePuzzle } from "@/lib/words/resolver";

export const BEE_SLUG = "spelling-bee";

export interface BeePuzzle {
  centre: string;
  outer: string[];
  pangram: string | null;
}

export interface BeeView {
  resultId: string;
  bucketKey: string;
  centre: string;
  outer: string[];
  letters: string[];
  found: string[];
  score: number;
  maxScore: number;
  totalWords: number;
  pangramsFound: string[];
  completed: boolean;
}

export async function getBeeGame(): Promise<Game | null> {
  return prisma.game.findFirst({ where: { slug: BEE_SLUG, isActive: true } });
}

export function parseBeePuzzle(payload: unknown): BeePuzzle | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as { centre?: unknown; outer?: unknown; pangram?: unknown };
  if (typeof value.centre !== "string" || !Array.isArray(value.outer)) return null;

  const centre = value.centre.toLowerCase();
  const outer = value.outer
    .filter((letter): letter is string => typeof letter === "string")
    .map((letter) => letter.toLowerCase());

  if (!/^[a-z]$/.test(centre) || outer.length !== 6) return null;
  if (!outer.every((letter) => /^[a-z]$/.test(letter))) return null;

  return {
    centre,
    outer,
    pangram: typeof value.pangram === "string" ? value.pangram.toLowerCase() : null,
  };
}

export function beeLetters(puzzle: BeePuzzle): string[] {
  return [puzzle.centre, ...puzzle.outer];
}

/** 4-letter words score 1; longer words score their length; pangrams get +7. */
export function scoreBeeWord(word: string, puzzle: BeePuzzle): number {
  const base = word.length === 4 ? 1 : word.length;
  const isPangram = beeLetters(puzzle).every((letter) => word.includes(letter));
  return base + (isPangram ? 7 : 0);
}

export function isPangram(word: string, puzzle: BeePuzzle): boolean {
  return beeLetters(puzzle).every((letter) => word.includes(letter));
}

interface BeeWordList {
  words: string[];
  scores: Map<string, number>;
  maxScore: number;
  pangrams: string[];
  expiresAt: number;
}

// The full answer set for a letter set is expensive to derive, so cache it
// in-process for a short window.
const wordListCache = new Map<string, BeeWordList>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * All valid answers for a letter set, computed in PostgreSQL with a regex match
 * so the ~167k row dictionary never has to travel to the app.
 */
export async function getValidBeeWords(
  gameId: string,
  externalId: string,
  puzzle: BeePuzzle,
): Promise<BeeWordList> {
  const cacheKey = `${gameId}:${externalId}`;
  const cached = wordListCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const letters = beeLetters(puzzle).join("");
  const rows = await prisma.$queryRaw<{ word: string }[]>`
    SELECT word
    FROM "WordEntry"
    WHERE "gameId" = ${gameId}
      AND "isActive" = true
      AND length(word) >= 4
      AND word ~ ${`^[${letters}]+$`}
      AND word LIKE ${`%${puzzle.centre}%`}
  `;

  const words = rows.map((row) => row.word);
  const scores = new Map(words.map((word) => [word, scoreBeeWord(word, puzzle)]));
  const pangrams = words.filter((word) => isPangram(word, puzzle));

  const entry: BeeWordList = {
    words,
    scores,
    maxScore: words.reduce((total, word) => total + (scores.get(word) ?? 0), 0),
    pangrams,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  wordListCache.set(cacheKey, entry);
  return entry;
}

async function loadBeePuzzle(game: Game) {
  const bucketKey = dailyBucketKey();
  const daily = await resolvePuzzle(game, bucketKey);
  if (!daily) return null;

  const puzzleRow = await prisma.gamePuzzle.findUnique({
    where: { gameId_externalId: { gameId: game.id, externalId: daily.word } },
  });
  if (!puzzleRow) return null;

  const puzzle = parseBeePuzzle(puzzleRow.payload);
  if (!puzzle) return null;

  return { bucketKey, daily, puzzleRow, puzzle };
}

function toBeeView(
  resultId: string,
  bucketKey: string,
  puzzle: BeePuzzle,
  found: string[],
  stats: { maxScore: number; totalWords: number; pangrams: string[] },
): BeeView {
  const score = found.reduce((total, word) => total + scoreBeeWord(word, puzzle), 0);

  return {
    resultId,
    bucketKey,
    centre: puzzle.centre,
    outer: puzzle.outer,
    letters: beeLetters(puzzle),
    found,
    score,
    maxScore: stats.maxScore,
    totalWords: stats.totalWords,
    pangramsFound: found.filter((word) => isPangram(word, puzzle)),
    completed: false,
  };
}

/** Starts or resumes today's Spelling Bee. */
export async function startBee(game: Game, identity: Identity): Promise<BeeView | null> {
  const loaded = await loadBeePuzzle(game);
  if (!loaded) return null;

  const { bucketKey, daily, puzzleRow, puzzle } = loaded;
  const stats = await getValidBeeWords(game.id, puzzleRow.externalId, puzzle);

  let result = await prisma.gameResult.findFirst({
    where: { gameId: game.id, mode: "DAILY", bucketKey, ...identityWhere(identity) },
    orderBy: { createdAt: "desc" },
  });

  if (!result) {
    result = await prisma.gameResult.create({
      data: {
        gameId: game.id,
        mode: "DAILY",
        bucketKey,
        answer: daily.word,
        guesses: [],
        userId: identity.userId,
        guestId: identity.guestId,
      },
    });
  }

  const found = readStringArray(result.guesses);
  const view = toBeeView(result.id, bucketKey, puzzle, found, {
    maxScore: stats.maxScore,
    totalWords: stats.words.length,
    pangrams: stats.pangrams,
  });

  return { ...view, completed: found.length > 0 && found.length === stats.words.length };
}

export type BeeOutcome =
  | { ok: true; view: BeeView; word: string; score: number; isPangram: boolean }
  | { ok: false; status: number; error: string };

/** Validates and stores a bee word. */
export async function submitBeeWord(
  game: Game,
  identity: Identity,
  resultId: string,
  rawWord: string,
): Promise<BeeOutcome> {
  const loaded = await loadBeePuzzle(game);
  if (!loaded) return { ok: false, status: 503, error: "No puzzle is available today." };

  const { bucketKey, puzzleRow, puzzle } = loaded;

  const result = await prisma.gameResult.findUnique({ where: { id: resultId } });
  if (!result || result.gameId !== game.id) {
    return { ok: false, status: 404, error: "Game not found." };
  }
  if (!ownsResult(result, identity)) {
    return { ok: false, status: 403, error: "This game belongs to another player." };
  }

  const { minWordLength } = beeLimits(game);

  const word = rawWord.trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) {
    return { ok: false, status: 422, error: "Use letters only." };
  }
  if (word.length < minWordLength) {
    return { ok: false, status: 422, error: `Words must be at least ${minWordLength} letters.` };
  }
  if (!word.includes(puzzle.centre)) {
    return {
      ok: false,
      status: 422,
      error: `Every word must include the centre letter ${puzzle.centre.toUpperCase()}.`,
    };
  }
  if (![...word].every((letter) => beeLetters(puzzle).includes(letter))) {
    return { ok: false, status: 422, error: "You can only use the seven given letters." };
  }

  const found = readStringArray(result.guesses);
  if (found.includes(word)) {
    return { ok: false, status: 409, error: "Already found." };
  }

  const stats = await getValidBeeWords(game.id, puzzleRow.externalId, puzzle);
  if (!stats.words.includes(word)) {
    return { ok: false, status: 422, error: "Not in word list." };
  }

  const nextFound = [...found, word];
  const completed = nextFound.length === stats.words.length;

  await prisma.gameResult.update({
    where: { id: result.id },
    data: {
      guesses: nextFound as unknown as Prisma.InputJsonValue,
      attempts: nextFound.length,
      solved: completed,
      completedAt: completed ? new Date() : null,
    },
  });

  const view = toBeeView(result.id, bucketKey, puzzle, nextFound, {
    maxScore: stats.maxScore,
    totalWords: stats.words.length,
    pangrams: stats.pangrams,
  });

  return {
    ok: true,
    view: { ...view, completed },
    word,
    score: scoreBeeWord(word, puzzle),
    isPangram: isPangram(word, puzzle),
  };
}

export function beeLimits(game: Game) {
  const settings = parseGameSettings(game.settings);
  return { minWordLength: settings.minWordLength ?? 4 };
}
