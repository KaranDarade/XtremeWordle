import { NextResponse } from "next/server";

import { cleanupArena } from "@/lib/arena/cleanup";
import { extractCronToken, isCronAuthorized } from "@/lib/cron/auth";

export const dynamic = "force-dynamic";

/**
 * Housekeeping for the arena: finishes abandoned matches, clears stale queue
 * entries and expired reset codes. Same secret as the word rotation endpoint.
 */
async function handle(request: Request) {
  if (!isCronAuthorized(extractCronToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await cleanupArena();
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...summary });
  } catch (error) {
    console.error("[cron] arena cleanup failed", error);
    return NextResponse.json({ ok: false, error: "Cleanup failed" }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
