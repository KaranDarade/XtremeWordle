import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Game } from "@/generated/prisma/client";
import {
  parseConnectionsPuzzle,
  startConnections,
  submitConnectionsGuess,
} from "@/lib/games/connections";
import { createPrismaClient } from "@/lib/prisma";
import type { Identity } from "@/lib/session/identity";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const slug = `conn-test-${Date.now()}`;

const GROUPS = [
  { category: "Fruits", difficulty: 0, words: ["APPLE", "MANGO", "GRAPE", "PEACH"] },
  { category: "Planets", difficulty: 1, words: ["MARS", "VENUS", "EARTH", "SATURN"] },
  { category: "Colors", difficulty: 2, words: ["RED", "BLUE", "GREEN", "YELLOW"] },
  { category: "Balls", difficulty: 3, words: ["BASE", "FOOT", "BASKET", "TENNIS"] },
];

let game: Game;
let player: Identity;
let loser: Identity;

beforeAll(async () => {
  game = await prisma.game.create({
    data: {
      slug,
      name: "Connections Test",
      sortOrder: 902,
      isActive: true,
      settings: { resolver: "puzzle", maxMistakes: 4, rotation: "daily" },
    },
  });

  await prisma.gamePuzzle.create({
    data: {
      gameId: game.id,
      externalId: `conn-${slug}`,
      title: "Test board",
      payload: { groups: GROUPS },
    },
  });

  const guest = await prisma.guestSession.create({ data: { token: `${slug}-guest` } });
  const other = await prisma.guestSession.create({ data: { token: `${slug}-loser` } });
  player = { userId: null, guestId: guest.id };
  loser = { userId: null, guestId: other.id };
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { slug } });
  await prisma.guestSession.deleteMany({ where: { token: { startsWith: slug } } });
  await prisma.$disconnect();
});

describe("puzzle parsing", () => {
  it("accepts a well-formed payload", () => {
    expect(parseConnectionsPuzzle({ groups: GROUPS })).toHaveLength(4);
  });

  it("rejects malformed payloads", () => {
    expect(parseConnectionsPuzzle(null)).toBeNull();
    expect(parseConnectionsPuzzle({ groups: [] })).toBeNull();
    expect(parseConnectionsPuzzle({ groups: [GROUPS[0]] })).toBeNull();
    expect(
      parseConnectionsPuzzle({ groups: GROUPS.map(() => ({ category: "x", words: ["a"] })) }),
    ).toBeNull();
  });
});

describe("connections gameplay", () => {
  let resultId = "";

  it("starts a stable 16-word board", async () => {
    const view = await startConnections(game, player);
    expect(view).not.toBeNull();
    expect(view?.words).toHaveLength(16);
    expect(new Set(view?.words).size).toBe(16);
    expect(view?.mistakes).toBe(0);
    expect(view?.solvedGroups).toHaveLength(0);
    expect(view?.completed).toBe(false);
    expect(view?.revealedGroups).toBeNull();
    resultId = view!.resultId;

    const again = await startConnections(game, player);
    expect(again?.resultId).toBe(resultId);
    expect(again?.words).toEqual(view?.words);
  });

  it("requires exactly four words from the board", async () => {
    const tooFew = await submitConnectionsGuess(game, player, resultId, [
      "APPLE",
      "MANGO",
      "GRAPE",
    ]);
    expect(tooFew.ok).toBe(false);

    const duplicates = await submitConnectionsGuess(game, player, resultId, [
      "APPLE",
      "APPLE",
      "MANGO",
      "GRAPE",
    ]);
    expect(duplicates.ok).toBe(false);

    const notOnBoard = await submitConnectionsGuess(game, player, resultId, [
      "APPLE",
      "MANGO",
      "GRAPE",
      "ZZZZZ",
    ]);
    expect(notOnBoard.ok).toBe(false);
  });

  it("records a mistake for a wrong group", async () => {
    const outcome = await submitConnectionsGuess(game, player, resultId, [
      "APPLE",
      "MARS",
      "RED",
      "BASE",
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.correct).toBe(false);
    expect(outcome.view.mistakes).toBe(1);
    expect(outcome.view.solvedGroups).toHaveLength(0);
  });

  it("accepts a correct group and exposes its category", async () => {
    const outcome = await submitConnectionsGuess(game, player, resultId, GROUPS[0].words);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.correct).toBe(true);
    expect(outcome.category).toBe("Fruits");
    expect(outcome.view.solvedGroups).toHaveLength(1);
    expect(outcome.view.mistakes).toBe(1);
  });

  it("refuses words from an already-solved group", async () => {
    const outcome = await submitConnectionsGuess(game, player, resultId, [
      "APPLE",
      GROUPS[1].words[0],
      GROUPS[1].words[1],
      GROUPS[1].words[2],
    ]);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.status).toBe(409);
  });

  it("completes as a win once all four groups are found", async () => {
    for (const group of GROUPS.slice(1)) {
      await submitConnectionsGuess(game, player, resultId, group.words);
    }

    const view = await startConnections(game, player);
    expect(view?.solved).toBe(true);
    expect(view?.completed).toBe(true);
    expect(view?.solvedGroups).toHaveLength(4);
    expect(view?.revealedGroups).toHaveLength(4);
  });

  it("ends in a loss after four mistakes, revealing the groups", async () => {
    const view = await startConnections(game, loser);
    expect(view).not.toBeNull();
    const result = view!.resultId;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const outcome = await submitConnectionsGuess(game, loser, result, [
        "APPLE",
        "MARS",
        "RED",
        "BASE",
      ]);
      expect(outcome.ok).toBe(true);
    }

    const finished = await startConnections(game, loser);
    expect(finished?.mistakes).toBe(4);
    expect(finished?.completed).toBe(true);
    expect(finished?.solved).toBe(false);
    expect(finished?.revealedGroups).toHaveLength(4);

    const blocked = await submitConnectionsGuess(game, loser, result, GROUPS[0].words);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(409);
  });
});
