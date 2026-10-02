import type { Metadata } from "next";
import Link from "next/link";

import { ScheduleForm } from "@/components/admin/schedule-form";
import { ScheduleTable } from "@/components/admin/schedule-table";
import { getSchedule, listGames } from "@/lib/admin/queries";
import { bucketKeyForMode, dailyBucketKey, type RotationMode } from "@/lib/time/buckets";
import { parseGameSettings } from "@/lib/words/resolver";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Word schedule", robots: { index: false } };

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const games = await listGames();

  if (games.length === 0) {
    return <p className="text-sm text-muted">No games exist yet. Run the seed script first.</p>;
  }

  const slugParam = typeof sp.game === "string" ? sp.game : games[0].slug;
  const game = games.find((candidate) => candidate.slug === slugParam) ?? games[0];
  const mode: RotationMode = sp.mode === "twelve-hour" ? "twelve-hour" : "daily";

  const rows = await getSchedule(game, mode);
  const defaultDate = dailyBucketKey();
  const wordGames = games
    .filter((candidate) => parseGameSettings(candidate.settings).resolver !== "puzzle")
    .map((candidate) => ({ slug: candidate.slug, name: candidate.name }));

  const currentBucket = bucketKeyForMode(mode, new Date());

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Word schedule</h1>
        <p className="text-sm text-muted">
          Preview upcoming rotations, override any slot manually, or force a new word.
        </p>
      </header>

      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <span className="px-1 text-xs font-semibold text-muted uppercase">Game</span>
        {games.map((candidate) => (
          <Link
            key={candidate.slug}
            href={`/admin/schedule?game=${candidate.slug}&mode=${mode}`}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-medium transition",
              candidate.slug === game.slug
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:bg-white/10 hover:text-foreground",
            )}
          >
            {candidate.name}
          </Link>
        ))}
        <span className="ml-auto px-1 text-xs font-semibold text-muted uppercase">Rotation</span>
        {(["daily", "twelve-hour"] as RotationMode[]).map((value) => (
          <Link
            key={value}
            href={`/admin/schedule?game=${game.slug}&mode=${value}`}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-medium transition",
              value === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:bg-white/10 hover:text-foreground",
            )}
          >
            {value === "daily" ? "Daily" : "Every 12h"}
          </Link>
        ))}
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Assign a word manually</h2>
        <p className="mb-4 text-xs text-muted">
          Manual words always win over automatic rotation for that slot.
        </p>
        {wordGames.length > 0 ? (
          <ScheduleForm games={wordGames} defaultDate={defaultDate} defaultMode={mode} />
        ) : (
          <p className="text-sm text-muted">
            Manual assignment is only available for word-list games. Use &ldquo;Force new&rdquo;
            below for puzzle games.
          </p>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {game.name} · {mode === "daily" ? "Daily" : "Every 12 hours"}
          </h2>
          <p className="text-xs text-muted">
            Current slot: <span className="font-mono">{currentBucket}</span>
          </p>
        </div>
        <ScheduleTable gameSlug={game.slug} rows={rows} />
      </section>
    </>
  );
}
