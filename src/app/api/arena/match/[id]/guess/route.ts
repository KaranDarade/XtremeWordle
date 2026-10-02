import { NextResponse } from "next/server";

import { submitArenaGuess } from "@/lib/arena/engine";
import { requireArenaIdentity } from "@/lib/arena/guard";
import { guardRequest } from "@/lib/http/guard";
import { asString, readJsonObject } from "@/lib/http/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = guardRequest(request, "arena:guess", 240);
  if (blocked) return blocked;

  const guard = await requireArenaIdentity();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const body = await readJsonObject(request);
  const guess = asString(body.guess);

  if (!guess) return NextResponse.json({ error: "Missing guess." }, { status: 400 });

  const outcome = await submitArenaGuess(id, guard.identity, guess);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 422 });
  }

  return NextResponse.json(outcome.state);
}
