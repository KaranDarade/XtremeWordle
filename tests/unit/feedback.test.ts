import { describe, expect, it } from "vitest";

import { evaluateGuess, keyboardState, shareText, type GuessRow } from "@/lib/words/feedback";

describe("evaluateGuess", () => {
  it("marks an exact match as all correct", () => {
    expect(evaluateGuess("crane", "crane")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("marks an anagram as present, keeping the exact letter", () => {
    // answer: c r a n e / guess: n a c r e -> only the final 'e' is exact.
    expect(evaluateGuess("crane", "nacre")).toEqual([
      "present",
      "present",
      "present",
      "present",
      "correct",
    ]);
  });

  it("marks letters missing from the answer as absent", () => {
    expect(evaluateGuess("crane", "stomp")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  it("does not award present twice for a single letter in the answer", () => {
    // answer 'crane' has exactly one 'e', which is already matched at the end.
    expect(evaluateGuess("crane", "geese")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "correct",
    ]);
  });

  it("handles duplicates across exact and present positions", () => {
    // answer 'apple' has two p's: one exact (index 2), one present (index 0).
    expect(evaluateGuess("apple", "puppy")).toEqual([
      "present",
      "absent",
      "correct",
      "absent",
      "absent",
    ]);
  });

  it("is case-insensitive", () => {
    expect(evaluateGuess("CRANE", "cRaNe")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });
});

describe("keyboardState", () => {
  it("keeps the best known state per letter", () => {
    const rows: GuessRow[] = [
      { word: "crane", feedback: ["correct", "absent", "absent", "absent", "present"] },
      { word: "about", feedback: ["absent", "present", "absent", "absent", "absent"] },
    ];
    const state = keyboardState(rows);
    expect(state.c).toBe("correct");
    expect(state.e).toBe("present");
    expect(state.b).toBe("present");
    expect(state.a).toBe("absent");
    expect(state.z).toBeUndefined();
  });

  it("upgrades a letter from absent to present when a later guess finds it", () => {
    const rows: GuessRow[] = [
      { word: "crane", feedback: ["absent", "absent", "absent", "absent", "absent"] },
      { word: "brain", feedback: ["absent", "absent", "present", "absent", "absent"] },
    ];
    expect(keyboardState(rows).a).toBe("present");
  });
});

describe("shareText", () => {
  it("renders a spoiler-free grid with the score", () => {
    const rows: GuessRow[] = [
      { word: "crane", feedback: ["absent", "present", "absent", "absent", "absent"] },
      { word: "brave", feedback: ["correct", "correct", "correct", "correct", "correct"] },
    ];
    const text = shareText("Bubble Wordle #2026-09-15", rows, 6);
    expect(text).toContain("2/6");
    expect(text).toContain("⬜🟨⬜⬜⬜");
    expect(text).toContain("🟩🟩🟩🟩🟩");
    expect(text).not.toContain("brave");
  });

  it("shows an X when the game was lost", () => {
    const rows: GuessRow[] = [
      { word: "crane", feedback: ["absent", "absent", "absent", "absent", "absent"] },
    ];
    expect(shareText("Bubble Wordle", rows, 6)).toContain("X/6");
  });
});
