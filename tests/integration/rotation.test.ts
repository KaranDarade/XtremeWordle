import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/prisma";
import { bucketKeyForMode, dailyBucketKey, twelveHourBucketKey } from "@/lib/time/buckets";
import { ensurePoolRotation, getUnlimitedAnswer, rotateAllGames } from "@/lib/words/rotation";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const slug = `rotation-game-${Date.now()}`;

let gameId = "";

beforeAll(async () => {
  const game = await prisma.game.create({
    data: {
      slug,
      name: "Rotation Game",
      sortOrder: 999,
      isActive: true,
      settings: {
        resolver: "word",
        answerLength: 5,
        rotation: "daily",
        unlimitedRotation: "twelve-hour",
      },
    },
  });
  gameId = game.id;

  await prisma.wordEntry.createMany({
    data: ["apple", "brave", "crane", "delta", "eagle", "flame"].map((word) => ({
      gameId,
      word,
      normalized: word,
      length: 5,
      isAnswerPool: true,
    })),
  });
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { slug } });
  await prisma.$disconnect();
});

describe("pool rotations", () => {
  it("creates a deterministic 12-hour pool snapshot exactly once", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
    const bucketKey = twelveHourBucketKey();

    const first = await ensurePoolRotation(game, bucketKey);
    const second = await ensurePoolRotation(game, bucketKey);

    expect(first.id).toBe(second.id);
    expect(first.seed).toHaveLength(32);
    expect(first.bucketKey).toBe(bucketKey);
  });
});

describe("getUnlimitedAnswer", () => {
  it("returns a word from the answer pool", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
    const answer = await getUnlimitedAnswer(game);
    const pool = await prisma.wordEntry.findMany({
      where: { gameId, isAnswerPool: true },
      select: { normalized: true },
    });
    expect(pool.map((row) => row.normalized)).toContain(answer);
  });

  it("avoids words already served in the same 12-hour window", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
    const bucketKey = twelveHourBucketKey();

    const pool = await prisma.wordEntry.findMany({
      where: { gameId, isAnswerPool: true },
      select: { normalized: true },
      orderBy: { normalized: "asc" },
    });
    // Mark every word except one as already served.
    const keep = pool[pool.length - 1].normalized;
    const consumed = pool.slice(0, -1);

    await prisma.gameResult.createMany({
      data: consumed.map((row) => ({
        gameId,
        mode: "UNLIMITED" as const,
        bucketKey,
        answer: row.normalized,
      })),
    });

    const answer = await getUnlimitedAnswer(game);
    expect(answer).toBe(keep);

    await prisma.gameResult.deleteMany({ where: { gameId, mode: "UNLIMITED" } });
  });
});

describe("rotateAllGames", () => {
  it("materialises current and next slots and is idempotent", async () => {
    const first = await rotateAllGames();
    const mine = first.find((entry) => entry.slug === slug);

    expect(mine).toBeDefined();
    expect(mine?.bucketKey).toBe(dailyBucketKey());
    expect(mine?.word).toBeTruthy();
    expect(mine?.poolBucket).toBe(twelveHourBucketKey());

    const second = await rotateAllGames();
    expect(second.find((entry) => entry.slug === slug)?.word).toBe(mine?.word);

    const tomorrow = bucketKeyForMode("daily", new Date(Date.now() + 86_400_000));
    const rows = await prisma.dailyPuzzle.findMany({
      where: { gameId, bucketKey: { in: [dailyBucketKey(), tomorrow] } },
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.source === "AUTO")).toHaveLength(2);
  });

  it("never overwrites a manual override", async () => {
    const admin = await prisma.user.create({
      data: { email: `rotation-admin-${Date.now()}@example.com`, passwordHash: "x", role: "ADMIN" },
    });

    const tomorrow = bucketKeyForMode("daily", new Date(Date.now() + 86_400_000));
    await prisma.dailyPuzzle.upsert({
      where: { gameId_bucketKey: { gameId, bucketKey: tomorrow } },
      update: { word: "zebra", normalized: "zebra", source: "MANUAL", createdByAdminId: admin.id },
      create: {
        gameId,
        bucketKey: tomorrow,
        word: "zebra",
        normalized: "zebra",
        source: "MANUAL",
        createdByAdminId: admin.id,
      },
    });

    await rotateAllGames();

    const row = await prisma.dailyPuzzle.findUniqueOrThrow({
      where: { gameId_bucketKey: { gameId, bucketKey: tomorrow } },
    });
    expect(row.source).toBe("MANUAL");
    expect(row.normalized).toBe("zebra");

    await prisma.user.delete({ where: { id: admin.id } });
  });
});
