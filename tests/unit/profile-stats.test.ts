import { describe, expect, it } from "vitest";

import {
  headToHead,
  opponentIn,
  summarize,
  toSummary,
  type MatchRow,
  type PlayerRow,
} from "@/lib/profile/stats";

function player(overrides: Partial<PlayerRow> & { id: string }): PlayerRow {
  return {
    userId: `user-${overrides.id}`,
    username: `name-${overrides.id}`,
    displayName: `Player ${overrides.id}`,
    avatarConfig: null,
    avatarSeed: null,
    isBot: false,
    result: null,
    solvedRound: null,
    pointsDelta: 0,
    ...overrides,
  };
}

function match(overrides: Partial<MatchRow> & { id: string; players: PlayerRow[] }): MatchRow {
  return {
    mode: "DUEL",
    isCasual: false,
    finishedAt: new Date("2026-09-20T10:00:00Z"),
    winnerPlayerId: null,
    endReason: "solved",
    ...overrides,
  };
}

const ME = "me-user";

const MATCHES: MatchRow[] = [
  match({
    id: "m1",
    players: [
      player({ id: "row-1", userId: ME, result: "WIN", solvedRound: 2, pointsDelta: 50 }),
      player({ id: "a", result: "LOSS", solvedRound: null, pointsDelta: -10 }),
    ],
  }),
  match({
    id: "m2",
    players: [
      player({ id: "row-2", userId: ME, result: "LOSS", pointsDelta: -10 }),
      player({ id: "a", result: "WIN", solvedRound: 4, pointsDelta: 35 }),
    ],
  }),
  match({
    id: "m3",
    isCasual: true,
    players: [
      player({ id: "row-3", userId: ME, result: "WIN", solvedRound: 6, pointsDelta: 0 }),
      player({ id: "bot", displayName: "Byte", isBot: true, result: "LOSS" }),
    ],
  }),
  match({
    id: "m4",
    players: [
      player({ id: "row-4", userId: ME, result: "DRAW", pointsDelta: 10 }),
      player({ id: "b", result: "DRAW", pointsDelta: 10 }),
    ],
  }),
  match({
    id: "m5",
    players: [
      player({ id: "row-5", userId: ME, result: null, pointsDelta: 0 }),
      player({ id: "c", result: null, pointsDelta: 0 }),
    ],
  }),
];

describe("opponentIn", () => {
  it("returns the other player", () => {
    expect(opponentIn(MATCHES[0], ME)?.id).toBe("a");
  });

  it("returns null when the match has no opponent", () => {
    expect(
      opponentIn(match({ id: "solo", players: [player({ id: "row-solo", userId: ME })] }), ME),
    ).toBeNull();
  });
});

describe("summarize", () => {
  it("counts results and ignores unfinished matches", () => {
    const record = summarize(MATCHES, ME);

    expect(record.played).toBe(4);
    expect(record.wins).toBe(2);
    expect(record.losses).toBe(1);
    expect(record.draws).toBe(1);
    expect(record.winRate).toBe(50);
  });

  it("computes solve stats from solved rounds only", () => {
    const record = summarize(MATCHES, ME);

    expect(record.solved).toBe(2);
    expect(record.solveRate).toBe(50);
    expect(record.bestRound).toBe(2);
    expect(record.averageSolvedRound).toBe(4);
  });

  it("can restrict to ranked matches", () => {
    const ranked = summarize(MATCHES, ME, true);

    expect(ranked.played).toBe(3);
    expect(ranked.wins).toBe(1);
    expect(ranked.losses).toBe(1);
  });

  it("returns zeros for a player with no matches", () => {
    const record = summarize([], ME);
    expect(record).toMatchObject({
      played: 0,
      winRate: 0,
      solveRate: 0,
      bestRound: null,
      averageSolvedRound: null,
    });
  });
});

describe("headToHead", () => {
  it("aggregates per opponent, most played first", () => {
    const rows = headToHead(MATCHES, ME);

    expect(rows[0]).toMatchObject({
      displayName: "Player a",
      played: 2,
      wins: 1,
      losses: 1,
    });
    expect(rows.map((row) => row.displayName)).toEqual(
      expect.arrayContaining(["Player a", "Byte", "Player b"]),
    );
  });

  it("keeps bots identifiable and skips opponents without a result", () => {
    const rows = headToHead(MATCHES, ME);
    const bot = rows.find((row) => row.displayName === "Byte");

    expect(bot?.isBot).toBe(true);
    expect(rows.some((row) => row.displayName === "Player c")).toBe(false);
  });

  it("is empty with no matches", () => {
    expect(headToHead([], ME)).toEqual([]);
  });
});

describe("toSummary", () => {
  it("maps a match into the viewer's perspective", () => {
    const summary = toSummary(MATCHES[0], ME);

    expect(summary.result).toBe("WIN");
    expect(summary.solvedRound).toBe(2);
    expect(summary.pointsDelta).toBe(50);
    expect(summary.opponent?.displayName).toBe("Player a");
  });

  it("handles a match without an opponent", () => {
    const summary = toSummary(
      match({ id: "solo", players: [player({ id: "row-solo", userId: ME })] }),
      ME,
    );
    expect(summary.opponent).toBeNull();
  });
});
