import { NextResponse } from "next/server";

import { getArenaState } from "@/lib/arena/engine";
import { requireArenaIdentity } from "@/lib/arena/guard";
import { guardRequest } from "@/lib/http/guard";

export const dynamic = "force-dynamic";

/** Current match state. Accepts `?after=<version>` for a future long-poll. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = guardRequest(request, "arena:state", 600);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const state = await getArenaState(id, guard.identity);
  if (!state) return NextResponse.json({ error: "Match not found." }, { status: 404 });

  return NextResponse.json(state);
}
