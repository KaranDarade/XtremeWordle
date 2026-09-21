import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Game } from "@/generated/prisma/client";
import { getValidBeeWords, scoreBeeWord, startBee, submitBeeWord } from "@/lib/games/bee";
import { createPrismaClient } from "@/lib/prisma";
import type { Identity } from "@/lib/session/identity";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const slug = `bee-test-${Date.now()}`;

let game: Game;
let player: Identity;
let puzzlePayload: { centre: string; outer: string[]; pangram: string | null };

const LETTERS = ["a", "e", "r", "s", "n", "g"];
const CENTRE = "t";
const DICTIONARY = ["rates", "tears", "great", "eats", "tang", "garnets"];

beforeAll(async () => {
  game = await prisma.game.create({
    data: {
      slug,
      name: "Bee Test",
      sortOrder: 901,
      isActive: true,
      settings: { resolver: "puzzle", minWordLength: 4, rotation: "daily" },
    },
  });

  puzzlePayload = { centre: CENTRE, outer: LETTERS, pangram: "garnets" };
  await prisma.gamePuzzle.create({
    data: {
      gameId: game.id,
      externalId: `bee-${slug}`,
      title: "Test hive",
      payload: puzzlePayload,
    },
  });

  await prisma.wordEntry.createMany({
    data: [...DICTIONARY, "near", "table"].map((word) => ({
      gameId: game.id,
      word,
      normalized: word,
      length: word.length,
      isAnswerPool: false,
    })),
  });

  const guest = await prisma.guestSession.create({ data: { token: `${slug}-guest` } });
  player = { userId: null, guestId: guest.id };
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { slug } });
  await prisma.guestSession.deleteMany({ where: { token: { startsWith: slug } } });
  await prisma.$disconnect();
});

describe("bee scoring", () => {
  it("awards 1 point for four-letter words, length otherwise, plus a pangram bonus", () => {
    expect(scoreBeeWord("eats", puzzlePayload)).toBe(1);
    expect(scoreBeeWord("rates", puzzlePayload)).toBe(5);
    expect(scoreBeeWord("garnets", puzzlePayload)).toBe(14);
  });
});

describe("bee word list", () => {
  it("only accepts words that use the letters and include the centre", async () => {
    const stats = await getValidBeeWords(game.id, `bee-${slug}`, puzzlePayload);
    expect(stats.words.sort()).toEqual([...DICTIONARY].sort());
    expect(stats.pangrams).toEqual(["garnets"]);
    expect(stats.maxScore).toBe(31);
  });
});

describe("bee game", () => {
  let resultId = "";

  it("starts today's puzzle and locks it for the player", async () => {
    const view = await startBee(game, player);
    expect(view).not.toBeNull();
    expect(view?.centre).toBe(CENTRE);
    expect(view?.outer).toHaveLength(6);
    expect(view?.score).toBe(0);
    expect(view?.totalWords).toBe(DICTIONARY.length);
    expect(view?.maxScore).toBe(31);
    resultId = view!.resultId;

    const again = await startBee(game, player);
    expect(again?.resultId).toBe(resultId);
  });

  it("requires the centre letter", async () => {
    const outcome = await submitBeeWord(game, player, resultId, "near");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("centre letter");
  });

  it("rejects letters outside the hive", async () => {
    const outcome = await submitBeeWord(game, player, resultId, "table");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("seven given letters");
  });

  it("rejects words that are too short", async () => {
    const outcome = await submitBeeWord(game, player, resultId, "te");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("at least 4");
  });

  it("rejects well-formed words that are not in the dictionary", async () => {
    const outcome = await submitBeeWord(game, player, resultId, "tran");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("Not in word list");
  });

  it("accepts a valid word and updates the score", async () => {
    const outcome = await submitBeeWord(game, player, resultId, "rates");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.score).toBe(5);
    expect(outcome.isPangram).toBe(false);
    expect(outcome.view.found).toContain("rates");
    expect(outcome.view.score).toBe(5);
  });

  it("rejects duplicates", async () => {
    const outcome = await submitBeeWord(game, player, resultId, "rates");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("Already found");
  });

  it("flags a pangram and completes when every word is found", async () => {
    let last = await submitBeeWord(game, player, resultId, "garnets");
    expect(last.ok).toBe(true);
    if (last.ok) {
      expect(last.isPangram).toBe(true);
      expect(last.score).toBe(14);
    }

    for (const word of ["tears", "great", "eats", "tang"]) {
      last = await submitBeeWord(game, player, resultId, word);
    }

    expect(last.ok).toBe(true);
    if (last.ok) {
      expect(last.view.completed).toBe(true);
      expect(last.view.score).toBe(31);
      expect(last.view.found).toHaveLength(DICTIONARY.length);
    }
  });

  it("honours the configured minimum word length", async () => {
    await prisma.game.update({
      where: { id: game.id },
      data: { settings: { resolver: "puzzle", minWordLength: 5, rotation: "daily" } },
    });
    const strict = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });

    const view = await startBee(strict, player);
    expect(view).not.toBeNull();

    const outcome = await submitBeeWord(strict, player, view!.resultId, "eats");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("at least 5");

    await prisma.game.update({
      where: { id: game.id },
      data: { settings: { resolver: "puzzle", minWordLength: 4, rotation: "daily" } },
    });
  });
});
