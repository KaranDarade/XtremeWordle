import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/prisma";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const slug = `test-game-${Date.now()}`;

afterAll(async () => {
  await prisma.game.deleteMany({ where: { slug } });
  await prisma.$disconnect();
});

describe("database schema", () => {
  it("round-trips games, words, puzzles and results", async () => {
    const game = await prisma.game.create({
      data: { slug, name: "Test Game", settings: { resolver: "word" } },
    });
    expect(game.id).toBeTruthy();

    await prisma.wordEntry.createMany({
      data: [{ gameId: game.id, word: "apple", normalized: "apple", length: 5 }],
    });
    const words = await prisma.wordEntry.findMany({ where: { gameId: game.id } });
    expect(words).toHaveLength(1);

    const puzzle = await prisma.dailyPuzzle.create({
      data: {
        gameId: game.id,
        bucketKey: "2026-01-01",
        word: "apple",
        normalized: "apple",
      },
    });

    const result = await prisma.gameResult.create({
      data: {
        gameId: game.id,
        puzzleId: puzzle.id,
        bucketKey: "2026-01-01",
        guesses: ["crane", "apple"],
        solved: true,
        attempts: 2,
      },
    });
    expect(result.solved).toBe(true);
    expect(result.mode).toBe("DAILY");

    const guest = await prisma.guestSession.create({ data: { token: `guest-${Date.now()}` } });
    await prisma.gameResult.create({
      data: { gameId: game.id, guestId: guest.id, guesses: [], solved: false, attempts: 0 },
    });
    expect(await prisma.gameResult.count({ where: { gameId: game.id } })).toBe(2);
    await prisma.guestSession.delete({ where: { id: guest.id } });
  }, 30_000);

  it("enforces one puzzle per game per bucket", async () => {
    const game = await prisma.game.create({
      data: { slug: `${slug}-dup`, name: "Dup Game" },
    });

    await prisma.dailyPuzzle.create({
      data: { gameId: game.id, bucketKey: "2026-01-02", word: "alpha", normalized: "alpha" },
    });

    await expect(
      prisma.dailyPuzzle.create({
        data: { gameId: game.id, bucketKey: "2026-01-02", word: "bravo", normalized: "bravo" },
      }),
    ).rejects.toThrow();

    await prisma.game.delete({ where: { id: game.id } });
  }, 30_000);

  it("enforces unique word entries per game", async () => {
    const game = await prisma.game.create({
      data: { slug: `${slug}-words`, name: "Word Game" },
    });

    await prisma.wordEntry.create({
      data: { gameId: game.id, word: "crane", normalized: "crane" },
    });

    await expect(
      prisma.wordEntry.create({
        data: { gameId: game.id, word: "crane", normalized: "crane" },
      }),
    ).rejects.toThrow();

    await prisma.game.delete({ where: { id: game.id } });
  }, 30_000);
});
