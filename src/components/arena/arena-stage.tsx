"use client";

import { Bot, Loader2, Swords, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/avatar/avatar";
import { LeagueBadge } from "@/components/profile/league-badge";
import type { LeagueName } from "@/lib/arena/config";
import { ARENA_RULES, type ArenaState } from "@/lib/arena/view";
import type { AvatarConfig } from "@/lib/avatar/config";
import { cn } from "@/lib/utils";

import { DuelBoard } from "./duel-board";

export interface ArenaMe {
  displayName: string;
  avatar: AvatarConfig;
  league: LeagueName;
  rankPoints: number;
  signedIn: boolean;
}

type Screen = "lobby" | "queue" | "match";

export function ArenaStage({
  me,
  initialOnline,
  initialMatch = null,
}: {
  me: ArenaMe;
  initialOnline: { total: number; inMatch: number };
  initialMatch?: ArenaState | null;
}) {
  const [screen, setScreen] = useState<Screen>(initialMatch ? "match" : "lobby");
  const [matchId, setMatchId] = useState<string | null>(initialMatch?.matchId ?? null);
  const [state, setState] = useState<ArenaState | null>(initialMatch);
  const [online, setOnline] = useState(initialOnline);
  const [waitingMs, setWaitingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  const openMatch = useCallback(async (id: string) => {
    const response = await fetch(`/api/arena/match/${id}`, { cache: "no-store" });
    if (!response.ok) {
      setError("That match is no longer available.");
      setScreen("lobby");
      return;
    }
    setState((await response.json()) as ArenaState);
    setMatchId(id);
    setScreen("match");
  }, []);

  async function requestMatch(withBot: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/arena/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(withBot ? { bot: true } : {}),
      });
      const payload = (await response.json()) as { matchId?: string; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not start matchmaking.");
        return;
      }
      if (payload.matchId) {
        await openMatch(payload.matchId);
        return;
      }
      setWaitingMs(0);
      setScreen("queue");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelQueue() {
    await fetch("/api/arena/queue", { method: "DELETE" }).catch(() => {});
    setScreen("lobby");
  }

  async function exitMatch() {
    if (matchId) {
      await fetch(`/api/arena/match/${matchId}/leave`, { method: "POST" }).catch(() => {});
    }
    setMatchId(null);
    setState(null);
    setScreen("lobby");
  }

  async function rematch() {
    const wasBot = state?.opponent.isBot ?? false;
    setMatchId(null);
    setState(null);
    setScreen("lobby");
    await requestMatch(wasBot);
  }

  // Queue polling: pairs as soon as an opponent appears.
  useEffect(() => {
    if (screen !== "queue") return;
    cancelled.current = false;

    async function poll() {
      try {
        const response = await fetch("/api/arena/queue", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          status: string;
          matchId?: string;
          waitingMs?: number;
          online?: { total: number; inMatch: number };
        };

        if (payload.online) setOnline(payload.online);
        if (payload.waitingMs !== undefined) setWaitingMs(payload.waitingMs);

        if (payload.status === "matched" && payload.matchId && !cancelled.current) {
          await openMatch(payload.matchId);
        } else if (payload.status === "idle" && !cancelled.current) {
          setScreen("lobby");
        }
      } catch {
        // Retry on the next tick.
      }
    }

    void poll();
    const interval = window.setInterval(poll, 1200);
    return () => {
      cancelled.current = true;
      window.clearInterval(interval);
    };
  }, [openMatch, screen]);

  // Presence heartbeat + live online counter while browsing.
  useEffect(() => {
    if (screen === "match") return;

    const ping = async () => {
      try {
        const response = await fetch("/api/presence", { method: "POST" });
        if (response.ok) setOnline(await response.json());
      } catch {
        // Ignore.
      }
    };

    void ping();
    const interval = window.setInterval(ping, 25_000);
    return () => window.clearInterval(interval);
  }, [screen]);

  if (screen === "match" && state) {
    return <DuelBoard initial={state} onExit={exitMatch} onRematch={rematch} />;
  }

  return (
    <div className="space-y-5">
      <header className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <Avatar config={me.avatar} animated className="size-12" />
          <div>
            <p className="font-semibold">{me.displayName}</p>
            <LeagueBadge league={me.league} points={me.signedIn ? me.rankPoints : undefined} />
          </div>
        </div>

        <p className="inline-flex items-center gap-2 text-sm text-muted" data-testid="arena-online">
          <Users className="size-4 text-primary" />
          <span data-testid="arena-online-total">{online.total}</span> online ·{" "}
          <span data-testid="arena-online-matches">{online.inMatch}</span> in matches
        </p>
      </header>

      {screen === "queue" ? (
        <div className="glass rounded-3xl p-8 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-3 font-semibold" data-testid="arena-queue-status">
            Searching for an opponent…
          </p>
          <p className="mt-1 text-sm text-muted">
            {waitingMs > 12_000
              ? "Nobody around yet. Byte the bot is ready whenever you are."
              : "Matching you with another player."}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              data-testid="arena-queue-bot"
              onClick={() => void requestMatch(true)}
              disabled={busy}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <Bot className="size-4" />
              Play vs bot instead
            </button>
            <button
              type="button"
              data-testid="arena-queue-cancel"
              onClick={() => void cancelQueue()}
              className="glass glass-interactive inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <X className="size-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="glass rounded-3xl p-6 text-center">
            <span className="brand-badge mx-auto grid size-14 place-items-center rounded-2xl">
              <Swords className="size-7 text-primary" />
            </span>
            <h2 className="mt-3 text-xl font-bold tracking-tight">Find a duel</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Same word, same clock. Solve it before your opponent does.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                data-testid="arena-find"
                onClick={() => void requestMatch(false)}
                disabled={busy}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold"
              >
                <Swords className="size-4" />
                Find match
              </button>
              <button
                type="button"
                data-testid="arena-bot"
                onClick={() => void requestMatch(true)}
                disabled={busy}
                className="glass glass-interactive inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold"
              >
                <Bot className="size-4" />
                Play vs bot
              </button>
            </div>

            {!me.signedIn ? (
              <p className="mt-3 text-xs text-muted">
                You can duel as a guest. Sign in to earn rank points and climb the leagues.
              </p>
            ) : null}
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {ARENA_RULES.map((rule) => (
              <li key={rule} className={cn("glass rounded-2xl px-4 py-3 text-sm text-muted")}>
                {rule}
              </li>
            ))}
          </ul>
        </>
      )}

      {error ? (
        <p
          role="alert"
          data-testid="arena-lobby-error"
          className="text-center text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
