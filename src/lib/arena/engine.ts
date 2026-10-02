import type { Prisma } from "@/generated/prisma/client";
import { avatarFromSeed, type AvatarConfig } from "@/lib/avatar/config";
import { prisma } from "@/lib/db";
import type { Identity } from "@/lib/session/identity";
import { evaluateGuess, type LetterFeedback } from "@/lib/words/feedback";

import { botGuess, botNameFor, botSubmitOffsetMs, type BotFeedbackRow } from "./bot";
import { matchClock, roundForGuess, roundWindow, type MatchTiming } from "./clock";
import {
  ARENA_QUEUE,
  arenaTimings,
  clampRankPoints,
  leagueForPoints,
  pointsForResult,
  type LeagueName,
} from "./config";

const WORDLE_SLUG = "wordle";

// ------------------------------------------------------------------ identity

export interface ArenaIdentity {
  userId: string | null;
  guestId: string | null;
  displayName: string;
  username: string | null;
  avatarSeed: string | null;
  league: LeagueName;
  rankPoints: number;
  signedIn: boolean;
}

export async function resolveArenaIdentity(identity: Identity): Promise<ArenaIdentity | null> {
  if (identity.userId) {
    const user = await prisma.user.findUnique({
      where: { id: identity.userId },
      select: { id: true, name: true, username: true, league: true, rankPoints: true },
    });
    if (!user) return null;
    return {
      userId: user.id,
      guestId: null,
      displayName: user.name ?? user.username,
      username: user.username,
      avatarSeed: null,
      league: user.league as LeagueName,
      rankPoints: user.rankPoints,
      signedIn: true,
    };
  }

  if (identity.guestId) {
    const guest = await prisma.guestSession.findUnique({
      where: { id: identity.guestId },
      select: { id: true, token: true },
    });
    if (!guest) return null;
    return {
      userId: null,
      guestId: guest.id,
      displayName: `Guest ${guest.token.slice(0, 4).toUpperCase()}`,
      username: null,
      avatarSeed: guest.token,
      league: "BRONZE",
      rankPoints: 0,
      signedIn: false,
    };
  }

  return null;
}

function avatarFor(player: {
  avatarSeed: string | null;
  user: { avatarConfig: unknown } | null;
}): AvatarConfig {
  if (player.user?.avatarConfig) {
    return player.user.avatarConfig as AvatarConfig;
  }
  if (player.avatarSeed) return avatarFromSeed(player.avatarSeed);
  return avatarFromSeed("wordle-arena");
}

// --------------------------------------------------------------------- queue

export async function joinQueue(identity: ArenaIdentity): Promise<void> {
  await prisma.arenaQueue.deleteMany({
    where: {
      status: "WAITING",
      ...(identity.userId ? { userId: identity.userId } : { guestId: identity.guestId }),
    },
  });

  await prisma.arenaQueue.create({
    data: {
      userId: identity.userId,
      guestId: identity.guestId,
      displayName: identity.displayName,
      username: identity.username,
      avatarSeed: identity.avatarSeed,
      league: identity.league,
    },
  });
}

export async function leaveQueue(identity: ArenaIdentity): Promise<void> {
  await prisma.arenaQueue.deleteMany({
    where: {
      ...(identity.userId ? { userId: identity.userId } : { guestId: identity.guestId }),
    },
  });
}

export async function findMyQueue(identity: ArenaIdentity) {
  return prisma.arenaQueue.findFirst({
    where: identity.userId ? { userId: identity.userId } : { guestId: identity.guestId },
    orderBy: { joinedAt: "desc" },
  });
}

async function wordleGame() {
  return prisma.game.findFirst({ where: { slug: WORDLE_SLUG, isActive: true } });
}

async function pickArenaWord(): Promise<string | null> {
  const game = await wordleGame();
  if (!game) return null;

  const total = await prisma.wordEntry.count({
    where: { gameId: game.id, isAnswerPool: true, isActive: true },
  });
  if (total === 0) return null;

  const skip = Math.floor(Math.random() * total);
  const row = await prisma.wordEntry.findFirst({
    where: { gameId: game.id, isAnswerPool: true, isActive: true },
    orderBy: { word: "asc" },
    skip,
  });
  return row?.normalized ?? null;
}

/**
 * Pairs two waiting players atomically.
 *
 * `FOR UPDATE SKIP LOCKED` on both my row and the candidate's row guarantees
 * two simultaneous polls can never claim the same opponent.
 */
