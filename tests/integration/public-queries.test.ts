import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPublicGameBySlug, getPublicGames, getPublicStats } from "@/lib/games/public";
import { createPrismaClient } from "@/lib/prisma";
import { dailyBucketKey } from "@/lib/time/buckets";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const slug = `public-test-${Date.now()}`;

let gameId = "";
let guestSessionId = "";
let userId = "";

beforeAll(async () => {
  const game = await prisma.game.create({
    data: {
      slug,
      name: "Public Test Game",
      tagline: "Only visible when active",
      sortOrder: 950,
      isActive: true,
      settings: { resolver: "word", answerLength: 5 },
    },
  });
  gameId = game.id;

  await prisma.wordEntry.createMany({
    data: ["apple", "brave"].map((word) => ({
      gameId,
      word,
      normalized: word,
      length: 5,
      isAnswerPool: true,
    })),
  });

  await prisma.dailyPuzzle.upsert({
    where: { gameId_bucketKey: { gameId, bucketKey: dailyBucketKey() } },
    update: {},
    create: {
      gameId,
      bucketKey: dailyBucketKey(),
      word: "apple",
      normalized: "apple",
    },
  });

  const guest = await prisma.guestSession.create({ data: { token: `${slug}-guest` } });
  guestSessionId = guest.id;

  const user = await prisma.user.create({
    data: { email: `${slug}@example.com`, username: slug, passwordHash: "x" },
  });
  userId = user.id;

  await prisma.gameResult.create({
    data: {
      gameId,
      guestId: guest.id,
      mode: "DAILY",
      bucketKey: dailyBucketKey(),
      answer: "apple",
      solved: true,
      attempts: 3,
    },
  });
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { slug } });
  await prisma.guestSession.deleteMany({ where: { id: guestSessionId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("getPublicGames", () => {
  it("returns active games with play and word counts", async () => {
    const games = await getPublicGames();
    const mine = games.find((game) => game.slug === slug);

    expect(mine).toBeDefined();
    expect(mine?.name).toBe("Public Test Game");
    expect(mine?.wordCount).toBe(2);
    expect(mine?.playCount).toBe(1);
    expect(mine?.tagline).toBe("Only visible when active");
  });

  it("orders games by sortOrder", async () => {
    const games = await getPublicGames();
    const orders = games.map((game) => game.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("hides games that are switched off", async () => {
    await prisma.game.update({ where: { id: gameId }, data: { isActive: false } });

    const games = await getPublicGames();
    expect(games.some((game) => game.slug === slug)).toBe(false);

    await prisma.game.update({ where: { id: gameId }, data: { isActive: true } });
  });
});

describe("getPublicGameBySlug", () => {
  it("returns counts for a published game", async () => {
    const game = await getPublicGameBySlug(slug);
    expect(game?._count.wordEntries).toBe(2);
    expect(game?._count.gameResults).toBe(1);
    // A parallel test may run rotateAllGames(), which materialises slots for
    // every active game — so this can legitimately be higher than the fixture.
    expect(game?._count.dailyPuzzles).toBeGreaterThanOrEqual(1);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getPublicGameBySlug(`nope-${Date.now()}`)).toBeNull();
  });

  it("returns null when the game is inactive", async () => {
    await prisma.game.update({ where: { id: gameId }, data: { isActive: false } });
    expect(await getPublicGameBySlug(slug)).toBeNull();
    await prisma.game.update({ where: { id: gameId }, data: { isActive: true } });
  });
});

describe("getPublicStats", () => {
  it("summarises platform-wide numbers", async () => {
    const stats = await getPublicStats();
    expect(stats.gamesCount).toBeGreaterThanOrEqual(1);
    expect(stats.wordsCount).toBeGreaterThanOrEqual(2);
    expect(stats.playsCount).toBeGreaterThanOrEqual(1);
    expect(stats.playersCount).toBeGreaterThanOrEqual(1);
    expect(stats.puzzlesToday).toBeGreaterThanOrEqual(1);
  });
});
