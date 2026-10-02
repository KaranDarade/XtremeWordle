import { describe, expect, it } from "vitest";

import {
  BOT_NAMES,
  botGuess,
  botNameFor,
  botSubmitOffsetMs,
  botThinkMs,
  difficultyForLeague,
  filterCandidates,
} from "@/lib/arena/bot";

describe("difficultyForLeague", () => {
  it("gets sharper and faster as leagues rise", () => {
    const bronze = difficultyForLeague("BRONZE");
    const diamond = difficultyForLeague("DIAMOND");

    expect(diamond.skill).toBeGreaterThan(bronze.skill);
    expect(diamond.maxThink).toBeLessThan(bronze.maxThink);
  });
});

describe("botThinkMs", () => {
  it("is deterministic per match and round", () => {
    expect(botThinkMs("match-1", 3, "GOLD")).toBe(botThinkMs("match-1", 3, "GOLD"));
    expect(botThinkMs("match-1", 3, "GOLD")).not.toBe(botThinkMs("match-1", 4, "GOLD"));
  });

  it("stays inside the league's thinking window", () => {
    const { minThink, maxThink } = difficultyForLeague("SILVER");
    for (let round = 1; round <= 6; round += 1) {
      const think = botThinkMs("match-x", round, "SILVER");
      expect(think).toBeGreaterThanOrEqual(Math.floor(minThink * 1000));
      expect(think).toBeLessThanOrEqual(Math.ceil(maxThink * 1000));
    }
  });

  it("never submits after the round ends", () => {
    expect(botSubmitOffsetMs("m", 1, "DIAMOND", 4000)).toBeLessThanOrEqual(3750);
  });
});

describe("botNameFor", () => {
  it("picks a stable name from the roster", () => {
    const name = botNameFor("some-match");
    expect(BOT_NAMES).toContain(name);
    expect(botNameFor("some-match")).toBe(name);
  });
});

describe("filterCandidates", () => {
  it("keeps only words matching green letters", () => {
    const candidates = filterCandidates([
      { word: "crane", feedback: ["correct", "absent", "absent", "absent", "absent"] },
    ]);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((word) => word[0] === "c")).toBe(true);
  });

  it("requires yellow letters to be present", () => {
    const candidates = filterCandidates([
      { word: "crane", feedback: ["absent", "present", "absent", "absent", "absent"] },
    ]);
    expect(candidates.every((word) => word.includes("r"))).toBe(true);
    expect(candidates.every((word) => word[0] !== "r")).toBe(true);
  });

  it("excludes letters ruled out", () => {
    const candidates = filterCandidates([
      { word: "xyzzy", feedback: ["absent", "absent", "absent", "absent", "absent"] },
    ]);
    expect(candidates.every((word) => !/[xy]/.test(word))).toBe(true);
  });

  it("returns an empty list when nothing fits", () => {
    expect(
      filterCandidates([
        { word: "crane", feedback: ["correct", "correct", "correct", "correct", "correct"] },
      ]),
    ).toEqual(["crane"]);
  });
});

describe("botGuess", () => {
  const base = { matchId: "m1", league: "BRONZE" as const, history: [], used: [] };

  it("is deterministic", () => {
    expect(botGuess({ ...base, round: 1 })).toBe(botGuess({ ...base, round: 1 }));
  });

  it("returns a real five-letter word", () => {
    const guess = botGuess({ ...base, round: 2 });
    expect(guess).toMatch(/^[a-z]{5}$/);
  });

  it("avoids words it has already played", () => {
    const used = ["crane", "slate", "adieu"];
    const guess = botGuess({ ...base, round: 4, used });
    expect(used).not.toContain(guess);
  });

  it("still produces a guess when its filter finds nothing", () => {
    const history = [
      { word: "crane", feedback: ["correct", "correct", "correct", "correct", "correct"] as const },
    ];
    const guess = botGuess({
      ...base,
      round: 5,
      history: history.map((row) => ({ word: row.word, feedback: [...row.feedback] })),
      used: ["crane"],
    });
    expect(guess).toMatch(/^[a-z]{5}$/);
    expect(guess).not.toBe("crane");
  });
});
