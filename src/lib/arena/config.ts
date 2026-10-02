/**
 * Arena rules and league maths — the single source of truth for points,
 * thresholds and match timings. Kept free of Prisma imports so it is safe in
 * client bundles and trivially unit-testable.
 */

export const LEAGUES = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const;
export type LeagueName = (typeof LEAGUES)[number];

export const LEAGUE_THRESHOLDS: { league: LeagueName; min: number }[] = [
  { league: "BRONZE", min: 0 },
  { league: "SILVER", min: 200 },
  { league: "GOLD", min: 500 },
  { league: "PLATINUM", min: 1000 },
  { league: "DIAMOND", min: 2000 },
];

export const ARENA_POINTS = {
  winBase: 30,
  lossPenalty: -10,
  drawPoints: 10,
  /** Index = solvedRound - 1: solving earlier is worth more. */
  roundBonus: [25, 20, 15, 10, 5, 0],
  leagueMultiplier: {
    BRONZE: 1,
    SILVER: 1.1,
    GOLD: 1.25,
    PLATINUM: 1.4,
    DIAMOND: 1.6,
  } satisfies Record<LeagueName, number>,
} as const;

export const ARENA_DEFAULTS = {
  mode: "DUEL" as const,
  roundCount: 6,
  roundMs: 12_000,
  breakMs: 5_000,
  countdownMs: 3_000,
};

function envMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Effective timings for newly created matches. Overridable so automated tests
 * can play a full match in a few seconds.
 */
export function arenaTimings() {
  return {
    roundCount: envMs(process.env.ARENA_ROUND_COUNT, ARENA_DEFAULTS.roundCount),
    roundMs: envMs(process.env.ARENA_ROUND_MS, ARENA_DEFAULTS.roundMs),
    breakMs: envMs(process.env.ARENA_BREAK_MS, ARENA_DEFAULTS.breakMs),
    countdownMs: envMs(process.env.ARENA_COUNTDOWN_MS, ARENA_DEFAULTS.countdownMs),
  };
}

/** A round is play (`roundMs`) followed by the reveal break. */
export function arenaCycleMs(
  roundMs: number = ARENA_DEFAULTS.roundMs,
  breakMs: number = ARENA_DEFAULTS.breakMs,
): number {
  return roundMs + breakMs;
}

export const ARENA_QUEUE = {
  /** A queued player is dropped if they stop polling for this long. */
  staleMs: 15_000,
  /** Silence during a live match before the opponent may claim a forfeit. */
  forfeitMs: 20_000,
  /** A match with no activity at all is abandoned after this. */
  abandonMs: 60_000,
  /** Online window used by the presence counter. */
  onlineWindowMs: 60_000,
  /** How often clients should heartbeat while browsing (not in a match). */
  heartbeatMs: 25_000,
} as const;

export function leagueForPoints(points: number): LeagueName {
  let current: LeagueName = "BRONZE";
  for (const tier of LEAGUE_THRESHOLDS) {
    if (points >= tier.min) current = tier.league;
  }
  return current;
}

export function nextLeague(points: number): { league: LeagueName; min: number } | null {
  return LEAGUE_THRESHOLDS.find((tier) => tier.min > points) ?? null;
}

/** 0 → start of the current league, 1 → start of the next. */
export function leagueProgress(points: number): number {
  const current = leagueForPoints(points);
  const next = nextLeague(points);
  if (!next) return 1;

  const currentMin = LEAGUE_THRESHOLDS.find((tier) => tier.league === current)?.min ?? 0;
  const span = next.min - currentMin;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (points - currentMin) / span));
}

export interface PointsInput {
  result: "WIN" | "LOSS" | "DRAW";
  league: LeagueName;
  /** The round the winner solved on, when the result was a win by solving. */
  solvedRound?: number | null;
}

/**
 * Points awarded for a ranked match. Winning gives `winBase` scaled by the
 * player's league plus a bonus for how early the word was solved.
 */
export function pointsForResult({ result, league, solvedRound }: PointsInput): number {
  if (result === "DRAW") return ARENA_POINTS.drawPoints;

  if (result === "LOSS") {
    const penalty = Math.round(ARENA_POINTS.lossPenalty * ARENA_POINTS.leagueMultiplier[league]);
    return penalty;
  }

  const multiplier = ARENA_POINTS.leagueMultiplier[league];
  const base = Math.round(ARENA_POINTS.winBase * multiplier);
  const bonusIndex = solvedRound ? Math.min(Math.max(solvedRound - 1, 0), 5) : 5;
  return base + ARENA_POINTS.roundBonus[bonusIndex];
}

/** Rank points never fall below zero. */
export function clampRankPoints(points: number): number {
  return Math.max(0, points);
}
