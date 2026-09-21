import type { Metadata } from "next";
import {
  Activity,
  CalendarClock,
  Gamepad2,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import { getOverviewStats, getRecentActivity, getRecentSignups } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview", robots: { index: false } };

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function AdminOverviewPage() {
  const [stats, signups, activity] = await Promise.all([
    getOverviewStats(),
    getRecentSignups(6),
    getRecentActivity(8),
  ]);

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted">Platform health at a glance. All times are IST.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={stats.totalUsers.toLocaleString()}
          hint={`+${stats.newUsers7d} this week`}
          icon={Users}
        />
        <StatCard
          label="Guest sessions"
          value={stats.totalGuests.toLocaleString()}
          hint="Anonymous players"
          icon={UserPlus}
        />
        <StatCard
          label="Games played (7d)"
          value={stats.results7d.toLocaleString()}
          hint={`${stats.resultsToday} today`}
          icon={Activity}
        />
        <StatCard
          label="Solve rate (7d)"
          value={`${stats.solveRate7d}%`}
          hint={`${stats.solved7d} solved`}
          icon={Target}
        />
        <StatCard
          label="Avg attempts"
          value={stats.avgAttempts ? stats.avgAttempts.toFixed(2) : "—"}
          hint="Solved games"
          icon={TrendingUp}
        />
        <StatCard
          label="Active games"
          value={stats.activeGames}
          hint={`${stats.totalWords.toLocaleString()} words loaded`}
          icon={Gamepad2}
        />
        <StatCard
          label="Puzzles today"
          value={stats.puzzlesToday}
          hint="Materialised rows"
          icon={CalendarClock}
        />
        <StatCard
          label="Banned users"
          value={stats.bannedUsers}
          hint="Suspended accounts"
          icon={Users}
          className={cn(stats.bannedUsers > 0 && "border-danger/30")}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent signups</h2>
            <Link href="/admin/users" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {signups.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{user.name ?? "Unnamed"}</span>{" "}
                  <span className="text-muted">{user.email}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDate(user.createdAt)}</span>
              </li>
            ))}
            {signups.length === 0 ? <li className="text-sm text-muted">No users yet.</li> : null}
          </ul>
        </div>

        <div className="glass rounded-2xl p-4">
          <h2 className="font-semibold">Recent games</h2>
          <ul className="mt-3 space-y-2">
            {activity.map((result) => (
              <li key={result.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{result.game.name}</span>{" "}
                  <span className="text-muted">
                    {result.user?.name ?? result.user?.email ?? "Guest"}
                  </span>
                </span>
                <span className="shrink-0 text-xs">
                  <span className={result.solved ? "text-success" : "text-danger"}>
                    {result.solved ? `solved in ${result.attempts}` : "lost"}
                  </span>
                </span>
              </li>
            ))}
            {activity.length === 0 ? (
              <li className="text-sm text-muted">No games played yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </>
  );
}
