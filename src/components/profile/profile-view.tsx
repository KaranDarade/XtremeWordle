import { Palette, Swords } from "lucide-react";
import Link from "next/link";

import { GlassCard } from "@/components/ui/glass-card";
import type { LeagueName } from "@/lib/arena/config";
import type { ProfileBundle } from "@/lib/profile/queries";

import { HeadToHeadList, MatchList, ProfileHeader } from "./profile-parts";
import { StatTile } from "./stat-tile";

export function ProfileView({ profile, isOwner }: { profile: ProfileBundle; isOwner: boolean }) {
  const { identity, league, record, ranked, recent, headToHead } = profile;

  return (
    <div className="space-y-6">
      <ProfileHeader
        name={identity.name ?? identity.username}
        username={identity.username}
        avatar={identity.avatarConfig}
        league={league.name as LeagueName}
        points={league.points}
        isPublic={!isOwner}
      />

      <GlassCard className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold" data-testid="league-name">
            {league.name.charAt(0) + league.name.slice(1).toLowerCase()} league
          </h2>
          <p className="text-sm text-muted">
            <span data-testid="rank-points">{league.points}</span> points
          </p>
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(league.progress * 100)}
          aria-label="Progress to next league"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.round(league.progress * 100)}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-muted" data-testid="league-progress">
          {league.nextLeague && league.pointsToNext !== null
            ? `${league.pointsToNext} points to ${league.nextLeague.toLowerCase()}`
            : "Top league reached"}
        </p>
      </GlassCard>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Matches played" value={record.played} hint={`${ranked.played} ranked`} />
        <StatTile
          label="Win rate"
          value={`${record.winRate}%`}
          hint={`${record.wins}W · ${record.losses}L${record.draws ? ` · ${record.draws}D` : ""}`}
        />
        <StatTile
          label="Solve rate"
          value={`${record.solveRate}%`}
          hint={`${record.solved} solved`}
        />
        <StatTile
          label="Avg solve round"
          value={record.averageSolvedRound ?? "—"}
          hint={record.bestRound ? `Best: round ${record.bestRound}` : "No solves yet"}
        />
        <StatTile
          label="Ranked record"
          value={`${ranked.wins}–${ranked.losses}`}
          hint="Points only change here"
        />
        <StatTile
          label="Streak"
          value={identity.currentStreak}
          hint={`Best ${identity.bestStreak}`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="font-semibold">Recent matches</h2>
          <div className="mt-3">
            <MatchList matches={recent} />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="font-semibold">Head to head</h2>
          <div className="mt-3">
            <HeadToHeadList rows={headToHead} />
          </div>
        </GlassCard>
      </div>

      {isOwner ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/profile/avatar"
            className="glass glass-interactive inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <Palette className="size-4" />
            Customise avatar
          </Link>
          <Link
            href="/arena"
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <Swords className="size-4" />
            Go to the arena
          </Link>
          <Link
            href={`/u/${identity.username}`}
            className="glass glass-interactive inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            View public profile
          </Link>
        </div>
      ) : null}
    </div>
  );
}
