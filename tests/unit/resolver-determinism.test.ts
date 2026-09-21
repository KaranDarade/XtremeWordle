import { describe, expect, it } from "vitest";

import { deterministicIndex } from "@/lib/words/resolver";

describe("deterministicIndex", () => {
  it("is stable for the same game and bucket", async () => {
    const a = await deterministicIndex("game-1", "2026-09-15");
    const b = await deterministicIndex("game-1", "2026-09-15");
    expect(a).toBe(b);
  });

  it("changes when the bucket changes", async () => {
    const a = await deterministicIndex("game-1", "2026-09-15");
    const b = await deterministicIndex("game-1", "2026-09-16");
    expect(a).not.toBe(b);
  });

  it("changes when the game changes", async () => {
    const a = await deterministicIndex("game-1", "2026-09-15");
    const b = await deterministicIndex("game-2", "2026-09-15");
    expect(a).not.toBe(b);
  });

  it("returns a non-negative 32-bit integer", async () => {
    const value = await deterministicIndex("game-1", "2026-09-15-12");
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});
