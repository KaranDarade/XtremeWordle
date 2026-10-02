import { prisma } from "@/lib/db";
import { normalizeAvatar, type AvatarConfig } from "@/lib/avatar/config";
import { leagueForPoints, leagueProgress, nextLeague } from "@/lib/arena/config";

import { headToHead, summarize, toSummary, type MatchRow, type MatchSummary } from "./stats";

const MATCH_LIMIT = 60;

export interface PlayerIdentity {
  id: string;
  username: string;
  name: string | null;
  avatarConfig: AvatarConfig;
  league: string;
  rankPoints: number;
  createdAt: Date;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
}

function mapMatch(match: {
  id: string;
  mode: string;
  isCasual: boolean;
  finishedAt: Date | null;
  winnerPlayerId: string | null;
  endReason: string | null;
  players: {
    id: string;
    userId: string | null;
    username: string | null;
    displayName: string;
    avatarSeed: string | null;
    isBot: boolean;
    result: "WIN" | "LOSS" | "DRAW" | null;
    solvedRound: number | null;
    pointsDelta: number;
    user: { avatarConfig: unknown } | null;
  }[];
}): MatchRow {
  return {
    id: match.id,
    mode: match.mode,
    isCasual: match.isCasual,
    finishedAt: match.finishedAt,
    winnerPlayerId: match.winnerPlayerId,
    endReason: match.endReason,
    players: match.players.map((player) => ({
      id: player.id,
      userId: player.userId,
      username: player.username,
      displayName: player.displayName,
      avatarConfig: player.user?.avatarConfig ?? null,
      avatarSeed: player.avatarSeed,
      isBot: player.isBot,
      result: player.result,
      solvedRound: player.solvedRound,
      pointsDelta: player.pointsDelta,
    })),
  };
}

async function loadMatches(userId: string): Promise<MatchRow[]> {
  const rows = await prisma.arenaMatch.findMany({
    where: { players: { some: { userId } }, status: "FINISHED" },
    orderBy: { startedAt: "desc" },
    take: MATCH_LIMIT,
    select: {
      id: true,
      mode: true,
      isCasual: true,
      finishedAt: true,
      winnerPlayerId: true,
      endReason: true,
      players: {
        select: {
          id: true,
          userId: true,
          username: true,
          displayName: true,
          avatarSeed: true,
          isBot: true,
          result: true,
          solvedRound: true,
          pointsDelta: true,
          user: { select: { avatarConfig: true } },
        },
      },
    },
  });

  return rows.map(mapMatch);
}

export interface ProfileBundle {
  identity: PlayerIdentity;
  league: {
    name: string;
    points: number;
    nextLeague: string | null;
    pointsToNext: number | null;
    progress: number;
  };
  record: ReturnType<typeof summarize>;
  ranked: ReturnType<typeof summarize>;
  recent: MatchSummary[];
  headToHead: ReturnType<typeof headToHead>;
}

function toIdentity(user: {
  id: string;
  username: string;
  name: string | null;
  avatarConfig: unknown;
  league: string;
  rankPoints: number;
  createdAt: Date;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
}): PlayerIdentity {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarConfig: normalizeAvatar(user.avatarConfig),
    league: user.league,
    rankPoints: user.rankPoints,
    createdAt: user.createdAt,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    currentStreak: user.currentStreak,
    bestStreak: user.bestStreak,
  };
}

function buildBundle(identity: PlayerIdentity, matches: MatchRow[]): ProfileBundle {
  const league = leagueForPoints(identity.rankPoints);
  const next = nextLeague(identity.rankPoints);

  return {
    identity,
    league: {
      name: league,
      points: identity.rankPoints,
      nextLeague: next?.league ?? null,
      pointsToNext: next ? next.min - identity.rankPoints : null,
      progress: leagueProgress(identity.rankPoints),
    },
    record: summarize(matches, identity.id),
    ranked: summarize(matches, identity.id, true),
    recent: matches.slice(0, 8).map((match) => toSummary(match, identity.id)),
    headToHead: headToHead(matches, identity.id).slice(0, 8),
  };
}

export async function getProfileForUser(userId: string): Promise<ProfileBundle | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      avatarConfig: true,
      league: true,
      rankPoints: true,
      createdAt: true,
      wins: true,
      losses: true,
      draws: true,
      currentStreak: true,
      bestStreak: true,
    },
  });
  if (!user) return null;

  const matches = await loadMatches(userId);
  return buildBundle(toIdentity(user), matches);
}

export async function getProfileForUsername(username: string): Promise<ProfileBundle | null> {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      name: true,
      avatarConfig: true,
      league: true,
      rankPoints: true,
      createdAt: true,
      wins: true,
      losses: true,
      draws: true,
      currentStreak: true,
      bestStreak: true,
    },
  });
  if (!user) return null;

  const matches = await loadMatches(user.id);
  return buildBundle(toIdentity(user), matches);
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  name: string | null;
  avatarConfig: AvatarConfig;
  league: string;
  rankPoints: number;
  wins: number;
  losses: number;
  played: number;
}

export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: { rankPoints: { gt: 0 }, isBanned: false },
    orderBy: [{ rankPoints: "desc" }, { wins: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      username: true,
      name: true,
      avatarConfig: true,
      league: true,
      rankPoints: true,
      wins: true,
      losses: true,
      matchesPlayed: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    name: user.name,
    avatarConfig: normalizeAvatar(user.avatarConfig),
    league: user.league,
    rankPoints: user.rankPoints,
    wins: user.wins,
    losses: user.losses,
    played: user.matchesPlayed,
  }));
}
