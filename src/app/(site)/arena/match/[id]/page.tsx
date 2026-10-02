import type { Metadata } from "next";
import { ArrowLeft, Crown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/avatar/avatar";
import { LeagueBadge } from "@/components/profile/league-badge";
import { GlassCard } from "@/components/ui/glass-card";
import { getMatchReplay } from "@/lib/arena/replay";
import type { LetterFeedback } from "@/lib/words/feedback";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Match replay",
  description: "Row-by-row replay of a Wordle Arena duel.",
  robots: { index: false },
};

const CELL: Record<LetterFeedback, string> = {
  correct: "tile-correct",
  present: "tile-present",
  absent: "tile-absent",
};

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

export default async function MatchReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getMatchReplay(id);

  if (!match || match.status !== "FINISHED") notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-10">
      <Link
        href="/arena"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to arena
      </Link>

      <header className="mt-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Match replay</h1>
        <p className="mt-1 text-sm text-muted">
          {formatDateTime(match.finishedAt)} ·{" "}
          <span className="font-mono font-semibold tracking-widest uppercase">{match.word}</span>
          {match.isCasual ? " · casual" : " · ranked"}
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {match.players.map((player) => {
          const isWinner = match.winnerPlayerId === player.id;

          return (
            <GlassCard
              key={player.id}
              className={cn("p-4", isWinner && "ring-1 ring-[var(--ring)]")}
              data-testid={`replay-player-${player.slot}`}
            >
              <div className="flex items-center gap-3">
                <Avatar config={player.avatar} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {player.displayName}
                    {isWinner ? <Crown className="size-4 text-[#e6bb78]" /> : null}
                  </p>
                  <div className="flex items-center gap-2">
                    <LeagueBadge league={player.league} />
                    {player.result ? (
                      <span
                        className={cn(
                          "text-[11px] font-bold",
                          player.result === "WIN" ? "text-success" : "text-danger",
                        )}
                      >
                        {player.result}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1">
                {Array.from({ length: match.roundCount }).map((_, index) => {
                  const rowNumber = index + 1;
                  const row = player.rows.find((entry) => entry.round === rowNumber);

                  return (
                    <div key={rowNumber} className="flex items-center gap-1">
                      <span className="w-4 text-[10px] text-muted">{rowNumber}</span>
                      {Array.from({ length: match.word.length }).map((__, column) => {
                        const letter = row?.guess[column] ?? "";
                        const feedback = row?.feedback[column];

                        return (
                          <span
                            key={column}
                            className={cn(
                              "grid size-7 place-items-center rounded-md text-xs font-bold uppercase",
                              feedback ? CELL[feedback] : "glass-tile opacity-60",
                            )}
                          >
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {!match.isCasual && player.pointsDelta !== 0 ? (
                <p
                  className={cn(
                    "mt-2 text-xs font-semibold",
                    player.pointsDelta > 0 ? "text-success" : "text-danger",
                  )}
                >
                  {player.pointsDelta > 0 ? `+${player.pointsDelta}` : player.pointsDelta} rank
                  points
                </p>
              ) : null}
            </GlassCard>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        {match.isDraw
          ? "The match was drawn."
          : match.endReason === "closest"
            ? "Decided on the closest guess."
            : match.endReason === "forfeit"
              ? "Won by forfeit."
              : "Won by solving the word."}
      </p>
    </div>
  );
}
