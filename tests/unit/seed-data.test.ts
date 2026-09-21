import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const dataDir = path.join(process.cwd(), "prisma", "data");

function readLines(file: string): string[] {
  return readFileSync(path.join(dataDir, file), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

interface ConnectionsPuzzle {
  externalId: string;
  difficulty: number;
  groups: { category: string; difficulty: number; words: string[] }[];
}

describe("wordle seed data", () => {
  it("has unique lowercase 5-letter answers", () => {
    const answers = readLines("wordle-answers.txt");
    expect(answers.length).toBeGreaterThan(2000);
    expect(answers.every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
    expect(new Set(answers).size).toBe(answers.length);
  });

  it("has a large set of allowed guesses", () => {
    const guesses = readLines("wordle-guesses.txt");
    expect(guesses.length).toBeGreaterThan(9000);
    expect(guesses.every((word) => /^[a-z]{5}$/.test(word))).toBe(true);
  });
});

describe("spelling bee dictionary", () => {
  it("has a large alphabetic dictionary", () => {
    const dictionary = readLines("enable1.txt");
    expect(dictionary.length).toBeGreaterThan(150000);
    expect(dictionary.every((word) => /^[a-z]+$/.test(word))).toBe(true);
  });

  it("can build letter sets that contain a pangram", () => {
    const dictionary = readLines("enable1.txt");
    const candidates = dictionary.filter((word) => word.length === 7 && new Set(word).size === 7);
    expect(candidates.length).toBeGreaterThan(200);
  });
});

describe("connections seed puzzles", () => {
  const { puzzles } = JSON.parse(
    readFileSync(path.join(dataDir, "connections-puzzles.json"), "utf8"),
  ) as { puzzles: ConnectionsPuzzle[] };

  it("ships at least 10 puzzles", () => {
    expect(puzzles.length).toBeGreaterThanOrEqual(10);
  });

  it("has 4 groups of 4 unique words per puzzle", () => {
    for (const puzzle of puzzles) {
      expect(typeof puzzle.externalId).toBe("string");
      expect(puzzle.groups).toHaveLength(4);

      const words = puzzle.groups.flatMap((group) => group.words);
      expect(words).toHaveLength(16);
      expect(new Set(words).size).toBe(16);

      for (const group of puzzle.groups) {
        expect(group.words).toHaveLength(4);
        expect(typeof group.category).toBe("string");
        expect(group.category.length).toBeGreaterThan(0);
      }
    }
  });
});