export async function pairQueue(identity: ArenaIdentity): Promise<string | null> {
  const mine = await findMyQueue(identity);
  if (!mine || mine.status !== "WAITING") return null;

  const cutoff = new Date(Date.now() - ARENA_QUEUE.staleMs);

  const matchId = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ArenaQueue"
      WHERE id = ${mine.id} AND status = 'WAITING'
      FOR UPDATE SKIP LOCKED
    `;
    if (locked.length === 0) return null;

    const candidates = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ArenaQueue"
      WHERE status = 'WAITING'
        AND id <> ${mine.id}
        AND "lastSeenAt" > ${cutoff}
      ORDER BY "joinedAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    if (candidates.length === 0) return null;

    const opponentRow = await tx.arenaQueue.findUnique({ where: { id: candidates[0].id } });
    if (!opponentRow) return null;

    const game = await tx.game.findFirst({ where: { slug: WORDLE_SLUG, isActive: true } });
    if (!game) return null;

    const total = await tx.wordEntry.count({
      where: { gameId: game.id, isAnswerPool: true, isActive: true },
    });
    if (total === 0) return null;
    const wordRow = await tx.wordEntry.findFirst({
      where: { gameId: game.id, isAnswerPool: true, isActive: true },
      orderBy: { word: "asc" },
      skip: Math.floor(Math.random() * total),
    });
    if (!wordRow) return null;

    const bothSignedIn = Boolean(mine.userId && opponentRow.userId);

    const created = await tx.arenaMatch.create({
      data: {
        gameId: game.id,
        word: wordRow.normalized,
        ...arenaTimings(),
        isCasual: !bothSignedIn,
        players: {
          create: [
            {
              slot: 1,
              userId: mine.userId,
              guestId: mine.guestId,
              displayName: mine.displayName,
              username: mine.username,
              avatarSeed: mine.avatarSeed,
              league: mine.league,
              pointsBefore: mine.userId
                ? ((
                    await tx.user.findUnique({
                      where: { id: mine.userId },
                      select: { rankPoints: true },
                    })
                  )?.rankPoints ?? 0)
                : 0,
            },
            {
              slot: 2,
              userId: opponentRow.userId,
              guestId: opponentRow.guestId,
              displayName: opponentRow.displayName,
              username: opponentRow.username,
              avatarSeed: opponentRow.avatarSeed,
              league: opponentRow.league,
              pointsBefore: opponentRow.userId
                ? ((
                    await tx.user.findUnique({
                      where: { id: opponentRow.userId },
                      select: { rankPoints: true },
                    })
                  )?.rankPoints ?? 0)
                : 0,
            },
          ],
        },
      },
    });

    await tx.arenaQueue.updateMany({
      where: { id: { in: [mine.id, opponentRow.id] } },
      data: { status: "MATCHED", matchId: created.id },
    });

    return created.id;
  });

  return matchId;
}

/** Creates a match against the bot, used when nobody else is waiting. */
export async function createBotMatch(identity: ArenaIdentity): Promise<string | null> {
  const game = await wordleGame();
  if (!game) return null;

  const word = await pickArenaWord();
  if (!word) return null;

  const seed = `bot:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

  const match = await prisma.arenaMatch.create({
    data: {
      gameId: game.id,
      word,
      ...arenaTimings(),
      isCasual: true,
      players: {
        create: [
          {
            slot: 1,
            userId: identity.userId,
            guestId: identity.guestId,
            displayName: identity.displayName,
            username: identity.username,
            avatarSeed: identity.avatarSeed,
            league: identity.league,
            pointsBefore: identity.rankPoints,
          },
          {
            slot: 2,
            isBot: true,
            displayName: botNameFor(seed),
            avatarSeed: `bot:${seed}`,
            league: identity.league,
          },
        ],
      },
    },
  });

  await prisma.arenaQueue.deleteMany({
    where: identity.userId ? { userId: identity.userId } : { guestId: identity.guestId },
  });

  return match.id;
}

// --------------------------------------------------------------------- state

import type { ArenaBoardRow, ArenaState } from "./view";
export type { ArenaBoardRow, ArenaState } from "./view";

function timingOf(match: {
  startedAt: Date;
  roundCount: number;
  roundMs: number;
  breakMs: number;
  countdownMs: number;
}): MatchTiming {
  return {
    startedAt: match.startedAt,
    roundCount: match.roundCount,
    roundMs: match.roundMs,
    breakMs: match.breakMs,
    countdownMs: match.countdownMs,
  };
}

