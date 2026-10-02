import { describe, expect, it } from "vitest";

import {
  ARENA_DEFAULTS,
  ARENA_POINTS,
  arenaCycleMs,
  clampRankPoints,
  leagueForPoints,
  leagueProgress,
  LEAGUE_THRESHOLDS,
  nextLeague,
  pointsForResult,
} from "@/lib/arena/config";

describe("leagueForPoints", () => {
  it("maps points to the correct tier at each boundary", () => {
    expect(leagueForPoints(0)).toBe("BRONZE");
    expect(leagueForPoints(199)).toBe("BRONZE");
    expect(leagueForPoints(200)).toBe("SILVER");
    expect(leagueForPoints(499)).toBe("SILVER");
    expect(leagueForPoints(500)).toBe("GOLD");
    expect(leagueForPoints(999)).toBe("GOLD");
    expect(leagueForPoints(1000)).toBe("PLATINUM");
    expect(leagueForPoints(1999)).toBe("PLATINUM");
    expect(leagueForPoints(2000)).toBe("DIAMOND");
    expect(leagueForPoints(99999)).toBe("DIAMOND");
  });
});

describe("league thresholds", () => {
  it("are ordered ascending from zero", () => {
    expect(LEAGUE_THRESHOLDS[0]).toEqual({ league: "BRONZE", min: 0 });
    const mins = LEAGUE_THRESHOLDS.map((tier) => tier.min);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
});

describe("nextLeague", () => {
  it("returns the next tier up", () => {
    expect(nextLeague(0)).toEqual({ league: "SILVER", min: 200 });
    expect(nextLeague(250)).toEqual({ league: "GOLD", min: 500 });
  });

  it("returns null at the top league", () => {
    expect(nextLeague(2000)).toBeNull();
    expect(nextLeague(5000)).toBeNull();
  });
});

describe("leagueProgress", () => {
  it("is zero at the start of a league and near one at the end", () => {
    expect(leagueProgress(0)).toBe(0);
    expect(leagueProgress(100)).toBeCloseTo(0.5, 5);
    expect(leagueProgress(199)).toBeCloseTo(0.995, 3);
  });

  it("tracks progress within the top league as full", () => {
    expect(leagueProgress(2000)).toBe(1);
  });
});

describe("pointsForResult", () => {
  it("awards base points scaled by league for a win", () => {
    expect(pointsForResult({ result: "WIN", league: "BRONZE", solvedRound: 6 })).toBe(30);
    expect(pointsForResult({ result: "WIN", league: "DIAMOND", solvedRound: 6 })).toBe(48);
  });

  it("adds a larger bonus for solving earlier", () => {
    const round1 = pointsForResult({ result: "WIN", league: "BRONZE", solvedRound: 1 });
    const round3 = pointsForResult({ result: "WIN", league: "BRONZE", solvedRound: 3 });
    const round6 = pointsForResult({ result: "WIN", league: "BRONZE", solvedRound: 6 });

    expect(round1).toBe(55);
    expect(round3).toBe(45);
    expect(round6).toBe(30);
    expect(round1).toBeGreaterThan(round3);
    expect(round3).toBeGreaterThan(round6);
  });

  it("treats a win without a solve round as the smallest bonus", () => {
    expect(pointsForResult({ result: "WIN", league: "BRONZE" })).toBe(30);
    expect(pointsForResult({ result: "WIN", league: "BRONZE", solvedRound: null })).toBe(30);
  });

  it("penalises losses scaled by league", () => {
    expect(pointsForResult({ result: "LOSS", league: "BRONZE" })).toBe(-10);
    expect(pointsForResult({ result: "LOSS", league: "DIAMOND" })).toBe(-16);
  });

  it("gives a flat award for a draw", () => {
    expect(pointsForResult({ result: "DRAW", league: "BRONZE" })).toBe(ARENA_POINTS.drawPoints);
    expect(pointsForResult({ result: "DRAW", league: "DIAMOND" })).toBe(ARENA_POINTS.drawPoints);
  });

  it("scales wins upward across every league", () => {
    const wins = (["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const).map((league) =>
      pointsForResult({ result: "WIN", league, solvedRound: 6 }),
    );
    expect(wins).toEqual([...wins].sort((a, b) => a - b));
    expect(new Set(wins).size).toBe(wins.length);
  });
});

describe("clampRankPoints", () => {
  it("never drops below zero", () => {
    expect(clampRankPoints(-40)).toBe(0);
    expect(clampRankPoints(0)).toBe(0);
    expect(clampRankPoints(25)).toBe(25);
  });
});

describe("ARENA_DEFAULTS", () => {
  it("uses a 12s play window and a 5s reveal with a 3s countdown", () => {
    expect(ARENA_DEFAULTS.roundMs).toBe(12_000);
    expect(ARENA_DEFAULTS.breakMs).toBe(5_000);
    expect(ARENA_DEFAULTS.countdownMs).toBe(3_000);
    expect(ARENA_DEFAULTS.roundCount).toBe(6);
  });

  it("computes the round cycle from play plus reveal", () => {
    expect(arenaCycleMs()).toBe(17_000);
    expect(arenaCycleMs(2_000, 1_000)).toBe(3_000);
  });
});
