import { Clock, Swords, Users } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { requireAdmin } from "@/lib/auth/dal";
import { getArenaAdminOverview, forceEndMatchAction } from "@/lib/admin/arena";
import { cn } from "@/lib/utils";

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function AdminArenaPage() {
  await requireAdmin();
  const overview = await getArenaAdminOverview();

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Arena</h1>
        <p className="text-sm text-muted">Live matches, queue depth and recent results.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Swords} label="Live matches" value={overview.liveMatches} />
        <Stat
          icon={Users}
          label="Online now"
          value={overview.online}
          hint={`${overview.inMatch} in matches`}
        />
        <Stat icon={Clock} label="Waiting in queue" value={overview.queued} />
        <Stat icon={Swords} label="Finished (24h)" value={overview.finishedToday} />
      </section>

      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-[var(--glass-border)] px-4 py-3">
          <h2 className="font-semibold">Recent matches</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" data-testid="admin-arena-matches">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Players</th>
                <th className="px-4 py-2">Word</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Outcome</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overview.matches.map((match) => (
                <tr key={match.id} className="border-t border-white/10">
                  <td className="px-4 py-2 whitespace-nowrap text-muted">
                    {formatDateTime(match.startedAt)}
                  </td>
                  <td className="px-4 py-2">{match.players.join(" vs ") || "—"}</td>
                  <td className="px-4 py-2 font-mono uppercase">{match.word}</td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        match.status === "PLAYING"
                          ? "bg-primary/15 text-primary"
                          : "bg-white/10 text-muted",
                      )}
                    >
                      {match.status}
                    </span>
                    {match.isCasual ? (
                      <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-muted">
                        casual
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">
                    {match.isDraw ? "draw" : (match.endReason ?? "—")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {match.status === "PLAYING" ? (
                      <form action={forceEndMatchAction}>
                        <input type="hidden" name="matchId" value={match.id} />
                        <button
                          type="submit"
                          data-testid={`force-end-${match.id}`}
                          className="glass rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:opacity-80"
                        >
                          Force end
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {overview.matches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No matches played yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Swords;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {hint ? <p className="text-xs text-muted">{hint}</p> : null}
        </div>
        <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}