type MatchWithRelations = Prisma.ArenaMatchGetPayload<{
  include: {
    players: { include: { user: { select: { avatarConfig: true } }; guesses: true } };
    guesses: true;
    reactions: true;
  };
}>;

function myPlayer(match: MatchWithRelations, identity: ArenaIdentity) {
  return (
    match.players.find(
      (player) =>
        (identity.userId && player.userId === identity.userId) ||
        (identity.guestId && player.guestId === identity.guestId),
    ) ?? null
  );
}

function ownsPlayer(
  player: { userId: string | null; guestId: string | null },
  identity: ArenaIdentity,
): boolean {
  if (identity.userId) return player.userId === identity.userId;
  if (identity.guestId) return player.guestId === identity.guestId;
  return false;
}

function buildState(match: MatchWithRelations, identity: ArenaIdentity, now: Date): ArenaState {
  const clock = matchClock(timingOf(match), now);
  const me = myPlayer(match, identity);
  const opponent = match.players.find((player) => !me || player.id !== me.id) ?? null;

  const board: ArenaBoardRow[] = match.guesses
    .map((guess) => {
      const isMine = Boolean(me && guess.playerId === me.id);
      const revealed = isMine || match.status === "FINISHED" || guess.round < clock.round;

      if (!revealed) return null;

      return {
        round: guess.round,
        guess: guess.guess,
        feedback: (guess.feedback as LetterFeedback[]) ?? [],
        correct: guess.correct,
        mine: isMine,
      } satisfies ArenaBoardRow;
    })
    .filter((row): row is ArenaBoardRow => row !== null);

  return {
    matchId: match.id,
    status: match.status,
    version: match.version,
    serverNow: now.getTime(),
    phase: clock.phase,
    round: clock.round,
    roundCount: match.roundCount,
    roundMs: match.roundMs,
    breakMs: match.breakMs,
    msRemaining: clock.msRemaining,
    phaseProgress: clock.phaseProgress,
    playEndsAt: clock.playEndsAt.getTime(),
    roundEndsAt: clock.roundEndsAt.getTime(),
    word: match.status === "FINISHED" ? match.word : null,
    endReason: match.endReason,
    winnerPlayerId: match.winnerPlayerId,
    isDraw: match.isDraw,
    isCasual: match.isCasual,
    canGuess:
      match.status === "PLAYING" &&
      clock.phase === "play" &&
      Boolean(me) &&
      !(me?.guesses ?? []).some((guess) => guess.round === clock.round),
    me: {
      playerId: me?.id ?? "",
      displayName: me?.displayName ?? "You",
      league: (me?.league ?? "BRONZE") as LeagueName,
      avatar: me
        ? avatarFor({ avatarSeed: me.avatarSeed, user: me.user })
        : avatarFromSeed(identity.avatarSeed ?? "you"),
      pointsDelta: me?.pointsDelta ?? 0,
      result: me?.result ?? null,
      solvedRound: me?.solvedRound ?? null,
      guessedRounds: (me?.guesses ?? []).map((guess) => guess.round),
    },
    opponent: {
      playerId: opponent?.id ?? "",
      displayName: opponent?.displayName ?? "Waiting…",
      league: (opponent?.league ?? "BRONZE") as LeagueName,
      avatar: opponent
        ? avatarFor({ avatarSeed: opponent.avatarSeed, user: opponent.user })
        : avatarFromSeed("opponent"),
      isBot: opponent?.isBot ?? false,
      solvedRound: opponent?.solvedRound ?? null,
      guessedRounds: (opponent?.guesses ?? []).map((guess) => guess.round),
      connected: opponent
        ? now.getTime() - opponent.lastSeenAt.getTime() < ARENA_QUEUE.forfeitMs
        : false,
    },
    board,
    reactions: match.reactions.slice(-6).map((reaction) => ({
      from: me && reaction.playerId === me.id ? ("me" as const) : ("opponent" as const),
      emoji: reaction.emoji,
      at: reaction.createdAt.getTime(),
    })),
  };
}

async function loadMatch(matchId: string): Promise<MatchWithRelations | null> {
  return prisma.arenaMatch.findUnique({
    where: { id: matchId },
    include: {
      players: { include: { user: { select: { avatarConfig: true } }, guesses: true } },
      guesses: true,
      reactions: true,
    },
  });
}

// ----------------------------------------------------------------- finalizing

