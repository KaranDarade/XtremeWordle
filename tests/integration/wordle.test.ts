import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRecentWordleStats, startWordle, submitWordleGuess } from "@/lib/games/wordle";
import type { Game } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma";
import type { Identity } from "@/lib/session/identity";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const slug = `wordle-test-${Date.now()}`;

let game: Game;
let player: Identity;
let rival: Identity;

beforeAll(async () => {
  game = await prisma.game.create({
    data: {
      slug,
      name: "Wordle Test",
      sortOrder: 900,
      isActive: true,
      settings: { resolver: "word", answerLength: 5, maxAttempts: 6, rotation: "daily" },
    },
  });

  await prisma.wordEntry.createMany({
    data: [
      { gameId: game.id, word: "crane", normalized: "crane", length: 5, isAnswerPool: true },
      { gameId: game.id, word: "slate", normalized: "slate", length: 5, isAnswerPool: false },
      { gameId: game.id, word: "geese", normalized: "geese", length: 5, isAnswerPool: false },
      { gameId: game.id, word: "beads", normalized: "beads", length: 5, isAnswerPool: false },
    ],
  });

  const guest = await prisma.guestSession.create({ data: { token: `${slug}-guest` } });
  const other = await prisma.guestSession.create({ data: { token: `${slug}-rival` } });
  player = { userId: null, guestId: guest.id };
  rival = { userId: null, guestId: other.id };
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { slug } });
  await prisma.guestSession.deleteMany({ where: { token: { startsWith: slug } } });
  await prisma.$disconnect();
});

describe("wordle daily", () => {
  let resultId = "";

  it("starts without leaking the answer", async () => {
    const view = await startWordle(game, player, "DAILY");
    expect(view).not.toBeNull();
    expect(view?.answer).toBeNull();
    expect(view?.completed).toBe(false);
    expect(view?.board).toHaveLength(0);
    expect(view?.wordLength).toBe(5);
    expect(view?.maxAttempts).toBe(6);
    resultId = view!.resultId;
  });

  it("locks the daily game for the same player (refresh-safe)", async () => {
    const again = await startWordle(game, player, "DAILY");
    expect(again?.resultId).toBe(resultId);
  });

  it("rejects guesses that are not real words", async () => {
    const outcome = await submitWordleGuess(game, player, resultId, "zzzzz");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("Not in word list");
  });

  it("rejects guesses of the wrong length", async () => {
    const outcome = await submitWordleGuess(game, player, resultId, "toolong");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("5-letter");
  });

  it("refuses a game owned by another player", async () => {
    const outcome = await submitWordleGuess(game, rival, resultId, "slate");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.status).toBe(403);
  });

  it("scores a valid guess and keeps the answer hidden", async () => {
    const outcome = await submitWordleGuess(game, player, resultId, "slate");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.view.board).toHaveLength(1);
    expect(outcome.view.board[0].word).toBe("slate");
    expect(outcome.view.board[0].feedback).toHaveLength(5);
    expect(outcome.view.answer).toBeNull();
    expect(outcome.view.completed).toBe(false);
  });

  it("reveals the answer once solved", async () => {
    const outcome = await submitWordleGuess(game, player, resultId, "crane");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.view.solved).toBe(true);
    expect(outcome.view.completed).toBe(true);
    expect(outcome.view.answer).toBe("crane");
    expect(outcome.view.board[1].feedback).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("rejects further guesses after the game is finished", async () => {
    const outcome = await submitWordleGuess(game, player, resultId, "geese");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.status).toBe(409);
  });

  it("gives another player their own daily game", async () => {
    const view = await startWordle(game, rival, "DAILY");
    expect(view).not.toBeNull();
    expect(view?.resultId).not.toBe(resultId);
    expect(view?.board).toHaveLength(0);
  });

  it("reports player stats", async () => {
    const stats = await getRecentWordleStats(game.id, player);
    expect(stats.played).toBe(1);
    expect(stats.solved).toBe(1);
    expect(stats.winRate).toBe(100);
    expect(stats.streak).toBe(1);
  });
});

describe("wordle unlimited", () => {
  it("creates a fresh game each time and never repeats within the window", async () => {
    const first = await startWordle(game, player, "UNLIMITED");
    const second = await startWordle(game, player, "UNLIMITED");

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.resultId).not.toBe(second?.resultId);
    expect(first?.mode).toBe("UNLIMITED");
    expect(first?.bucketKey).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}$/);
  });

  it("finishes after the maximum number of attempts", async () => {
    const view = await startWordle(game, player, "UNLIMITED");
    expect(view).not.toBeNull();

    let latest = view!;
    for (const guess of ["slate", "geese", "beads", "crane", "slate", "geese"]) {
      const outcome = await submitWordleGuess(game, player, latest.resultId, guess);
      if (!outcome.ok) break;
      latest = outcome.view;
    }

    expect(latest.completed).toBe(true);
    expect(latest.answer).toBeTruthy();
    expect(latest.board.length).toBeLessThanOrEqual(6);
  });
});
