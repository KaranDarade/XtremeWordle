import type { Metadata } from "next";
import { Crown } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/avatar/avatar";
import { LeagueBadge } from "@/components/profile/league-badge";
import { GlassCard } from "@/components/ui/glass-card";
import type { LeagueName } from "@/lib/arena/config";
import { getCurrentUser } from "@/lib/auth/dal";
import { getLeaderboard } from "@/lib/profile/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The top Wordle Arena duelists, ranked by league points.",
};

export default async function LeaderboardPage() {
  const [entries, viewer] = await Promise.all([getLeaderboard(100), getCurrentUser()]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-10">
      <header className="text-center">
        <span className="brand-badge mx-auto mb-4 grid size-14 place-items-center rounded-2xl">
          <Crown className="size-7 text-primary" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Top duelists by rank points. Win ranked matches to climb.
        </p>
      </header>

      <GlassCard className="mt-8 overflow-hidden p-0">
        {entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted" data-testid="leaderboard-empty">
            Nobody has earned rank points yet. Play a ranked duel to claim first place.
          </p>
        ) : (
          <ol data-testid="leaderboard" className="divide-y divide-[var(--glass-border)]">
            {entries.map((entry, index) => {
              const isViewer = viewer?.id === entry.id;

              return (
                <li
                  key={entry.id}
                  data-testid={`leaderboard-row-${index + 1}`}
                  className={cn("flex items-center gap-3 px-4 py-3", isViewer && "bg-primary/10")}
                >
                  <span
                    className={cn(
                      "w-8 shrink-0 text-center text-sm font-bold tabular-nums",
                      index === 0 ? "text-[#e6bb78]" : index < 3 ? "text-foreground" : "text-muted",
                    )}
                  >
                    {index + 1}
                  </span>

                  <Avatar config={entry.avatarConfig} className="size-9 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${entry.username}`}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {entry.name ?? entry.username}
                      {isViewer ? <span className="ml-2 text-[11px] text-primary">you</span> : null}
                    </Link>
                    <p className="truncate text-[11px] text-muted">
                      @{entry.username} · {entry.wins}W {entry.losses}L
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <LeagueBadge league={entry.league as LeagueName} />
                    <span className="w-14 text-right text-sm font-bold tabular-nums">
                      {entry.rankPoints}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </GlassCard>
    </div>
  );
}
