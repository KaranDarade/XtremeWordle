import { NextResponse } from "next/server";

import { getWordleGame, submitWordleGuess } from "@/lib/games/wordle";
import { asString, readJsonObject } from "@/lib/http/json";
import { guardRequest } from "@/lib/http/guard";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardRequest(request, "wordle:guess", 120);
  if (blocked) return blocked;

  const body = await readJsonObject(request);
  const resultId = asString(body.resultId);
  const guess = asString(body.guess);

  if (!resultId || !guess) {
    return NextResponse.json({ error: "Missing resultId or guess." }, { status: 400 });
  }

  const game = await getWordleGame();
  if (!game) {
    return NextResponse.json({ error: "Wordle is unavailable right now." }, { status: 404 });
  }

  const identity = await getIdentity();
  if (!hasIdentity(identity)) {
    return NextResponse.json({ error: "No player session." }, { status: 400 });
  }

  const outcome = await submitWordleGuess(game, identity, resultId, guess);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json(outcome.view);
}
