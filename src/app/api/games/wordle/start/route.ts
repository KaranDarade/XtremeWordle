import { NextResponse } from "next/server";

import { getWordleGame, startWordle } from "@/lib/games/wordle";
import type { WordleMode } from "@/lib/games/wordle-view";
import { readJsonObject, asString } from "@/lib/http/json";
import { guardRequest } from "@/lib/http/guard";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardRequest(request, "wordle:start", 60);
  if (blocked) return blocked;

  const body = await readJsonObject(request);
  const mode: WordleMode = asString(body.mode) === "UNLIMITED" ? "UNLIMITED" : "DAILY";

  const game = await getWordleGame();
  if (!game) {
    return NextResponse.json({ error: "Wordle is unavailable right now." }, { status: 404 });
  }

  const identity = await getIdentity();
  if (!hasIdentity(identity)) {
    return NextResponse.json({ error: "No player session." }, { status: 400 });
  }

  const view = await startWordle(game, identity, mode);
  if (!view) {
    return NextResponse.json({ error: "No words are available." }, { status: 503 });
  }

  return NextResponse.json(view);
}
