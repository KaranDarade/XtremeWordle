import type { Metadata } from "next";

import { GameCard } from "@/components/games/game-card";
import { getPublicGames } from "@/lib/games/public";

export const metadata: Metadata = {
  title: "All games",
  description:
    "Browse every game on Bubble Wordle — daily word puzzles, unlimited modes and more. Free to play, no account required.",
};

export default async function GamesPage() {
  const games = await getPublicGames();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">All games</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Every game shares the same daily rhythm: a new challenge at midnight IST, plus a 12-hour
          refresh for unlimited play.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} />
        ))}
      </div>

      {games.length === 0 ? (
        <p className="glass mt-8 rounded-2xl p-6 text-sm text-muted">
          No games are published yet. Check back soon.
        </p>
      ) : null}
    </div>
  );
}
