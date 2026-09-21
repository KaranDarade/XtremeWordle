import type { GameResult } from "@/generated/prisma/client";

import type { Identity } from "./identity";

/** True when the result row belongs to the current player. */
export function ownsResult(result: GameResult, identity: Identity): boolean {
  if (identity.userId) return result.userId === identity.userId;
  if (identity.guestId) return result.guestId === identity.guestId;
  return false;
}

/** Safely reads a JSON array of strings from a Prisma Json column. */
export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
