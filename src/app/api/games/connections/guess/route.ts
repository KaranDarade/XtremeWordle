import { NextResponse } from "next/server";

import { getConnectionsGame, submitConnectionsGuess } from "@/lib/games/connections";
import { readJsonObject } from "@/lib/http/json";
import { guardRequest } from "@/lib/http/guard";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardRequest(request, "connections:guess", 120);
  if (blocked) return blocked;

  const body = await readJsonObject(request);
  const resultId = typeof body.resultId === "string" ? body.resultId : null;
  const selection = Array.isArray(body.words)
    ? body.words.filter((word): word is string => typeof word === "string")
    : [];

  if (!resultId || selection.length !== 4) {
    return NextResponse.json({ error: "Select exactly four words." }, { status: 400 });
  }

  const game = await getConnectionsGame();
  if (!game) {
    return NextResponse.json({ error: "Connections is unavailable right now." }, { status: 404 });
  }

  const identity = await getIdentity();
  if (!hasIdentity(identity)) {
    return NextResponse.json({ error: "No player session." }, { status: 400 });
  }

  const outcome = await submitConnectionsGuess(game, identity, resultId, selection);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json({
    ...outcome.view,
    correct: outcome.correct,
    matchedCategory: outcome.category,
  });
}
