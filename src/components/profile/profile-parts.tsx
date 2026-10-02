import { Bot, Swords, UserRound } from "lucide-react";

import { Avatar } from "@/components/avatar/avatar";
import { LeagueBadge } from "@/components/profile/league-badge";
import { avatarFromSeed, normalizeAvatar, type AvatarConfig } from "@/lib/avatar/config";
import type { LeagueName } from "@/lib/arena/config";
import type { HeadToHead, MatchSummary, Record } from "@/lib/profile/stats";
import { cn } from "@/lib/utils";

export function opponentAvatar(opponent: {
  avatarConfig: unknown;
  avatarSeed: string | null;
}): AvatarConfig {
  if (opponent.avatarConfig) return normalizeAvatar(opponent.avatarConfig);
  if (opponent.avatarSeed) return avatarFromSeed(opponent.avatarSeed);
  return normalizeAvatar(null);
}

const RESULT_STYLES = {
  WIN: "text-success",
  LOSS: "text-danger",
  DRAW: "text-muted",
} as const;

function relativeDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export function MatchList({ matches }: { matches: MatchSummary[] }) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-muted" data-testid="no-matches">
        No matches yet. Head to the arena to play your first duel.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--glass-border)]" data-testid="match-list">
      {matches.map((match) => (
        <li key={match.id} className="flex items-center gap-3 py-2.5">
          <Avatar
            config={opponentAvatar(match.opponent ?? { avatarConfig: null, avatarSeed: null })}
            className="size-9"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {match.opponent?.displayName ?? "Unknown"}
              {match.opponent?.isBot ? (
                <Bot className="ml-1.5 inline size-3.5 text-muted" aria-label="Bot" />
              ) : null}
            </p>
            <p className="text-[11px] text-muted">
              {relativeDate(match.finishedAt)}
              {match.solvedRound ? ` · solved round ${match.solvedRound}` : ""}
              {match.isCasual ? " · casual" : ""}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-bold",
                match.result ? RESULT_STYLES[match.result] : "text-muted",
              )}
            >
              {match.result ?? "—"}
            </p>
            <p
              className={cn(
                "text-[11px] font-semibold",
                match.pointsDelta > 0
                  ? "text-success"
                  : match.pointsDelta < 0
                    ? "text-danger"
                    : "text-muted",
              )}
            >
              {match.pointsDelta > 0 ? `+${match.pointsDelta}` : match.pointsDelta || "0"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HeadToHeadList({ rows }: { rows: HeadToHead[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No rivals yet.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--glass-border)]" data-testid="head-to-head">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3 py-2.5">
          <Avatar config={opponentAvatar(row)} className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {row.displayName}
              {row.isBot ? (
                <Bot className="ml-1.5 inline size-3.5 text-muted" aria-label="Bot" />
              ) : null}
            </p>
            <p className="text-[11px] text-muted">{row.played} played</p>
          </div>
          <p className="text-sm font-semibold">
            <span className="text-success">{row.wins}</span>
            <span className="text-muted"> · </span>
            <span className="text-danger">{row.losses}</span>
            {row.draws ? <span className="text-muted"> · {row.draws}D</span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function RecordLine({ record, label }: { record: Record; label: string }) {
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-foreground">{label}</span> {record.wins}W ·{" "}
      {record.losses}L{record.draws ? ` · ${record.draws}D` : ""}
    </p>
  );
}

export function ProfileHeader({
  name,
  username,
  avatar,
  league,
  points,
  isPublic,
}: {
  name: string;
  username: string;
  avatar: AvatarConfig;
  league: LeagueName;
  points: number;
  isPublic: boolean;
}) {
  return (
    <header className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
      <Avatar config={avatar} animated className="size-20 shadow-lg sm:size-24" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight" data-testid="profile-name">
          {name}
        </h1>
        <p className="text-sm text-muted" data-testid="profile-username">
          @{username}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LeagueBadge league={league} points={points} />
          {isPublic ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <UserRound className="size-3" /> Public profile
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Swords className="size-3" /> Your arena profile
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