export interface OutcomePlayer {
  id: string;
  solvedAt: Date | null;
  bestGreens: number;
  bestYellows: number;
  bestAt: Date | null;
}

export interface MatchOutcome {
  winnerPlayerId: string | null;
  reason: "solved" | "closest" | "draw";
  isDraw: boolean;
}

/**
 * Single source of truth for who won.
 *
 * Order: an actual solve (earliest `solvedAt` wins), then the closest guess
 * (most greens, then most yellows, then the earlier submission), then a draw.
 * Used by live finalisation, the admin force-end and the cleanup job.
 */
export function resolveOutcome(players: OutcomePlayer[]): MatchOutcome {
  const solver = players
    .filter((player) => player.solvedAt)
    .sort((a, b) => (a.solvedAt?.getTime() ?? 0) - (b.solvedAt?.getTime() ?? 0))[0];

  if (solver) return { winnerPlayerId: solver.id, reason: "solved", isDraw: false };

  const ranked = [...players].sort((a, b) => {
    if (b.bestGreens !== a.bestGreens) return b.bestGreens - a.bestGreens;
    if (b.bestYellows !== a.bestYellows) return b.bestYellows - a.bestYellows;
    return (
      (a.bestAt?.getTime() ?? Number.POSITIVE_INFINITY) -
      (b.bestAt?.getTime() ?? Number.POSITIVE_INFINITY)
    );
  });

  const [best, second] = ranked;
  if (!best) return { winnerPlayerId: null, reason: "draw", isDraw: true };

  const identical =
    second !== undefined &&
    best.bestGreens === second.bestGreens &&
    best.bestYellows === second.bestYellows &&
    (best.bestAt?.getTime() ?? 0) === (second.bestAt?.getTime() ?? 0);

  // Nobody guessed at all, or the best rows are indistinguishable.
  if (identical || (best.bestGreens === 0 && best.bestYellows === 0)) {
    return { winnerPlayerId: null, reason: "draw", isDraw: true };
  }

  return { winnerPlayerId: best.id, reason: "closest", isDraw: false };
}

export async function finalizeMatch(
  matchId: string,
  winnerPlayerId: string | null,
  endReason: string,
  isDraw: boolean,
): Promise<void> {
  const match = await prisma.arenaMatch.findUnique({
    where: { id: matchId },
    include: { players: true },
  });
  if (!match || match.status !== "PLAYING") return;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const player of match.players) {
      let result: "WIN" | "LOSS" | "DRAW" | null = null;
      if (isDraw) result = "DRAW";
      else if (winnerPlayerId) result = player.id === winnerPlayerId ? "WIN" : "LOSS";

      let pointsDelta = 0;
      if (result && !match.isCasual && player.userId) {
        pointsDelta = pointsForResult({
          result,
          league: player.league as LeagueName,
          solvedRound: player.solvedRound,
        });
      }

      const pointsAfter = clampRankPoints(player.pointsBefore + pointsDelta);

      await tx.arenaPlayer.update({
        where: { id: player.id },
        data: {
          result,
          pointsDelta,
          pointsAfter: player.userId && !match.isCasual ? pointsAfter : player.pointsBefore,
        },
      });

      if (result && player.userId) {
        const user = await tx.user.findUnique({
          where: { id: player.userId },
          select: { currentStreak: true, bestStreak: true, rankPoints: true },
        });
        if (!user) continue;

        const nextRank = match.isCasual ? user.rankPoints : pointsAfter;
        const nextStreak = result === "WIN" ? user.currentStreak + 1 : 0;

        await tx.user.update({
          where: { id: player.userId },
          data: {
            rankPoints: nextRank,
            league: leagueForPoints(nextRank),
            matchesPlayed: { increment: 1 },
            wins: result === "WIN" ? { increment: 1 } : undefined,
            losses: result === "LOSS" ? { increment: 1 } : undefined,
            draws: result === "DRAW" ? { increment: 1 } : undefined,
            currentStreak: nextStreak,
            bestStreak: Math.max(user.bestStreak, nextStreak),
          },
        });
      }
    }

    await tx.arenaMatch.update({
      where: { id: matchId },
      data: {
        status: "FINISHED",
        finishedAt: now,
        winnerPlayerId,
        isDraw,
        endReason,
        version: { increment: 1 },
      },
    });
  });
}

// ------------------------------------------------------------------- guesses

export interface GuessOutcome {
  ok: boolean;
  error?: string;
  state?: ArenaState;
}

