import { NextResponse } from "next/server";

import { leaveMatch } from "@/lib/arena/engine";
import { requireArenaIdentity } from "@/lib/arena/guard";
import { leaveQueue } from "@/lib/arena/engine";
import { guardRequest } from "@/lib/http/guard";

export const dynamic = "force-dynamic";

/** Leave the match (forfeit) and clear any queue entry. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = guardRequest(request, "arena:leave", 60);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  await leaveMatch(id, guard.identity);
  await leaveQueue(guard.identity);

  return NextResponse.json({ ok: true });
}
