import { NextResponse } from "next/server";

import { cleanupArena } from "@/lib/arena/cleanup";
import { extractCronToken, isCronAuthorized } from "@/lib/cron/auth";
import { rotateAllGames } from "@/lib/words/rotation";

export const dynamic = "force-dynamic";

/**
 * Rotates daily and 12-hourly word pools for every active game.
 *
 * Security: requires `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends
 * this automatically when CRON_SECRET is set) or `?secret=<CRON_SECRET>`.
 *
 * Note: Vercel Hobby can only schedule once per day, so the 12-hour refresh is
 * driven by an external scheduler hitting this same endpoint. Because answers
 * are resolved deterministically, a missed run never breaks the site.
 */
async function handle(request: Request) {
  if (!isCronAuthorized(extractCronToken(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ranAt = new Date().toISOString();

  try {
    const results = await rotateAllGames();
    const cleanup = await cleanupArena();
    return NextResponse.json({ ok: true, ranAt, results, cleanup });
  } catch (error) {
    console.error("[cron] rotation failed", error);
    return NextResponse.json({ ok: false, error: "Rotation failed" }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
