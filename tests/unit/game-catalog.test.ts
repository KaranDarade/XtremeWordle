import { describe, expect, it } from "vitest";

import type { GameResult } from "@/generated/prisma/client";
import { DEMO_USERS, GAME_CATALOG } from "@/lib/games/catalog";
import type { Identity } from "@/lib/session/identity";
import { ownsResult, readStringArray } from "@/lib/session/result";

describe("game catalog", () => {
  it("ships the three launch games", () => {
    expect(GAME_CATALOG.map((game) => game.slug).sort()).toEqual([
      "connections",
      "spelling-bee",
      "wordle",
    ]);
  });

  it("gives every game the metadata the UI needs", () => {
    for (const game of GAME_CATALOG) {
      expect(game.slug).toMatch(/^[a-z-]+$/);
      expect(game.name.length).toBeGreaterThan(1);
      expect(game.tagline.length).toBeGreaterThan(1);
      expect(game.description.length).toBeGreaterThan(1);
      expect(["word", "puzzle"]).toContain(game.resolver);
      expect(["daily", "twelve-hour"]).toContain(game.rotation);
      expect(game.settings).toBeTypeOf("object");
    }
  });

  it("uses unique slugs and sort orders", () => {
    const slugs = GAME_CATALOG.map((game) => game.slug);
    const orders = GAME_CATALOG.map((game) => game.sortOrder);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("configures wordle with the classic rules and a 12-hour pool", () => {
    const wordle = GAME_CATALOG.find((game) => game.slug === "wordle");
    expect(wordle?.settings.answerLength).toBe(5);
    expect(wordle?.settings.maxAttempts).toBe(6);
    expect(wordle?.settings.unlimitedRotation).toBe("twelve-hour");
  });

  it("configures the puzzle games", () => {
    const bee = GAME_CATALOG.find((game) => game.slug === "spelling-bee");
    expect(bee?.resolver).toBe("puzzle");
    expect(bee?.settings.minWordLength).toBe(4);

    const connections = GAME_CATALOG.find((game) => game.slug === "connections");
    expect(connections?.resolver).toBe("puzzle");
    expect(connections?.settings.maxMistakes).toBe(4);
  });

  it("provides demo accounts with credentials", () => {
    expect(DEMO_USERS.length).toBeGreaterThan(0);
    for (const user of DEMO_USERS) {
      expect(user.email).toContain("@");
      expect(user.password.length).toBeGreaterThanOrEqual(8);
      expect(user.name.length).toBeGreaterThan(1);
    }
  });
});

describe("result ownership", () => {
  const result = { userId: "user-1", guestId: "guest-1" } as unknown as GameResult;

  it("matches the signed-in user", () => {
    const identity: Identity = { userId: "user-1", guestId: null };
    expect(ownsResult(result, identity)).toBe(true);

    expect(ownsResult(result, { userId: "user-2", guestId: null })).toBe(false);
  });

  it("matches the guest session", () => {
    expect(ownsResult(result, { userId: null, guestId: "guest-1" })).toBe(true);
    expect(ownsResult(result, { userId: null, guestId: "guest-2" })).toBe(false);
  });

  it("rejects an anonymous identity even when the row has an owner", () => {
    expect(ownsResult(result, { userId: null, guestId: null })).toBe(false);
  });
});

describe("readStringArray", () => {
  it("keeps only string entries", () => {
    expect(readStringArray(["a", 1, null, "b", { c: 1 }, undefined])).toEqual(["a", "b"]);
  });

  it("returns an empty array for non-arrays", () => {
    expect(readStringArray(null)).toEqual([]);
    expect(readStringArray("abc")).toEqual([]);
    expect(readStringArray({ 0: "a" })).toEqual([]);
    expect(readStringArray(undefined)).toEqual([]);
  });
});
