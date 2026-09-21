import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConnectionsBoard } from "@/components/games/connections/connections-board";
import { getConnectionsGame, startConnections } from "@/lib/games/connections";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const metadata: Metadata = {
  title: "Connections",
  description:
    "Group sixteen words into four hidden categories. Find the connections before you run out of mistakes. A new daily puzzle at midnight IST.",
};

export default async function ConnectionsPage() {
  const game = await getConnectionsGame();
  if (!game) notFound();

  const identity = await getIdentity();
  const view = hasIdentity(identity) ? await startConnections(game, identity) : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10">
      <Link
        href="/games"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All games
      </Link>

      <header className="mt-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{game.name}</h1>
        <p className="mt-1 text-sm text-muted">{game.tagline}</p>
      </header>

      <section className="mt-8">
        <ConnectionsBoard initialView={view} />
      </section>

      <section className="glass mx-auto mt-10 max-w-lg rounded-2xl p-5 text-sm text-muted">
        <h2 className="text-base font-semibold text-foreground">How to play</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Find four groups of four words that share something in common.</li>
          <li>Select four tiles and submit them to check.</li>
          <li>You have four mistakes before the puzzle ends.</li>
          <li>Groups get harder as you go: honey, moss, copper, then mahogany.</li>
        </ul>
      </section>
    </div>
  );
}
