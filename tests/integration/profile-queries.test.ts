import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/prisma";
import { getLeaderboard, getProfileForUser, getProfileForUsername } from "@/lib/profile/queries";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const run = Date.now().toString(36);

const winnerUsername = `winner-${run}`;
const loserUsername = `loser-${run}`;

let gameId = "";
let matchId = "";
let winnerId = "";
let loserId = "";

beforeAll(async () => {
  const game = await prisma.game.create({
    data: { slug: `arena-test-${run}`, name: "Arena Test", isActive: true, settings: {} },
  });
  gameId = game.id;

  const winner = await prisma.user.create({
    data: {
      email: `winner-${run}@example.com`,
      username: winnerUsername,
      name: "Winner",
      passwordHash: "x",
      rankPoints: 245,
      league: "SILVER",
      wins: 1,
      matchesPlayed: 1,
      currentStreak: 1,
      bestStreak: 1,
    },
  });
  winnerId = winner.id;

  const loser = await prisma.user.create({
    data: {
      email: `loser-${run}@example.com`,
      username: loserUsername,
      name: "Loser",
      passwordHash: "x",
      losses: 1,
      matchesPlayed: 1,
    },
  });
  loserId = loser.id;

  const match = await prisma.arenaMatch.create({
    data: {
      gameId,
      word: "crane",
      status: "FINISHED",
      finishedAt: new Date(),
      endReason: "solved",
      isCasual: false,
      players: {
        create: [
          {
            slot: 1,
            userId: winnerId,
            displayName: "Winner",
            username: winnerUsername,
            result: "WIN",
            solvedRound: 2,
            pointsDelta: 45,
            pointsBefore: 200,
            pointsAfter: 245,
          },
          {
            slot: 2,
            userId: loserId,
            displayName: "Loser",
            username: loserUsername,
            result: "LOSS",
            pointsDelta: -10,
            pointsBefore: 10,
            pointsAfter: 0,
          },
        ],
      },
    },
    include: { players: true },
  });

  matchId = match.id;
  await prisma.arenaMatch.update({
    where: { id: matchId },
    data: { winnerPlayerId: match.players.find((player) => player.result === "WIN")?.id ?? null },
  });
});

afterAll(async () => {
  await prisma.arenaMatch.deleteMany({ where: { id: matchId } });
  await prisma.user.deleteMany({ where: { id: { in: [winnerId, loserId] } } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.$disconnect();
});

describe("getProfileForUser", () => {
  it("builds the full profile bundle", async () => {
    const profile = await getProfileForUser(winnerId);
    expect(profile).not.toBeNull();
    if (!profile) return;

    expect(profile.identity.username).toBe(winnerUsername);
    expect(profile.identity.avatarConfig.version).toBe(1);

    expect(profile.record.played).toBe(1);
    expect(profile.record.wins).toBe(1);
    expect(profile.record.winRate).toBe(100);
    expect(profile.record.bestRound).toBe(2);

    expect(profile.league.name).toBe("SILVER");
    expect(profile.league.points).toBe(245);
    expect(profile.league.nextLeague).toBe("GOLD");
    expect(profile.league.pointsToNext).toBe(255);
    expect(profile.league.progress).toBeGreaterThan(0);
  });

  it("includes recent matches and head-to-head", async () => {
    const profile = await getProfileForUser(winnerId);
    if (!profile) throw new Error("expected a profile");

    expect(profile.recent).toHaveLength(1);
    expect(profile.recent[0].result).toBe("WIN");
    expect(profile.recent[0].opponent?.displayName).toBe("Loser");

    expect(profile.headToHead).toHaveLength(1);
    expect(profile.headToHead[0]).toMatchObject({ wins: 1, losses: 0, played: 1 });
  });

  it("returns null for an unknown user", async () => {
    expect(await getProfileForUser(`missing-${run}`)).toBeNull();
  });
});

describe("getProfileForUsername", () => {
  it("looks up case-insensitively", async () => {
    const profile = await getProfileForUsername(winnerUsername.toUpperCase());
    expect(profile?.identity.username).toBe(winnerUsername);
  });

  it("returns null when nobody owns the handle", async () => {
    expect(await getProfileForUsername(`nobody-${run}`)).toBeNull();
  });

  it("reflects a losing record", async () => {
    const profile = await getProfileForUsername(loserUsername);
    expect(profile?.record.losses).toBe(1);
    expect(profile?.record.winRate).toBe(0);
  });
});

describe("getLeaderboard", () => {
  it("orders by rank points and skips zero-point players", async () => {
    const board = await getLeaderboard(100);
    const winnerIndex = board.findIndex((entry) => entry.username === winnerUsername);
    const loserIndex = board.findIndex((entry) => entry.username === loserUsername);

    expect(winnerIndex).toBeGreaterThanOrEqual(0);
    expect(loserIndex).toBe(-1);

    const points = board.map((entry) => entry.rankPoints);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });
});
