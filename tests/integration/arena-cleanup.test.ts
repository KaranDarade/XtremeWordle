import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cleanupArena } from "@/lib/arena/cleanup";
import { createPrismaClient } from "@/lib/prisma";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const run = Date.now().toString(36);

let gameId = "";
let userId = "";

const stale = `stale-${run}`;
const fresh = `fresh-${run}`;
const queueToken = `queue-${run}`;
const presenceKey = `presence-${run}`;
const otpEmail = `otp-${run}@example.com`;

async function createPlayingMatch(slug: string, startedAt: Date) {
  return prisma.arenaMatch.create({
    data: {
      gameId,
      word: "crane",
      status: "PLAYING",
      startedAt,
      roundCount: 6,
      roundMs: 1000,
      breakMs: 500,
      countdownMs: 500,
      isCasual: true,
      players: {
        create: [
          { slot: 1, userId, displayName: "Solo", result: null, bestGreens: 1, bestYellows: 0 },
          { slot: 2, displayName: "Ghost", bestGreens: 0, bestYellows: 0 },
        ],
      },
    },
    include: { players: true },
  });
}

beforeAll(async () => {
  const game = await prisma.game.create({
    data: { slug: `cleanup-${run}`, name: "Cleanup", isActive: true, settings: {} },
  });
  gameId = game.id;

  const user = await prisma.user.create({
    data: {
      email: `cleanup-${run}@example.com`,
      username: `cleanup-${run}`,
      passwordHash: "x",
    },
  });
  userId = user.id;

  await prisma.guestSession.create({ data: { token: queueToken } });
  await prisma.presence.create({
    data: {
      key: presenceKey,
      userId,
      status: "BROWSING",
      lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  });
  await prisma.passwordResetOtp.create({
    data: {
      email: otpEmail,
      otpHash: "x",
      expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });
});

afterAll(async () => {
  await prisma.arenaMatch.deleteMany({ where: { gameId } });
  await prisma.arenaQueue.deleteMany({ where: { displayName: { contains: run } } });
  await prisma.presence.deleteMany({ where: { key: presenceKey } });
  await prisma.passwordResetOtp.deleteMany({ where: { email: otpEmail } });
  await prisma.guestSession.deleteMany({ where: { token: queueToken } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.$disconnect();
});

describe("cleanupArena", () => {
  it("finalises matches whose clock has run out", async () => {
    const match = await createPlayingMatch(stale, new Date(Date.now() - 60 * 60 * 1000));

    await cleanupArena();

    const after = await prisma.arenaMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(after.status).toBe("FINISHED");
    expect(after.endReason).toBe("closest");
    expect(after.winnerPlayerId).toBe(match.players.find((p) => p.displayName === "Solo")?.id);
  });

  it("leaves a match that is still running alone", async () => {
    const match = await createPlayingMatch(fresh, new Date());

    await cleanupArena();

    const after = await prisma.arenaMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(after.status).toBe("PLAYING");
  });

  it("removes stale queue entries, presence and expired codes", async () => {
    const guest = await prisma.guestSession.findUniqueOrThrow({ where: { token: queueToken } });

    // Fresh fixtures so the earlier cases cannot have consumed them.
    await prisma.arenaQueue.create({
      data: {
        guestId: guest.id,
        displayName: `Stale ${run}`,
        lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });
    await prisma.presence.create({
      data: {
        key: `${presenceKey}-b`,
        userId,
        status: "BROWSING",
        lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });
    await prisma.passwordResetOtp.create({
      data: {
        email: `${otpEmail}-b`,
        otpHash: "x",
        expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    await createPlayingMatch(`${stale}-b`, new Date(Date.now() - 60 * 60 * 1000));

    const summary = await cleanupArena();

    expect(summary.matchesFinalized).toBeGreaterThanOrEqual(1);
    expect(summary.queueRemoved).toBeGreaterThanOrEqual(1);
    expect(summary.presenceRemoved).toBeGreaterThanOrEqual(1);
    expect(summary.otpsRemoved).toBeGreaterThanOrEqual(1);

    await prisma.presence.deleteMany({ where: { key: `${presenceKey}-b` } });
    await prisma.passwordResetOtp.deleteMany({ where: { email: `${otpEmail}-b` } });
  });
});
