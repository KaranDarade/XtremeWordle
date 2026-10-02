import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ARENA_DEFAULTS } from "@/lib/arena/config";
import {
  createBotMatch,
  getArenaState,
  joinQueue,
  pairQueue,
  resolveArenaIdentity,
  submitArenaGuess,
} from "@/lib/arena/engine";
import { createPrismaClient } from "@/lib/prisma";

const prisma = createPrismaClient(process.env.TEST_DATABASE_URL);
const run = Date.now().toString(36);

const WORDS = ["crane", "slate", "brave", "audio", "eagle"];

let gameId = "";
let alphaId = "";
let betaId = "";
let guestToken = "";

const alphaIdentity = {
  userId: null as string | null,
  guestId: null as string | null,
  displayName: "Alpha",
  username: `alpha-${run}`,
  avatarSeed: null,
  league: "BRONZE" as const,
  rankPoints: 0,
  signedIn: true,
};

const betaIdentity = { ...alphaIdentity, displayName: "Beta", username: `beta-${run}` };

beforeAll(async () => {
  await prisma.game.deleteMany({ where: { slug: "wordle" } });

  const game = await prisma.game.create({
    data: { slug: "wordle", name: "Wordle", isActive: true, settings: {} },
  });
  gameId = game.id;

  await prisma.wordEntry.createMany({
    data: WORDS.map((word) => ({
      gameId,
      word,
      normalized: word,
      length: 5,
      isAnswerPool: true,
      isActive: true,
    })),
  });

  const [alpha, beta] = await Promise.all([
    prisma.user.create({
      data: {
        email: `alpha-${run}@example.com`,
        username: `alpha-${run}`,
        name: "Alpha",
        passwordHash: "x",
        rankPoints: 199,
        league: "BRONZE",
      },
    }),
    prisma.user.create({
      data: {
        email: `beta-${run}@example.com`,
        username: `beta-${run}`,
        name: "Beta",
        passwordHash: "x",
        rankPoints: 1500,
        league: "PLATINUM",
      },
    }),
  ]);

  alphaId = alpha.id;
  betaId = beta.id;
  alphaIdentity.userId = alpha.id;
  betaIdentity.userId = beta.id;

  const guest = await prisma.guestSession.create({
    data: { token: `guest-${run}` },
  });
  guestToken = guest.id;
});

afterAll(async () => {
  await prisma.arenaMatch.deleteMany({ where: { gameId } });
  await prisma.user.deleteMany({ where: { id: { in: [alphaId, betaId] } } });
  await prisma.guestSession.deleteMany({ where: { token: `guest-${run}` } });
  await prisma.game.deleteMany({ where: { id: gameId } });
  await prisma.$disconnect();
});

/** Shifts a match's clock so it sits inside a given round's play window. */
async function seekToRound(matchId: string, round: number) {
  const offset =
    ARENA_DEFAULTS.countdownMs + (round - 1) * (ARENA_DEFAULTS.roundMs + ARENA_DEFAULTS.breakMs);
  await prisma.arenaMatch.update({
    where: { id: matchId },
    data: { startedAt: new Date(Date.now() - offset - 1500) },
  });
}

/** Pins the answer so guesses can be chosen deterministically. */
async function setWord(matchId: string, word = "eagle") {
  await prisma.arenaMatch.update({ where: { id: matchId }, data: { word } });
}

async function createDuel() {
  await joinQueue(alphaIdentity);
  await joinQueue(betaIdentity);
  const matchId = await pairQueue(alphaIdentity);
  if (!matchId) throw new Error("pairing failed");
  return matchId;
}

/** A duel whose answer is "eagle", so these guesses are always wrong. */
async function createSeededDuel() {
  const matchId = await createDuel();
  await setWord(matchId, "eagle");
  return matchId;
}

describe("queue and pairing", () => {
  it("pairs two waiting players and flags the match ranked", async () => {
    const matchId = await createDuel();
    const match = await prisma.arenaMatch.findUniqueOrThrow({
      where: { id: matchId },
      include: { players: true },
    });

    expect(match.status).toBe("PLAYING");
    expect(match.isCasual).toBe(false);
    expect(match.players).toHaveLength(2);
    expect(WORDS).toContain(match.word);

    const queued = await prisma.arenaQueue.findMany({
      where: { matchId },
    });
    expect(queued.every((row) => row.status === "MATCHED")).toBe(true);
  });

  it("marks a duel with a guest as casual", async () => {
    const guest = await resolveArenaIdentity({ userId: null, guestId: guestToken });
    if (!guest) throw new Error("guest identity missing");

    await joinQueue(alphaIdentity);
    await joinQueue(guest);
    const matchId = await pairQueue(alphaIdentity);
    if (!matchId) throw new Error("pairing failed");

    const match = await prisma.arenaMatch.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.isCasual).toBe(true);
  });
});

