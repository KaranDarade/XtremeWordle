import type { Game, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { Identity } from "@/lib/session/identity";
import { identityWhere } from "@/lib/session/identity";
import { ownsResult } from "@/lib/session/result";
import { dailyBucketKey } from "@/lib/time/buckets";
import { seededShuffle } from "@/lib/words/random";
import { parseGameSettings, resolvePuzzle } from "@/lib/words/resolver";

export const CONNECTIONS_SLUG = "connections";

export interface ConnectionsGroup {
  category: string;
  difficulty: number;
  words: string[];
}

export interface ConnectionsAttempt {
  words: string[];
  correct: boolean;
  category: string | null;
}

export interface ConnectionsView {
  resultId: string;
  bucketKey: string;
  words: string[];
  attempts: ConnectionsAttempt[];
  solvedGroups: { category: string; words: string[] }[];
  mistakes: number;
  maxMistakes: number;
  solved: boolean;
  completed: boolean;
  revealedGroups: ConnectionsGroup[] | null;
}

export async function getConnectionsGame(): Promise<Game | null> {
  return prisma.game.findFirst({ where: { slug: CONNECTIONS_SLUG, isActive: true } });
}

export function parseConnectionsPuzzle(payload: unknown): ConnectionsGroup[] | null {
  if (!payload || typeof payload !== "object") return null;
  const groups = (payload as { groups?: unknown }).groups;
  if (!Array.isArray(groups) || groups.length !== 4) return null;

  const parsed: ConnectionsGroup[] = [];
  for (const entry of groups) {
    if (!entry || typeof entry !== "object") return null;
    const group = entry as { category?: unknown; difficulty?: unknown; words?: unknown };
    if (typeof group.category !== "string" || !Array.isArray(group.words)) return null;
    const words = group.words.filter((word): word is string => typeof word === "string");
    if (words.length !== 4) return null;
    parsed.push({
      category: group.category,
      difficulty: typeof group.difficulty === "number" ? group.difficulty : 0,
      words,
    });
  }

  return parsed;
}

function readAttempts(value: unknown): ConnectionsAttempt[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const attempt = entry as { words?: unknown; correct?: unknown; category?: unknown };
    if (!Array.isArray(attempt.words)) return [];
    return [
      {
        words: attempt.words.filter((word): word is string => typeof word === "string"),
        correct: attempt.correct === true,
        category: typeof attempt.category === "string" ? attempt.category : null,
      },
    ];
  });
}

async function loadConnectionsPuzzle(game: Game) {
  const bucketKey = dailyBucketKey();
  const daily = await resolvePuzzle(game, bucketKey);
  if (!daily) return null;

  const puzzleRow = await prisma.gamePuzzle.findUnique({
    where: { gameId_externalId: { gameId: game.id, externalId: daily.word } },
  });
  if (!puzzleRow) return null;

  const groups = parseConnectionsPuzzle(puzzleRow.payload);
  if (!groups) return null;

  return { bucketKey, daily, puzzleRow, groups };
}

function allWords(groups: ConnectionsGroup[]): string[] {
  return groups.flatMap((group) => group.words);
}

function buildView(
  resultId: string,
  bucketKey: string,
  groups: ConnectionsGroup[],
  maxMistakes: number,
  attempts: ConnectionsAttempt[],
): ConnectionsView {
  const solvedGroups = attempts
    .filter((attempt) => attempt.correct)
    .map((attempt) => ({ category: attempt.category ?? "", words: attempt.words }));
  const mistakes = attempts.length - solvedGroups.length;
  const solved = solvedGroups.length === groups.length;
  const completed = solved || mistakes >= maxMistakes;

  return {
    resultId,
    bucketKey,
    words: seededShuffle(allWords(groups), `${bucketKey}:${groups[0]?.category ?? ""}`),
    attempts,
    solvedGroups,
    mistakes,
    maxMistakes,
    solved,
    completed,
    revealedGroups: completed ? groups : null,
  };
}

/** Starts or resumes today's Connections puzzle. */
export async function startConnections(
  game: Game,
  identity: Identity,
): Promise<ConnectionsView | null> {
  const loaded = await loadConnectionsPuzzle(game);
  if (!loaded) return null;

  const { bucketKey, daily, groups } = loaded;
  const maxMistakes = parseGameSettings(game.settings).maxMistakes ?? 4;

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

  return buildView(result.id, bucketKey, groups, maxMistakes, readAttempts(result.guesses));
}

export type ConnectionsOutcome =
  | { ok: true; view: ConnectionsView; correct: boolean; category: string | null }
  | { ok: false; status: number; error: string };

/** Validates a four-word selection against the puzzle's hidden groups. */
export async function submitConnectionsGuess(
  game: Game,
  identity: Identity,
  resultId: string,
  selection: string[],
): Promise<ConnectionsOutcome> {
  const loaded = await loadConnectionsPuzzle(game);
  if (!loaded) return { ok: false, status: 503, error: "No puzzle is available today." };

  const { bucketKey, groups } = loaded;
  const maxMistakes = parseGameSettings(game.settings).maxMistakes ?? 4;

  const result = await prisma.gameResult.findUnique({ where: { id: resultId } });
  if (!result || result.gameId !== game.id) {
    return { ok: false, status: 404, error: "Game not found." };
  }
  if (!ownsResult(result, identity)) {
    return { ok: false, status: 403, error: "This game belongs to another player." };
  }

  const attempts = readAttempts(result.guesses);
  const view = buildView(result.id, bucketKey, groups, maxMistakes, attempts);
  if (view.completed) {
    return { ok: false, status: 409, error: "This puzzle is already finished." };
  }

  const chosen = selection.map((word) => word.trim().toUpperCase());
  if (chosen.length !== 4 || new Set(chosen).size !== 4) {
    return { ok: false, status: 422, error: "Select exactly four different words." };
  }

  const boardWords = allWords(groups);
  if (!chosen.every((word) => boardWords.includes(word))) {
    return { ok: false, status: 422, error: "Those words are not on the board." };
  }

  const alreadySolved = new Set(view.solvedGroups.flatMap((group) => group.words));
  if (chosen.some((word) => alreadySolved.has(word))) {
    return { ok: false, status: 409, error: "One of those words is already solved." };
  }

  const signature = [...chosen].sort().join("|");
  const matched = groups.find(
    (group) =>
      [...group.words]
        .map((word) => word.toUpperCase())
        .sort()
        .join("|") === signature,
  );

  const attempt: ConnectionsAttempt = {
    words: chosen,
    correct: Boolean(matched),
    category: matched?.category ?? null,
  };

  const nextAttempts = [...attempts, attempt];
  const nextView = buildView(result.id, bucketKey, groups, maxMistakes, nextAttempts);

  await prisma.gameResult.update({
    where: { id: result.id },
    data: {
      guesses: nextAttempts as unknown as Prisma.InputJsonValue,
      attempts: nextView.mistakes,
      solved: nextView.solved,
      completedAt: nextView.completed ? new Date() : null,
    },
  });

  return {
    ok: true,
    view: nextView,
    correct: Boolean(matched),
    category: matched?.category ?? null,
  };
}
