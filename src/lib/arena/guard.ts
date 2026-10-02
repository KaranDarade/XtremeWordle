import type { NextResponse } from "next/server";

import { getIdentity, hasIdentity } from "@/lib/session/identity";

import { resolveArenaIdentity, type ArenaIdentity } from "./engine";

export type ArenaGuard =
  | { ok: true; identity: ArenaIdentity; blocked?: never }
  | { ok: false; response: NextResponse; identity?: never };

/** Resolves the caller to an arena identity, or returns a ready error response. */
export async function requireArenaIdentity(): Promise<ArenaGuard> {
  const { NextResponse } = await import("next/server");

  const identity = await getIdentity();
  if (!hasIdentity(identity)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No player session." }, { status: 400 }),
    };
  }

  const arenaIdentity = await resolveArenaIdentity(identity);
  if (!arenaIdentity) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No player session." }, { status: 400 }),
    };
  }

  return { ok: true, identity: arenaIdentity };
}
