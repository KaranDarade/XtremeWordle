import { NextResponse } from "next/server";

import { heartbeat } from "@/lib/arena/engine";
import { requireArenaIdentity } from "@/lib/arena/guard";
import { heartbeatPresence } from "@/lib/arena/presence";
import { guardRequest } from "@/lib/http/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = guardRequest(request, "arena:heartbeat", 300);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const [alive, online] = await Promise.all([
    heartbeat(id, guard.identity),
    heartbeatPresence(guard.identity, "IN_MATCH"),
  ]);

  return NextResponse.json({ alive, online });
}
