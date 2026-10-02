import { describe, expect, it } from "vitest";

import { resolveOutcome, type OutcomePlayer } from "@/lib/arena/engine";

function player(overrides: Partial<OutcomePlayer> & { id: string }): OutcomePlayer {
  return { solvedAt: null, bestGreens: 0, bestYellows: 0, bestAt: null, ...overrides };
}

const t = (seconds: number) => new Date(1_700_000_000_000 + seconds * 1000);

describe("resolveOutcome", () => {
  it("awards the win to whoever solved first", () => {
    const outcome = resolveOutcome([
      player({ id: "a", solvedAt: t(20), bestGreens: 5, bestYellows: 0, bestAt: t(20) }),
      player({ id: "b", solvedAt: t(40), bestGreens: 5, bestYellows: 0, bestAt: t(40) }),
    ]);

    expect(outcome).toEqual({ winnerPlayerId: "a", reason: "solved", isDraw: false });
  });

  it("falls back to the closest guess when nobody solved", () => {
    const outcome = resolveOutcome([
      player({ id: "a", bestGreens: 2, bestYellows: 3, bestAt: t(10) }),
      player({ id: "b", bestGreens: 3, bestYellows: 1, bestAt: t(30) }),
    ]);

    expect(outcome).toEqual({ winnerPlayerId: "b", reason: "closest", isDraw: false });
  });

  it("breaks a greens tie on yellows", () => {
    const outcome = resolveOutcome([
      player({ id: "a", bestGreens: 2, bestYellows: 1, bestAt: t(5) }),
      player({ id: "b", bestGreens: 2, bestYellows: 3, bestAt: t(50) }),
    ]);

    expect(outcome.winnerPlayerId).toBe("b");
  });

  it("breaks a full tie on who got there first", () => {
    const outcome = resolveOutcome([
      player({ id: "a", bestGreens: 2, bestYellows: 2, bestAt: t(40) }),
      player({ id: "b", bestGreens: 2, bestYellows: 2, bestAt: t(10) }),
    ]);

    expect(outcome.winnerPlayerId).toBe("b");
  });

  it("draws when the best rows are indistinguishable", () => {
    const outcome = resolveOutcome([
      player({ id: "a", bestGreens: 2, bestYellows: 2, bestAt: t(10) }),
      player({ id: "b", bestGreens: 2, bestYellows: 2, bestAt: t(10) }),
    ]);

    expect(outcome).toEqual({ winnerPlayerId: null, reason: "draw", isDraw: true });
  });

  it("draws when neither player guessed at all", () => {
    const outcome = resolveOutcome([player({ id: "a" }), player({ id: "b" })]);
    expect(outcome.isDraw).toBe(true);
    expect(outcome.winnerPlayerId).toBeNull();
  });

  it("handles an empty player list", () => {
    expect(resolveOutcome([]).isDraw).toBe(true);
  });
});
