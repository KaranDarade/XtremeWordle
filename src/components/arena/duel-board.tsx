"use client";

import { Crown, History, LogOut, RotateCcw, Send, Smile, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/avatar/avatar";
import { LeagueBadge } from "@/components/profile/league-badge";
import type { ArenaState } from "@/lib/arena/view";
import { ARENA_REACTIONS } from "@/lib/arena/view";
import type { LetterFeedback } from "@/lib/words/feedback";
import { cn } from "@/lib/utils";

import { useArenaSound } from "./use-arena-sound";

const WORD_LENGTH = 5;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;

const CELL: Record<LetterFeedback, string> = {
  correct: "tile-correct",
  present: "tile-present",
  absent: "tile-absent",
};

function secondsLabel(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}`;
}

function MiniBoard({
  rows,
  guessedRounds,
  roundCount,
  round,
  label,
  highlight,
  testId,
}: {
  rows: ArenaState["board"];
  guessedRounds: number[];
  roundCount: number;
  round: number;
  label: string;
  highlight?: boolean;
  testId?: string;
}) {
  const byRound = new Map(rows.map((row) => [row.round, row]));

  return (
    <div
      className={cn("glass rounded-2xl p-3", highlight && "ring-1 ring-[var(--ring)]")}
      data-testid={testId}
    >
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <div className="grid gap-1">
        {Array.from({ length: roundCount }).map((_, index) => {
          const rowNumber = index + 1;
          const row = byRound.get(rowNumber);
          const pending = !row && guessedRounds.includes(rowNumber);
          const isCurrent = rowNumber === round;

          return (
            <div key={rowNumber} className="flex gap-1">
              {Array.from({ length: WORD_LENGTH }).map((__, column) => {
                const letter = row?.guess[column] ?? "";
                const feedback = row?.feedback[column];

                return (
                  <span
                    key={column}
                    className={cn(
                      "grid size-7 place-items-center rounded-md text-xs font-bold uppercase",
                      feedback
                        ? CELL[feedback]
                        : pending
                          ? "glass-tile animate-pulse"
                          : isCurrent
                            ? "glass-tile border-primary/40"
                            : "glass-tile opacity-60",
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
    </div>
  );
}

export function DuelBoard({
  initial,
  onExit,
  onRematch,
}: {
  initial: ArenaState;
  onExit: () => void;
  onRematch: () => void;
}) {
  const [state, setState] = useState(initial);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const { soundEnabled, toggleSound, playRoundStart, playWin, playLoss } = useArenaSound();
  const reactionRef = useRef(0);

  const applyState = useCallback((next: ArenaState) => {
    setServerOffset(next.serverNow - Date.now());
    setState(next);
    if (next.status !== "PLAYING") setTyped("");
  }, []);

  // Smooth local countdown; the server timestamps are authoritative.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  // Poll match state, and stop once the match is over.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/arena/match/${state.matchId}`, { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as ArenaState;
        if (!cancelled) applyState(next);
      } catch {
        // Transient network hiccup; the next tick retries.
      }
    }

    if (state.status !== "PLAYING") return;

    const interval = window.setInterval(poll, state.phase === "play" ? 1400 : 900);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyState, state.matchId, state.phase, state.status]);

  // Heartbeat so the opponent does not see us as disconnected.
  useEffect(() => {
    if (state.status !== "PLAYING") return;

    const ping = () => {
      void fetch(`/api/arena/match/${state.matchId}/heartbeat`, { method: "POST" }).catch(() => {});
    };
    ping();
    const interval = window.setInterval(ping, 5000);
    return () => window.clearInterval(interval);
  }, [state.matchId, state.status]);

  // Sound cues: a tick when a round opens, a chime or thud when it ends.
  const lastPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (state.phase === "play" && lastPhaseRef.current !== "play") playRoundStart();
    lastPhaseRef.current = state.phase;
  }, [playRoundStart, state.phase]);

  const resultSoundRef = useRef(false);
  useEffect(() => {
    if (state.status === "PLAYING" || resultSoundRef.current) return;
    resultSoundRef.current = true;
    if (state.isDraw) return;
    if (state.winnerPlayerId === state.me.playerId) playWin();
    else playLoss();
  }, [playLoss, playWin, state.isDraw, state.me.playerId, state.status, state.winnerPlayerId]);

  const submit = useCallback(async () => {
    if (busy || !state.canGuess || typed.length !== WORD_LENGTH) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/arena/match/${state.matchId}/guess`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guess: typed }),
      });
      const payload = (await response.json()) as ArenaState & { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "That guess was rejected.");
        return;
      }

      applyState(payload);
      setTyped("");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }, [applyState, busy, state.canGuess, state.matchId, typed]);

  const react = useCallback(
    (emoji: string) => {
      if (Date.now() - reactionRef.current < 1500) return;
      reactionRef.current = Date.now();
      void fetch(`/api/arena/match/${state.matchId}/reaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji }),
      }).catch(() => {});
    },
    [state.matchId],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (state.status !== "PLAYING" || !state.canGuess || busy) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        event.preventDefault();
        void submit();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setTyped((previous) => previous.slice(0, -1));
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        setTyped((previous) =>
          previous.length < WORD_LENGTH ? previous + event.key.toLowerCase() : previous,
        );
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, state.canGuess, state.status, submit]);

  const msLeft = Math.max(0, state.playEndsAt - (now + serverOffset));
  const breakLeft = Math.max(0, state.roundEndsAt - (now + serverOffset));
  const inPlay = state.phase === "play";
  const finished = state.status !== "PLAYING";

  const myRows = state.board.filter((row) => row.mine);
  const opponentRows = state.board.filter((row) => !row.mine);
  const won = finished && !state.isDraw && state.winnerPlayerId === state.me.playerId;

  return (
    <div className="space-y-4">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar config={state.me.avatar} className="size-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{state.me.displayName}</p>
            <LeagueBadge league={state.me.league} />
          </div>
        </div>

        <div className="text-center">
          <p
            className="text-[11px] font-semibold tracking-wide text-muted uppercase"
            data-testid="arena-phase"
          >
            {state.phase === "countdown"
              ? "Get ready"
              : inPlay
                ? `Round ${state.round} of ${state.roundCount}`
                : state.phase === "reveal"
                  ? "Reveal"
                  : "Finished"}
          </p>
          <p className="text-2xl font-bold tabular-nums" data-testid="arena-timer">
            {state.phase === "countdown" || inPlay ? secondsLabel(msLeft) : secondsLabel(breakLeft)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold" data-testid="arena-opponent-name">
              {state.opponent.displayName}
              {state.opponent.isBot ? (
                <span className="ml-1 text-[10px] text-muted">BOT</span>
              ) : null}
            </p>
            <LeagueBadge league={state.opponent.league} />
          </div>
          <Avatar config={state.opponent.avatar} className="size-9" />
          <button
            type="button"
            data-testid="arena-sound-toggle"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Mute sound effects" : "Enable sound effects"}
            className="glass-tile grid size-8 place-items-center rounded-lg"
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>
      </header>

      {/* Round progress */}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-100",
            inPlay ? "bg-primary" : "bg-[var(--accent)]",
          )}
          style={{
            width: `${Math.round(
              (inPlay ? 1 - msLeft / state.roundMs : 1 - breakLeft / state.breakMs) * 100,
            )}%`,
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="glass rounded-3xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <p
              className="text-xs font-semibold tracking-wide text-muted uppercase"
              data-testid="arena-round"
            >
              Round {state.round} / {state.roundCount}
            </p>
            <p className="text-xs text-muted">
              {state.isCasual ? "Casual — no rank points" : "Ranked"}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="grid gap-1.5" data-testid="arena-grid">
              {Array.from({ length: state.roundCount }).map((_, index) => {
                const rowNumber = index + 1;
                const row = myRows.find((entry) => entry.round === rowNumber);
                const isCurrent = rowNumber === state.round && !row;
                const letters = isCurrent ? typed : (row?.guess ?? "");

                return (
                  <div key={rowNumber} className="flex gap-1.5">
                    {Array.from({ length: WORD_LENGTH }).map((__, column) => {
                      const letter = letters[column] ?? "";
                      const feedback = row?.feedback[column];

                      return (
                        <span
                          key={column}
                          className={cn(
                            "grid size-11 place-items-center rounded-lg text-base font-bold uppercase sm:size-12",
                            feedback ? CELL[feedback] : cn("glass-tile", letter && "tile-pop"),
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
          </div>

          <div className="mt-3 min-h-5 text-center text-sm">
            {error ? (
              <p role="alert" data-testid="arena-error" className="font-medium text-danger">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted">
                {state.canGuess
                  ? "Type your word and press Enter"
                  : finished
                    ? ""
                    : state.phase === "countdown"
                      ? "Get ready…"
                      : inPlay
                        ? "Guess locked — waiting for the reveal"
                        : "Next round starting…"}
              </p>
            )}
          </div>

          {/* Keyboard */}
          <div className="mt-3 space-y-1.5" aria-label="Arena keyboard">
            {KEY_ROWS.map((row, rowIndex) => (
              <div key={row} className="flex justify-center gap-1">
                {rowIndex === 2 ? (
                  <button
                    type="button"
                    data-testid="arena-submit"
                    onClick={() => void submit()}
                    disabled={busy || !state.canGuess || typed.length !== WORD_LENGTH}
                    className="btn-primary rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    <Send className="size-3.5" />
                  </button>
                ) : null}
                {row.split("").map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    data-testid={`arena-key-${letter}`}
                    onClick={() =>
                      setTyped((previous) =>
                        previous.length < WORD_LENGTH ? previous + letter : previous,
                      )
                    }
                    disabled={busy || !state.canGuess}
                    className="glass-tile size-7 rounded-md text-xs font-bold uppercase disabled:opacity-40 sm:size-8"
                  >
                    {letter}
                  </button>
                ))}
                {rowIndex === 2 ? (
                  <button
                    type="button"
                    onClick={() => setTyped((previous) => previous.slice(0, -1))}
                    disabled={busy || !state.canGuess}
                    className="glass rounded-lg px-2.5 py-2 text-xs font-bold disabled:opacity-40"
                    aria-label="Backspace"
                  >
                    ⌫
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <MiniBoard
            rows={opponentRows}
            guessedRounds={state.opponent.guessedRounds}
            roundCount={state.roundCount}
            round={state.round}
            label={`${state.opponent.displayName}${state.opponent.connected ? "" : " · away"}`}
            highlight={!inPlay}
            testId="arena-opponent-board"
          />

          <div className="glass rounded-2xl p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
              <Smile className="size-3.5" /> Reactions
            </p>
            <div className="flex gap-1.5">
              {ARENA_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  data-testid={`arena-reaction-${emoji}`}
                  onClick={() => react(emoji)}
                  disabled={finished}
                  className="glass-tile grid size-9 place-items-center rounded-lg text-lg disabled:opacity-40"
                >
                  {emoji}
                </button>
              ))}
            </div>
            {state.reactions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1" data-testid="arena-reaction-log">
                {state.reactions.map((reaction, index) => (
                  <span
                    key={`${reaction.at}-${index}`}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-sm",
                      reaction.from === "me" ? "bg-primary/15" : "bg-white/10",
                    )}
                  >
                    {reaction.emoji}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {finished ? (
        <div className="glass rounded-3xl p-6 text-center" data-testid="arena-result">
          <p
            className="flex items-center justify-center gap-2 text-xl font-bold"
            data-testid="arena-result-title"
          >
            {won ? <Crown className="size-5 text-[#e6bb78]" /> : null}
            {state.isDraw ? "Drawn match" : won ? "You win!" : `${state.opponent.displayName} wins`}
          </p>

          <p className="mt-1 text-sm text-muted">
            {state.word ? (
              <>
                The word was{" "}
                <span
                  className="font-mono font-bold tracking-widest uppercase"
                  data-testid="arena-word"
                >
                  {state.word}
                </span>
              </>
            ) : null}
            {state.endReason === "closest" ? " · decided on the closest guess" : ""}
            {state.endReason === "forfeit" ? " · won by forfeit" : ""}
          </p>

          {!state.isCasual ? (
            <p
              className={cn(
                "mt-2 text-sm font-semibold",
                state.me.pointsDelta > 0 ? "text-success" : "text-danger",
              )}
              data-testid="arena-points"
            >
              {state.me.pointsDelta > 0 ? `+${state.me.pointsDelta}` : state.me.pointsDelta} rank
              points
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">Casual match — no rank points changed.</p>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              data-testid="arena-rematch"
              onClick={onRematch}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <RotateCcw className="size-4" />
              Rematch
            </button>
            <Link
              href={`/arena/match/${state.matchId}`}
              data-testid="arena-replay"
              className="glass glass-interactive inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <History className="size-4" />
              View replay
            </Link>
            <button
              type="button"
              data-testid="arena-exit"
              onClick={onExit}
              className="glass glass-interactive inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <LogOut className="size-4" />
              Back to lobby
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-foreground"
          >
            <LogOut className="size-4" />
            Leave match (forfeit)
          </button>
        </div>
      )}
    </div>
  );
}
