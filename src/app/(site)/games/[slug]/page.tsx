import type { Metadata } from "next";
import { ArrowLeft, CalendarClock, Gamepad2, Sparkles, Swords } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getGameAccent } from "@/components/games/game-accent";
import { GlassCard } from "@/components/ui/glass-card";
import { getPublicGameBySlug, getPublicGames } from "@/lib/games/public";
import { dailyBucketKey } from "@/lib/time/buckets";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getPublicGameBySlug(slug);
  if (!game) return { title: "Game not found" };

  return {
    title: game.name,
    description: game.description ?? game.tagline ?? `Play ${game.name} on Wordle Arena.`,
  };
}

export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getPublicGameBySlug(slug);

  if (!game) notFound();

  const accent = getGameAccent(game.slug);
  const Icon = accent.icon;
  const allGames = await getPublicGames();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-10">
      <Link
        href="/games"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All games
      </Link>

      <header className="glass mt-4 rounded-3xl p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Icon className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{game.name}</h1>
            <p className="mt-1 text-sm text-muted">{game.tagline}</p>
          </div>
        </div>

        {game.description ? (
          <p className="mt-4 text-sm text-muted sm:text-base">{game.description}</p>
        ) : null}

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <Stat icon={Gamepad2} label="Plays" value={game._count.gameResults.toLocaleString()} />
          <Stat
            icon={Sparkles}
            label="Words loaded"
            value={game._count.wordEntries.toLocaleString()}
          />
          <Stat
            icon={CalendarClock}
            label="Puzzles scheduled"
            value={game._count.dailyPuzzles.toLocaleString()}
          />
        </dl>
      </header>

      <GlassCard className="mt-6 p-6 text-center">
        <p className="text-sm font-semibold">Not playable yet</p>
        <p className="mt-1 text-sm text-muted">
          {game.name} is published in the catalogue but its board has not shipped yet. The daily
          word for <span className="font-mono text-xs">{dailyBucketKey()}</span> is already
          scheduled and waiting.
        </p>
        <Link
          href="/arena"
          className="btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          <Swords className="size-4" />
          Play the Arena instead
        </Link>
      </GlassCard>

      {allGames.length > 1 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">More games</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {allGames
              .filter((candidate) => candidate.slug !== game.slug)
              .map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/games/${candidate.slug}`}
                  className="glass glass-interactive rounded-xl px-3.5 py-2 text-sm font-medium"
                >
                  {candidate.name}
                </Link>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gamepad2;
  label: string;
  value: string;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="font-bold">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}
