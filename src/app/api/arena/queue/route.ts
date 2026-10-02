import { NextResponse } from "next/server";

import { ARENA_QUEUE } from "@/lib/arena/config";
import { createBotMatch, findMyQueue, joinQueue, leaveQueue, pairQueue } from "@/lib/arena/engine";
import { getOnlineCounts } from "@/lib/arena/presence";
import { requireArenaIdentity } from "@/lib/arena/guard";
import { guardRequest } from "@/lib/http/guard";

export const dynamic = "force-dynamic";

/** Join the queue (optionally straight into a bot match). */
export async function POST(request: Request) {
  const blocked = guardRequest(request, "arena:queue:join", 60);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { bot?: unknown };

  if (body.bot === true) {
    const matchId = await createBotMatch(guard.identity);
    if (!matchId) {
      return NextResponse.json({ error: "No words available." }, { status: 503 });
    }
    return NextResponse.json({ status: "matched", matchId });
  }

  await joinQueue(guard.identity);
  return NextResponse.json({ status: "waiting" });
}

/** Poll the queue: pairs atomically when an opponent is available. */
export async function GET(request: Request) {
  const blocked = guardRequest(request, "arena:queue:poll", 240);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const existing = await findMyQueue(guard.identity);
  if (existing?.status === "MATCHED" && existing.matchId) {
    return NextResponse.json({ status: "matched", matchId: existing.matchId });
  }

  if (!existing || existing.status !== "WAITING") {
    return NextResponse.json({ status: "idle", online: await getOnlineCounts() });
  }

  if (Date.now() - existing.lastSeenAt.getTime() > ARENA_QUEUE.staleMs) {
    await leaveQueue(guard.identity);
    return NextResponse.json({ status: "idle", online: await getOnlineCounts() });
  }

  const matchId = await pairQueue(guard.identity);
  const online = await getOnlineCounts();

  if (matchId) return NextResponse.json({ status: "matched", matchId, online });

  return NextResponse.json({
    status: "waiting",
    waitingMs: Date.now() - existing.joinedAt.getTime(),
    online,
  });
}

/** Leave the queue. */
export async function DELETE(request: Request) {
  const blocked = guardRequest(request, "arena:queue:leave", 60);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  await leaveQueue(guard.identity);
  return NextResponse.json({ status: "idle" });
}
