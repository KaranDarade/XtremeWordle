import { NextResponse } from "next/server";

import { getBeeGame, startBee } from "@/lib/games/bee";
import { guardRequest } from "@/lib/http/guard";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardRequest(request, "bee:start", 60);
  if (blocked) return blocked;

  const game = await getBeeGame();
  if (!game) {
    return NextResponse.json({ error: "Spelling Bee is unavailable right now." }, { status: 404 });
  }

  const identity = await getIdentity();
  if (!hasIdentity(identity)) {
    return NextResponse.json({ error: "No player session." }, { status: 400 });
  }

  const view = await startBee(game, identity);
  if (!view) {
    return NextResponse.json({ error: "No puzzle is available today." }, { status: 503 });
  }

  return NextResponse.json(view);
}
