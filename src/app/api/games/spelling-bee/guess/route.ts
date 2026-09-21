import { NextResponse } from "next/server";

import { getBeeGame, submitBeeWord } from "@/lib/games/bee";
import { asString, readJsonObject } from "@/lib/http/json";
import { guardRequest } from "@/lib/http/guard";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardRequest(request, "bee:guess", 120);
  if (blocked) return blocked;

  const body = await readJsonObject(request);
  const resultId = asString(body.resultId);
  const word = asString(body.word);

  if (!resultId || !word) {
    return NextResponse.json({ error: "Missing resultId or word." }, { status: 400 });
  }

  const game = await getBeeGame();
  if (!game) {
    return NextResponse.json({ error: "Spelling Bee is unavailable right now." }, { status: 404 });
  }

  const identity = await getIdentity();
  if (!hasIdentity(identity)) {
    return NextResponse.json({ error: "No player session." }, { status: 400 });
  }

  const outcome = await submitBeeWord(game, identity, resultId, word);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json({
    ...outcome.view,
    acceptedWord: outcome.word,
    acceptedScore: outcome.score,
    isPangram: outcome.isPangram,
  });
}
