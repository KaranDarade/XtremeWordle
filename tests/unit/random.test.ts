import { describe, expect, it } from "vitest";

import { hashSeed, mulberry32, seededShuffle } from "@/lib/words/random";

describe("mulberry32", () => {
  it("produces values between 0 and 1", () => {
    const random = mulberry32(123);
    for (let i = 0; i < 50; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(mulberry32(42)()).toBe(mulberry32(42)());
  });
});

describe("hashSeed", () => {
  it("is stable and differs for different inputs", () => {
    expect(hashSeed("conn-001")).toBe(hashSeed("conn-001"));
    expect(hashSeed("conn-001")).not.toBe(hashSeed("conn-002"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const value = hashSeed("wordle-arena");
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("seededShuffle", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"];

  it("is deterministic for the same seed", () => {
    expect(seededShuffle(items, "conn-001")).toEqual(seededShuffle(items, "conn-001"));
  });

  it("changes order for a different seed", () => {
    expect(seededShuffle(items, "conn-001")).not.toEqual(seededShuffle(items, "conn-999"));
  });

  it("keeps every item exactly once", () => {
    const shuffled = seededShuffle(items, "conn-005");
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it("does not mutate the input", () => {
    const original = [...items];
    seededShuffle(items, "conn-007");
    expect(items).toEqual(original);
  });
});
