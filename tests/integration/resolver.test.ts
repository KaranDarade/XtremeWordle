import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/prisma";
import {
  assignManualPuzzle,
  getPuzzle,
  previewPuzzle,
  regeneratePuzzle,
  resolvePuzzle,
} from "@/lib/words/resolver";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const slug = `resolver-game-${Date.now()}`;

let gameId = "";
let adminId = "";

beforeAll(async () => {
  const game = await prisma.game.create({
    data: {
      slug,
      name: "Resolver Game",
      settings: { resolver: "word", answerLength: 5 },
    },
  });
  gameId = game.id;

  const admin = await prisma.user.create({
    data: {
      email: `${slug}@example.com`,
      username: slug,
      passwordHash: "x",
      role: "ADMIN",
    },
  });
  adminId = admin.id;

  await prisma.wordEntry.createMany({
    data: ["apple", "brave", "crane", "delta", "eagle"].map((word) => ({
      gameId,
      word,
      normalized: word,
      length: 5,
    })),
  });
});

afterAll(async () => {
  await prisma.game.deleteMany({ where: { slug } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe("word resolver", () => {
  it("previews deterministically without persisting", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
    const first = await previewPuzzle(game, "2026-01-01");
    const second = await previewPuzzle(game, "2026-01-01");

    expect(first?.word).toBe(second?.word);
    expect(await getPuzzle(gameId, "2026-01-01")).toBeNull();
  });

  it("persists the auto word on first resolve and is idempotent", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
    const created = await resolvePuzzle(game, "2026-01-02");
    const again = await resolvePuzzle(game, "2026-01-02");

    expect(created?.source).toBe("AUTO");
    expect(again?.id).toBe(created?.id);
    expect(await prisma.dailyPuzzle.count({ where: { gameId, bucketKey: "2026-01-02" } })).toBe(1);
  });

  it("lets a manual assignment override auto rotation", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
    await resolvePuzzle(game, "2026-01-03");

    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    await assignManualPuzzle(gameId, "2026-01-03", "Zebra", admin.id);

    const resolved = await resolvePuzzle(game, "2026-01-03");
    expect(resolved?.source).toBe("MANUAL");
    expect(resolved?.normalized).toBe("zebra");
  });

  it("refuses to regenerate a manual slot unless forced", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });

    const skipped = await regeneratePuzzle(game, "2026-01-03");
    expect(skipped.skipped).toBe(true);
    expect(skipped.puzzle?.source).toBe("MANUAL");

    const forced = await regeneratePuzzle(game, "2026-01-03", { force: true });
    expect(forced.skipped).toBe(false);
    expect(forced.puzzle?.source).toBe("AUTO");
    expect(forced.puzzle?.normalized).not.toBe("zebra");
  });

  it("picks different words for different buckets", async () => {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug } });
    const words = new Set<string>();
    for (const bucket of ["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05"]) {
      const preview = await previewPuzzle(game, bucket);
      if (preview) words.add(preview.word);
    }
    expect(words.size).toBeGreaterThan(1);
  });
});
