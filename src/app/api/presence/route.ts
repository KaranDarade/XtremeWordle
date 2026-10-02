import { NextResponse } from "next/server";

import { heartbeatPresence, getOnlineCounts } from "@/lib/arena/presence";
import { requireArenaIdentity } from "@/lib/arena/guard";
import { guardRequest } from "@/lib/http/guard";

export const dynamic = "force-dynamic";

/** Presence heartbeat + the current online counts. */
export async function POST(request: Request) {
  const blocked = guardRequest(request, "presence:ping", 300);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const online = await heartbeatPresence(guard.identity, "BROWSING");
  return NextResponse.json(online);
}

export async function GET(request: Request) {
  const blocked = guardRequest(request, "presence:read", 300);
  if (blocked) return blocked;

  return NextResponse.json(await getOnlineCounts());
}
