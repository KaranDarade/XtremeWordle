import type { Metadata } from "next";
import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import { getAnalytics, listGames } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics", robots: { index: false } };

export default async function AdminAnalyticsPage({
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
  const data = await getAnalytics(game.id);

  const maxSeries = Math.max(1, ...data.series.map((point) => point.plays));
  const maxDistribution = Math.max(1, ...data.distribution.map((row) => row.count));

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted">Play volume and difficulty signals per game.</p>
      </header>

      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
        {games.map((candidate) => (
          <Link
            key={candidate.slug}
            href={`/admin/analytics?game=${candidate.slug}`}
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
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total plays" value={data.totalPlays.toLocaleString()} />
        <StatCard label="Solve rate" value={`${data.solveRate}%`} hint={`${data.solved} solved`} />
        <StatCard
          label="Avg attempts"
          value={data.avgAttempts ? data.avgAttempts.toFixed(2) : "—"}
        />
        <StatCard
          label="Registered vs guest"
          value={`${data.registered} / ${data.guests}`}
          hint="Signed-in vs anonymous"
        />
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Plays in the last 14 days</h2>
        <div className="mt-4 flex h-40 items-end gap-1.5" data-testid="analytics-series">
          {data.series.map((point) => {
            // A percentage height only resolves against a parent with a definite
            // height, so each column is h-full and bars are floored at 4% when
            // there is activity (otherwise a small day is invisible).
            const ratio = point.plays / maxSeries;
            const height = point.plays === 0 ? 0 : Math.max(4, Math.round(ratio * 100));

            return (
              <div
                key={point.date}
                className="group flex h-full flex-1 flex-col justify-end"
                title={`${point.date}: ${point.plays} plays, ${point.solved} solved`}
              >
                <div
                  data-testid="analytics-bar"
                  data-plays={point.plays}
                  className="w-full rounded-t bg-primary/70 transition group-hover:bg-primary"
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted">
          <span>{data.series[0]?.date}</span>
          <span>{data.series[data.series.length - 1]?.date}</span>
        </div>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Attempts distribution (solved games)</h2>
        {data.distribution.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No solved games recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.distribution.map((row) => (
              <li key={row.attempts} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 font-mono text-xs text-muted">
                  {row.attempts} tries
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((row.count / maxDistribution) * 100)}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
