import type { Metadata } from "next";
import { ArrowLeft, Flame, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WordleBoard } from "@/components/games/wordle/wordle-board";
import { getRecentWordleStats, getWordleGame, startWordle } from "@/lib/games/wordle";
import { getIdentity, hasIdentity } from "@/lib/session/identity";

export const metadata: Metadata = {
  title: "Wordle",
  description:
    "Guess the hidden five-letter word in six tries. Play the daily Bubble Wordle puzzle or unlimited mode — free, no account required.",
};

export default async function WordlePage() {
  const game = await getWordleGame();
  if (!game) notFound();

  const identity = await getIdentity();
  const canPlay = hasIdentity(identity);
  const [view, stats] = await Promise.all([
    canPlay ? startWordle(game, identity, "DAILY") : Promise.resolve(null),
    canPlay ? getRecentWordleStats(game.id, identity) : Promise.resolve(null),
  ]);

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

      {stats && stats.played > 0 ? (
        <section className="mt-6 grid grid-cols-3 gap-3">
          <StatChip icon={Trophy} label="Played" value={String(stats.played)} />
          <StatChip icon={Target} label="Win rate" value={`${stats.winRate}%`} />
          <StatChip icon={Flame} label="Streak" value={String(stats.streak)} />
        </section>
      ) : null}

      <section className="mt-8">
        <WordleBoard initialView={view} isGuest={!identity.userId} />
      </section>

      <section className="glass mx-auto mt-10 max-w-lg rounded-2xl p-5 text-sm text-muted">
        <h2 className="text-base font-semibold text-foreground">How to play</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Type any valid five-letter word and press Enter.</li>
          <li>
            <span className="font-semibold text-lime-600 dark:text-lime-400">Green</span> means the
            right letter in the right spot.
          </li>
          <li>
            <span className="font-semibold text-amber-600 dark:text-amber-400">Yellow</span> means
            the letter is in the word but in the wrong spot.
          </li>
          <li>
            <span className="font-semibold text-stone-500 dark:text-stone-400">Grey</span> means the
            letter is not in the word at all.
          </li>
          <li>You have six attempts. Daily resets at midnight IST.</li>
        </ul>
      </section>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="glass flex flex-col items-center rounded-2xl p-3 text-center">
      <Icon className="size-4 text-primary" />
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