describe("guessing", () => {
  it("rejects words that are not in the dictionary or the wrong length", async () => {
    const matchId = await createSeededDuel();
    await seekToRound(matchId, 1);

    const bad = await submitArenaGuess(matchId, alphaIdentity, "zzzzz");
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("Not in word list");

    const short = await submitArenaGuess(matchId, alphaIdentity, "cat");
    expect(short.ok).toBe(false);
    expect(short.error).toContain("5-letter");
  });

  it("locks one guess per round", async () => {
    const matchId = await createSeededDuel();
    await seekToRound(matchId, 1);

    const first = await submitArenaGuess(matchId, alphaIdentity, "slate");
    expect(first.ok).toBe(true);

    const second = await submitArenaGuess(matchId, alphaIdentity, "brave");
    expect(second.ok).toBe(false);
    expect(second.error).toContain("already guessed");
  });

  it("hides the opponent's current-round guess but reveals finished rounds", async () => {
    const matchId = await createSeededDuel();
    await seekToRound(matchId, 1);
    await submitArenaGuess(matchId, alphaIdentity, "slate");

    const betaSees = await getArenaState(matchId, betaIdentity);
    expect(betaSees?.board).toHaveLength(0);

    await seekToRound(matchId, 2);
    const afterRound = await getArenaState(matchId, betaIdentity);
    expect(afterRound?.board).toHaveLength(1);
    expect(afterRound?.board[0].guess).toBe("slate");
    expect(afterRound?.board[0].mine).toBe(false);
  });

  it("refuses guesses once the round has closed", async () => {
    const matchId = await createSeededDuel();
    // Sit inside the reveal break of round 1.
    const offset = ARENA_DEFAULTS.countdownMs + ARENA_DEFAULTS.roundMs + 1000;
    await prisma.arenaMatch.update({
      where: { id: matchId },
      data: { startedAt: new Date(Date.now() - offset) },
    });

    const outcome = await submitArenaGuess(matchId, alphaIdentity, "slate");
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("closed");
  });
});

describe("winner and scoring", () => {
  it("finishes immediately when a player solves and awards league points", async () => {
    const matchId = await createSeededDuel();
    await seekToRound(matchId, 2);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: alphaId } });
    const solved = await submitArenaGuess(matchId, alphaIdentity, "eagle");
    expect(solved.ok).toBe(true);

    const after = await prisma.arenaMatch.findUniqueOrThrow({
      where: { id: matchId },
      include: { players: true },
    });
    expect(after.status).toBe("FINISHED");
    expect(after.endReason).toBe("solved");
    expect(after.winnerPlayerId).toBe(after.players.find((p) => p.userId === alphaId)?.id);

    const alphaPlayer = after.players.find((player) => player.userId === alphaId)!;
    const betaPlayer = after.players.find((player) => player.userId === betaId)!;

    // Bronze win, solved on round 2: 30 * 1.0 + 20 bonus.
    expect(alphaPlayer.pointsDelta).toBe(50);
    expect(alphaPlayer.result).toBe("WIN");
    expect(betaPlayer.result).toBe("LOSS");
    expect(betaPlayer.pointsDelta).toBeLessThan(0);

    const alpha = await prisma.user.findUniqueOrThrow({ where: { id: alphaId } });
    expect(alpha.rankPoints - before.rankPoints).toBe(50);
    expect(alpha.wins).toBeGreaterThanOrEqual(1);
    expect(alpha.currentStreak).toBeGreaterThanOrEqual(1);
  });

  it("resolves a solved-out match on the closest guess", async () => {
    const matchId = await createSeededDuel();
    await seekToRound(matchId, 1);
    await submitArenaGuess(matchId, alphaIdentity, "slate");
    await seekToRound(matchId, 2);
    await submitArenaGuess(matchId, betaIdentity, "crane");

    // Jump past the final round.
    await prisma.arenaMatch.update({
      where: { id: matchId },
      data: { startedAt: new Date(Date.now() - 10 * 60_000) },
    });

    const state = await getArenaState(matchId, alphaIdentity);
    expect(state?.status).toBe("FINISHED");
    expect(state?.endReason).toBe("closest");
    expect(state?.word).toBeTruthy();
  });

  it("awards a forfeit when the opponent goes silent", async () => {
    const matchId = await createDuel();
    await seekToRound(matchId, 1);

    const betaPlayer = await prisma.arenaPlayer.findFirstOrThrow({
      where: { matchId, userId: betaId },
    });
    await prisma.arenaPlayer.update({
      where: { id: betaPlayer.id },
      data: { lastSeenAt: new Date(Date.now() - 60_000) },
    });

    const state = await getArenaState(matchId, alphaIdentity);
    expect(state?.status).toBe("FINISHED");
    expect(state?.endReason).toBe("forfeit");
    expect(state?.winnerPlayerId).toBe(state?.me.playerId);
  });
});

describe("bot matches", () => {
  it("plays the bot lazily as the clock advances", async () => {
    const matchId = await createBotMatch(alphaIdentity);
    expect(matchId).toBeTruthy();

    const bot = await prisma.arenaPlayer.findFirstOrThrow({
      where: { matchId: matchId!, isBot: true },
    });

    // Nothing yet during the countdown.
    await getArenaState(matchId!, alphaIdentity);
    expect(await prisma.arenaGuess.count({ where: { playerId: bot.id } })).toBe(0);

    // Jump far enough that several bot turns are due.
    await prisma.arenaMatch.update({
      where: { id: matchId! },
      data: { startedAt: new Date(Date.now() - 3 * 60_000) },
    });

    const state = await getArenaState(matchId!, alphaIdentity);
    const guesses = await prisma.arenaGuess.findMany({ where: { playerId: bot.id } });
    expect(guesses.length).toBeGreaterThan(0);
    expect(state?.status).toBe("FINISHED");
    expect(state?.isCasual).toBe(true);
    expect(state?.opponent.isBot).toBe(true);
  });

  it("never changes rank points in a casual match", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: alphaId } });
    const matchId = await createBotMatch(alphaIdentity);

    await prisma.arenaMatch.update({
      where: { id: matchId! },
      data: { startedAt: new Date(Date.now() - 10 * 60_000) },
    });
    await getArenaState(matchId!, alphaIdentity);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: alphaId } });
    expect(after.rankPoints).toBe(before.rankPoints);
  });
});
