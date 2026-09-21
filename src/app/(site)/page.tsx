import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

import { BubbleField } from "@/components/brand/bubble-field";
import { GameCard } from "@/components/games/game-card";
import { GamesJsonLd } from "@/components/games/games-json-ld";
import { getPublicGames, getPublicStats } from "@/lib/games/public";

export default async function HomePage() {
  const [games, stats] = await Promise.all([getPublicGames(), getPublicStats()]);

  return (
    <div className="relative">
      <BubbleField />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        <GamesJsonLd games={games} />

        {/* Compact hero — just enough to orient, then straight into the games. */}
        <section className="rise-in pt-8 text-center sm:pt-12">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Play. Guess. <span className="text-primary">Repeat.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted sm:text-base">
            Daily word puzzles. New challenge at midnight IST.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/games/${games[0]?.slug ?? "wordle"}`}
              data-testid="hero-play"
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold"
            >
              <Zap className="size-4" />
              Play now
            </Link>
            <Link
              href="/games"
              data-testid="hero-browse"
              className="glass glass-interactive inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold"
            >
              All games
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* The games are the page. */}
        <section className="mt-9 sm:mt-12" id="games">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game, index) => (
              <GameCard key={game.id} game={game} index={index} />
            ))}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted sm:text-sm">
          {stats.gamesCount} games · {stats.playsCount.toLocaleString()} plays ·{" "}
          {stats.wordsCount.toLocaleString()} words in play
        </p>
      </div>
    </div>
  );
}
