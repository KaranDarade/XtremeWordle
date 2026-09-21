import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatCard } from "@/components/admin/stat-card";
import { UserActions } from "@/components/admin/user-actions";
import { requireAdmin } from "@/lib/auth/dal";
import { getUserDetail } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "User detail", robots: { index: false } };

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [admin, detail] = await Promise.all([requireAdmin(), getUserDetail(id)]);

  if (!detail) notFound();

  const { user, sessions, results, stats } = detail;

  return (
    <>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to users
      </Link>

      <header className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="user-detail-name">
              {user.name ?? "Unnamed"}
            </h1>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="glass rounded-full px-2.5 py-1 font-semibold">{user.role}</span>
            {user.isBanned ? (
              <span className="rounded-full bg-danger/15 px-2.5 py-1 font-semibold text-danger">
                BANNED
              </span>
            ) : (
              <span className="rounded-full bg-success/15 px-2.5 py-1 font-semibold text-success">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-muted uppercase">Joined</dt>
            <dd>{formatDateTime(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted uppercase">Last login</dt>
            <dd>{formatDateTime(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted uppercase">User ID</dt>
            <dd className="font-mono text-xs break-all">{user.id}</dd>
          </div>
        </dl>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Games played" value={stats.played} />
        <StatCard label="Solved" value={stats.solved} />
        <StatCard label="Solve rate" value={`${stats.solveRate}%`} />
        <StatCard
          label="Avg attempts"
          value={stats.avgAttempts ? stats.avgAttempts.toFixed(2) : "—"}
        />
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Account actions</h2>
        <p className="mb-4 text-xs text-muted">
          Password resets and bans immediately invalidate every active session.
        </p>
        <UserActions userId={user.id} isBanned={user.isBanned} isSelf={user.id === admin.id} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <h2 className="font-semibold">Game history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {results.map((result) => (
              <li key={result.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{result.game.name}</span>{" "}
                  <span className="text-muted">
                    {result.mode.toLowerCase()} · {result.bucketKey ?? "—"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold",
                    result.solved ? "text-success" : "text-danger",
                  )}
                >
                  {result.solved ? `solved in ${result.attempts}` : "lost"}
                </span>
              </li>
            ))}
            {results.length === 0 ? <li className="text-muted">No games played yet.</li> : null}
          </ul>
        </div>

        <div className="glass rounded-2xl p-4">
          <h2 className="font-semibold">Recent sessions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted">
                  {session.userAgent ?? "Unknown device"}
                </span>
                <span className="shrink-0 text-xs">
                  {session.status === "revoked" ? (
                    <span className="text-danger">revoked</span>
                  ) : session.status === "expired" ? (
                    <span className="text-muted">expired</span>
                  ) : (
                    <span className="text-success">active</span>
                  )}
                </span>
              </li>
            ))}
            {sessions.length === 0 ? <li className="text-muted">No sessions recorded.</li> : null}
          </ul>
        </div>
      </section>
    </>
  );
}
