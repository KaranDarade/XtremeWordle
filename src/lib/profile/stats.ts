import type { LeagueName } from "@/lib/arena/config";

/**
 * Pure aggregation for profile statistics. Kept free of Prisma so the maths is
 * unit-testable; the queries live in `queries.ts`.
 */

export type MatchOutcome = "WIN" | "LOSS" | "DRAW";

export interface PlayerRow {
  id: string;
  userId: string | null;
  username: string | null;
  displayName: string;
  avatarConfig: unknown;
  avatarSeed: string | null;
  isBot: boolean;
  result: MatchOutcome | null;
  solvedRound: number | null;
  pointsDelta: number;
}

export interface MatchRow {
  id: string;
  mode: string;
  isCasual: boolean;
  finishedAt: Date | null;
  winnerPlayerId: string | null;
  endReason: string | null;
  players: PlayerRow[];
}

export interface MatchSummary {
  id: string;
  mode: string;
  isCasual: boolean;
  finishedAt: Date | null;
  endReason: string | null;
  result: MatchOutcome | null;
  solvedRound: number | null;
  pointsDelta: number;
  opponent: {
    userId: string | null;
    username: string | null;
    displayName: string;
    avatarConfig: unknown;
    avatarSeed: string | null;
    isBot: boolean;
  } | null;
}

export interface Record {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  solved: number;
  solveRate: number;
  bestRound: number | null;
  averageSolvedRound: number | null;
}

export interface HeadToHead {
  key: string;
  username: string | null;
  displayName: string;
  avatarConfig: unknown;
  avatarSeed: string | null;
  isBot: boolean;
  wins: number;
  losses: number;
  draws: number;
  played: number;
}

/**
 * Stats are keyed by the *user* id: each match stores a different ArenaPlayer
 * row per player, so matching on the row id would never find the viewer.
 */
export function opponentIn(match: MatchRow, viewerUserId: string): PlayerRow | null {
  return match.players.find((player) => player.userId !== viewerUserId) ?? null;
}

export function toSummary(match: MatchRow, viewerUserId: string): MatchSummary {
  const me = match.players.find((player) => player.userId === viewerUserId) ?? null;
  const opponent = opponentIn(match, viewerUserId);

  return {
    id: match.id,
    mode: match.mode,
    isCasual: match.isCasual,
    finishedAt: match.finishedAt,
    endReason: match.endReason,
    result: me?.result ?? null,
    solvedRound: me?.solvedRound ?? null,
    pointsDelta: me?.pointsDelta ?? 0,
    opponent: opponent
      ? {
          userId: opponent.userId,
          username: opponent.username,
          displayName: opponent.displayName,
          avatarConfig: opponent.avatarConfig,
          avatarSeed: opponent.avatarSeed,
          isBot: opponent.isBot,
        }
      : null,
  };
}

/** Aggregates a player's results, optionally restricted to ranked matches. */
export function summarize(matches: MatchRow[], viewerUserId: string, rankedOnly = false): Record {
  const relevant = matches
    .filter((match) => !rankedOnly || !match.isCasual)
    .map((match) => match.players.find((player) => player.userId === viewerUserId) ?? null)
    .filter((row): row is PlayerRow => row !== null && row.result !== null);

  const wins = relevant.filter((row) => row.result === "WIN").length;
  const losses = relevant.filter((row) => row.result === "LOSS").length;
  const draws = relevant.filter((row) => row.result === "DRAW").length;
  const played = relevant.length;

  const solvedRounds = relevant
    .map((row) => row.solvedRound)
    .filter((round): round is number => typeof round === "number" && round > 0);

  return {
    played,
    wins,
    losses,
    draws,
    winRate: played === 0 ? 0 : Math.round((wins / played) * 100),
    solved: solvedRounds.length,
    solveRate: played === 0 ? 0 : Math.round((solvedRounds.length / played) * 100),
    bestRound: solvedRounds.length ? Math.min(...solvedRounds) : null,
    averageSolvedRound: solvedRounds.length
      ? Math.round(
          (solvedRounds.reduce((total, round) => total + round, 0) / solvedRounds.length) * 10,
        ) / 10
      : null,
  };
}

function opponentKey(player: PlayerRow): string {
  if (player.userId) return `u:${player.userId}`;
  if (player.username) return `n:${player.username}`;
  return `d:${player.displayName}`;
}

/** Win/loss record against each distinct opponent, most played first. */
export function headToHead(matches: MatchRow[], viewerUserId: string): HeadToHead[] {
  const table = new Map<string, HeadToHead>();

  for (const match of matches) {
    const me = match.players.find((player) => player.userId === viewerUserId);
    const opponent = opponentIn(match, viewerUserId);
    if (!me?.result || !opponent) continue;

    const key = opponentKey(opponent);
    const entry = table.get(key) ?? {
      key,
      username: opponent.username,
      displayName: opponent.displayName,
      avatarConfig: opponent.avatarConfig,
      avatarSeed: opponent.avatarSeed,
      isBot: opponent.isBot,
      wins: 0,
      losses: 0,
      draws: 0,
      played: 0,
    };

    entry.played += 1;
    if (me.result === "WIN") entry.wins += 1;
    else if (me.result === "LOSS") entry.losses += 1;
    else entry.draws += 1;

    table.set(key, entry);
  }

  return [...table.values()].sort(
    (a, b) => b.played - a.played || b.wins - a.wins || a.displayName.localeCompare(b.displayName),
  );
}

export function summarizeLeague(league: LeagueName): string {
  return league.charAt(0) + league.slice(1).toLowerCase();
}
