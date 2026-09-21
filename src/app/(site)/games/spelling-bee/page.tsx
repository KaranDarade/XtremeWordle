import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BeeBoard } from "@/components/games/bee/bee-board";
import { getBeeGame, startBee } from "@/lib/games/bee";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const metadata: Metadata = {
  title: "Spelling Bee",
  description:
    "Make as many words as you can from seven letters. Every word must use the centre letter — find the pangram for a bonus. Free daily word game.",
};

export default async function SpellingBeePage() {
  const game = await getBeeGame();
  if (!game) notFound();

  const identity = await getIdentity();
  const view = hasIdentity(identity) ? await startBee(game, identity) : null;

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
        <BeeBoard initialView={view} />
      </section>

      <section className="glass mx-auto mt-10 max-w-lg rounded-2xl p-5 text-sm text-muted">
        <h2 className="text-base font-semibold text-foreground">How to score</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Words must be at least four letters and include the centre letter.</li>
          <li>You may reuse letters, but only the seven shown.</li>
          <li>Four-letter words score 1 point; longer words score their length.</li>
          <li>A pangram uses all seven letters and earns a 7 point bonus.</li>
          <li>A new letter set arrives at midnight IST.</li>
        </ul>
      </section>
    </div>
  );
}