export async function submitArenaGuess(
  matchId: string,
  identity: ArenaIdentity,
  rawGuess: string,
): Promise<GuessOutcome> {
  const match = await loadMatch(matchId);
  if (!match) return { ok: false, error: "Match not found." };

  const me = myPlayer(match, identity);
  if (!me) return { ok: false, error: "You are not in this match." };
  if (me.isBot) return { ok: false, error: "Bots do not submit through this endpoint." };
  if (match.status !== "PLAYING") return { ok: false, error: "This match has finished." };

  const now = new Date();
  const timing = timingOf(match);
  const { round, accepted } = roundForGuess(timing, now);
  if (!accepted) return { ok: false, error: "That round is closed." };

  if (me.guesses.some((guess) => guess.round === round)) {
    return { ok: false, error: "You already guessed this round." };
  }

  const guess = rawGuess.trim().toLowerCase();
  if (!/^[a-z]+$/.test(guess) || guess.length !== match.word.length) {
    return { ok: false, error: `Enter a ${match.word.length}-letter word.` };
  }

  const known = await prisma.wordEntry.findFirst({
    where: { gameId: match.gameId, normalized: guess },
    select: { id: true },
  });
  if (!known) return { ok: false, error: "Not in word list." };

  const feedback = evaluateGuess(match.word, guess);
  const correct = guess === match.word;
  const greens = feedback.filter((value) => value === "correct").length;
  const yellows = feedback.filter((value) => value === "present").length;

  try {
    await prisma.arenaGuess.create({
      data: {
        matchId: match.id,
        playerId: me.id,
        round,
        guess,
        feedback: feedback as unknown as Prisma.InputJsonValue,
        correct,
        receivedAt: now,
      },
    });
  } catch {
    return { ok: false, error: "You already guessed this round." };
  }

  const improvesBest =
    greens > me.bestGreens || (greens === me.bestGreens && yellows > me.bestYellows);

  await prisma.arenaPlayer.update({
    where: { id: me.id },
    data: {
      lastSeenAt: now,
      ...(correct ? { solvedRound: round, solvedAt: now } : {}),
      ...(improvesBest ? { bestGreens: greens, bestYellows: yellows, bestAt: now } : {}),
    },
  });

  if (correct) {
    await finalizeMatch(match.id, me.id, "solved", false);
  } else {
    await prisma.arenaMatch.update({
      where: { id: match.id },
      data: { version: { increment: 1 } },
    });
  }

  const refreshed = await loadMatch(match.id);
  if (!refreshed) return { ok: false, error: "Match not found." };

  return { ok: true, state: buildState(refreshed, identity, new Date()) };
}

// ---------------------------------------------------------------------- bots

/** Lazily plays any bot guesses that are already due, keeping it idempotent. */
async function advanceBots(match: MatchWithRelations, now: Date): Promise<boolean> {
  const bot = match.players.find((player) => player.isBot);
  if (!bot || match.status !== "PLAYING") return false;

  const timing = timingOf(match);
  const clock = matchClock(timing, now);
  const currentRound = clock.phase === "countdown" ? 0 : clock.round;

  let changed = false;

  for (let round = 1; round <= currentRound; round += 1) {
    if (bot.guesses.some((guess) => guess.round === round)) continue;

    const window = roundWindow(timing, round);
    const submitAt =
      window.playStartsAt.getTime() +
      botSubmitOffsetMs(match.id, round, bot.league as LeagueName, match.roundMs);
    if (now.getTime() < submitAt) continue;

    const history: BotFeedbackRow[] = match.guesses
      .filter((guess) => guess.playerId === bot.id)
      .map((guess) => ({
        word: guess.guess,
        feedback: (guess.feedback as LetterFeedback[]) ?? [],
      }));

    const guess = botGuess({
      matchId: match.id,
      round,
      league: bot.league as LeagueName,
      history,
      used: history.map((row) => row.word),
    });

    const feedback = evaluateGuess(match.word, guess);
    const correct = guess === match.word;
    const greens = feedback.filter((value) => value === "correct").length;
    const yellows = feedback.filter((value) => value === "present").length;
    const receivedAt = new Date(submitAt);

    try {
      await prisma.arenaGuess.create({
        data: {
          matchId: match.id,
          playerId: bot.id,
          round,
          guess,
          feedback: feedback as unknown as Prisma.InputJsonValue,
          correct,
          receivedAt,
        },
      });
    } catch {
      continue;
    }

    const improvesBest =
      greens > bot.bestGreens || (greens === bot.bestGreens && yellows > bot.bestYellows);

    await prisma.arenaPlayer.update({
      where: { id: bot.id },
      data: {
        ...(correct ? { solvedRound: round, solvedAt: receivedAt } : {}),
        ...(improvesBest ? { bestGreens: greens, bestYellows: yellows, bestAt: receivedAt } : {}),
      },
    });

    changed = true;

    if (correct) {
      await finalizeMatch(match.id, bot.id, "solved", false);
      return true;
    }
  }

  return changed;
}

