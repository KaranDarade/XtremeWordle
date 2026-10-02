import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

import { BrainLogo } from "@/components/brand/brain-logo";
import { NeuralField } from "@/components/brand/neural-field";
import { ArenaBand } from "@/components/games/arena-band";
import { GameCard } from "@/components/games/game-card";
import { GamesJsonLd } from "@/components/games/games-json-ld";
import { getPublicGames, getPublicStats } from "@/lib/games/public";

export default async function HomePage() {
  const [games, stats] = await Promise.all([getPublicGames(), getPublicStats()]);

  return (
    <div className="relative">
      <NeuralField />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        <GamesJsonLd games={games} />

        {/* Compact hero — just enough to orient, then straight into the games. */}
        <section className="rise-in pt-8 text-center sm:pt-12">
          <span className="brand-badge mx-auto mb-4 grid size-14 place-items-center rounded-2xl sm:size-16">
            <BrainLogo className="size-9 sm:size-10" />
          </span>
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

        {/* The arena is the headline act. */}
        <ArenaBand />

        {/* Then the rest of the catalogue. */}
        <section className="mt-12 sm:mt-16" id="games">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">More games</h2>
          <p className="mt-1 text-sm text-muted">
            Daily puzzles that reset at midnight IST. Free, no account needed.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game, index) => (
              <GameCard key={game.id} game={game} index={index} />
            ))}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted sm:text-sm">
          {stats.gamesCount + 1} games · {stats.playsCount.toLocaleString()} plays ·{" "}
          {stats.wordsCount.toLocaleString()} words in play
        </p>
      </div>
    </div>
  );
}
