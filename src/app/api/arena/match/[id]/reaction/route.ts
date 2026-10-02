import { NextResponse } from "next/server";

import { REACTION_EMOJI, sendReaction } from "@/lib/arena/engine";
import { requireArenaIdentity } from "@/lib/arena/guard";
import { guardRequest } from "@/lib/http/guard";
import { asString, readJsonObject } from "@/lib/http/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = guardRequest(request, "arena:reaction", 120);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const body = await readJsonObject(request);
  const emoji = asString(body.emoji);

  if (!emoji || !REACTION_EMOJI.includes(emoji as (typeof REACTION_EMOJI)[number])) {
    return NextResponse.json({ error: "Unsupported reaction." }, { status: 400 });
  }

  const sent = await sendReaction(id, guard.identity, emoji);
  if (!sent) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  return NextResponse.json({ ok: true, emoji });
}