// --------------------------------------------------------------- match state

export async function getArenaState(
  matchId: string,
  identity: ArenaIdentity,
): Promise<ArenaState | null> {
  let match = await loadMatch(matchId);
  if (!match) return null;

  const now = new Date();
  const timing = timingOf(match);

  // Play out any bot turns that are already due.
  if (match.status === "PLAYING" && match.players.some((player) => player.isBot)) {
    const advanced = await advanceBots(match, now);
    if (advanced) {
      match = (await loadMatch(matchId)) ?? match;
    }
  }

  if (match.status === "PLAYING") {
    const clock = matchClock(timing, now);
    const humans = match.players.filter((player) => !player.isBot);

    // A human who stops responding forfeits.
    const silent = humans.find(
      (player) => now.getTime() - player.lastSeenAt.getTime() > ARENA_QUEUE.forfeitMs,
    );
    if (silent && humans.length === 2) {
      const opponent = humans.find((player) => player.id !== silent.id) ?? null;
      await finalizeMatch(match.id, opponent?.id ?? null, "forfeit", false);
      match = (await loadMatch(matchId)) ?? match;
    } else if (clock.phase === "finished") {
      const outcome = resolveOutcome(match.players);
      await finalizeMatch(match.id, outcome.winnerPlayerId, outcome.reason, outcome.isDraw);
      match = (await loadMatch(matchId)) ?? match;
    } else {
      // Keep the version moving while the countdown runs so pollers tick over.
      await prisma.arenaPlayer.updateMany({
        where: { id: myPlayer(match, identity)?.id ?? "" },
        data: { lastSeenAt: now },
      });
    }
  }

  return buildState(match, identity, now);
}

/** The player's live match, if they navigated away and came back. */
export async function findActiveMatch(identity: ArenaIdentity): Promise<string | null> {
  const match = await prisma.arenaMatch.findFirst({
    where: {
      status: "PLAYING",
      players: {
        some: identity.userId ? { userId: identity.userId } : { guestId: identity.guestId },
      },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });

  return match?.id ?? null;
}

export async function heartbeat(matchId: string, identity: ArenaIdentity): Promise<boolean> {
  const match = await loadMatch(matchId);
  if (!match) return false;

  const me = myPlayer(match, identity);
  if (!me) return false;

  await prisma.arenaPlayer.update({ where: { id: me.id }, data: { lastSeenAt: new Date() } });
  return true;
}

export async function leaveMatch(matchId: string, identity: ArenaIdentity): Promise<boolean> {
  const match = await loadMatch(matchId);
  if (!match || match.status !== "PLAYING") return false;

  const me = myPlayer(match, identity);
  if (!me) return false;

  const opponent = match.players.find((player) => player.id !== me.id) ?? null;
  await finalizeMatch(matchId, opponent?.id ?? null, "forfeit", false);
  return true;
}

export const REACTION_EMOJI = ["😂", "😭", "😡", "🔥", "👏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export async function sendReaction(
  matchId: string,
  identity: ArenaIdentity,
  emoji: string,
): Promise<boolean> {
  if (!REACTION_EMOJI.includes(emoji as ReactionEmoji)) return false;

  const match = await loadMatch(matchId);
  if (!match) return false;

  const me = myPlayer(match, identity);
  if (!me || me.isBot) return false;

  const since = new Date(Date.now() - 1200);
  const recent = await prisma.arenaReaction.count({
    where: { playerId: me.id, createdAt: { gt: since } },
  });
  if (recent > 0) return false;

  await prisma.arenaReaction.create({
    data: { matchId, playerId: me.id, emoji },
  });
  await prisma.arenaMatch.update({
    where: { id: matchId },
    data: { version: { increment: 1 } },
  });

  return true;
}

export async function loadPlayerForMatch(matchId: string, identity: ArenaIdentity) {
  const match = await loadMatch(matchId);
  if (!match) return null;
  return { match, me: myPlayer(match, identity) };
}

export { ownsPlayer };
