/**
 * Rotation bucket helpers.
 *
 * All buckets are computed in IST (Asia/Kolkata, UTC+05:30, no DST).
 * A "daily" bucket rolls over at 00:00 IST; a "twelve-hour" bucket rolls
 * over at 00:00 and 12:00 IST.
 */

export const IST_OFFSET_MINUTES = 330;

export type RotationMode = "daily" | "twelve-hour";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function istParts(date: Date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** e.g. `2026-09-15` */
export function dailyBucketKey(date: Date = new Date()): string {
  const { year, month, day } = istParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** e.g. `2026-09-15-00` or `2026-09-15-12` */
export function twelveHourBucketKey(date: Date = new Date()): string {
  const { year, month, day, hour } = istParts(date);
  return `${year}-${pad(month)}-${pad(day)}-${hour < 12 ? "00" : "12"}`;
}

export function bucketKeyForMode(mode: RotationMode, date: Date = new Date()): string {
  return mode === "twelve-hour" ? twelveHourBucketKey(date) : dailyBucketKey(date);
}

/** UTC instant at which the given bucket started. Returns null for malformed keys. */
export function bucketStartUtc(bucketKey: string): Date | null {
  const daily = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bucketKey);
  if (daily) {
    const [, y, m, d] = daily;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)) - IST_OFFSET_MINUTES * 60_000);
  }

  const half = /^(\d{4})-(\d{2})-(\d{2})-(00|12)$/.exec(bucketKey);
  if (half) {
    const [, y, m, d, h] = half;
    return new Date(
      Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h)) - IST_OFFSET_MINUTES * 60_000,
    );
  }

  return null;
}

/** The bucket key that follows the given one (used to detect stale rotations). */
export function nextBucketKey(mode: RotationMode, date: Date = new Date()): string {
  const stepMs = mode === "twelve-hour" ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return bucketKeyForMode(mode, new Date(date.getTime() + stepMs));
}
