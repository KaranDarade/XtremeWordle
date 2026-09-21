import { describe, expect, it } from "vitest";

import {
  bucketKeyForMode,
  bucketStartUtc,
  dailyBucketKey,
  nextBucketKey,
  twelveHourBucketKey,
} from "@/lib/time/buckets";

describe("dailyBucketKey (IST)", () => {
  it("formats the IST calendar date", () => {
    // 2026-09-15T18:00Z -> 2026-09-15T23:30 IST
    expect(dailyBucketKey(new Date("2026-09-15T18:00:00Z"))).toBe("2026-09-15");
  });

  it("rolls over exactly at 00:00 IST", () => {
    // 2026-09-15T18:29Z -> 2026-09-15T23:59 IST
    expect(dailyBucketKey(new Date("2026-09-15T18:29:00Z"))).toBe("2026-09-15");
    // 2026-09-15T18:30Z -> 2026-09-16T00:00 IST
    expect(dailyBucketKey(new Date("2026-09-15T18:30:00Z"))).toBe("2026-09-16");
  });
});

describe("twelveHourBucketKey (IST)", () => {
  it("uses 00 and 12 halves", () => {
    expect(twelveHourBucketKey(new Date("2026-09-15T05:59:00Z"))).toBe("2026-09-15-00");
    expect(twelveHourBucketKey(new Date("2026-09-15T06:30:00Z"))).toBe("2026-09-15-12");
    expect(twelveHourBucketKey(new Date("2026-09-15T18:30:00Z"))).toBe("2026-09-16-00");
  });

  it("agrees with the daily key prefix", () => {
    const date = new Date("2026-09-15T12:00:00Z");
    expect(twelveHourBucketKey(date).startsWith(dailyBucketKey(date))).toBe(true);
  });
});

describe("bucketKeyForMode", () => {
  it("dispatches on mode", () => {
    const date = new Date("2026-09-15T06:30:00Z");
    expect(bucketKeyForMode("daily", date)).toBe("2026-09-15");
    expect(bucketKeyForMode("twelve-hour", date)).toBe("2026-09-15-12");
  });
});

describe("bucketStartUtc", () => {
  it("returns the IST boundary as a UTC instant", () => {
    expect(bucketStartUtc("2026-09-15")?.toISOString()).toBe("2026-09-14T18:30:00.000Z");
    expect(bucketStartUtc("2026-09-15-12")?.toISOString()).toBe("2026-09-15T06:30:00.000Z");
  });

  it("returns null for malformed keys", () => {
    expect(bucketStartUtc("nope")).toBeNull();
    expect(bucketStartUtc("2026-09-15-13")).toBeNull();
  });
});

describe("nextBucketKey", () => {
  it("advances by the mode step", () => {
    const date = new Date("2026-09-15T06:30:00Z"); // 12:00 IST
    expect(nextBucketKey("daily", date)).toBe("2026-09-16");
    expect(nextBucketKey("twelve-hour", date)).toBe("2026-09-16-00");
  });
});
