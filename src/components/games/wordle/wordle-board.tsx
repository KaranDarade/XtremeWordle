"use client";

import { Delete, Share2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { WordleMode, WordleView } from "@/lib/games/wordle-view";
import { cn } from "@/lib/utils";
import { keyboardState, shareText, type LetterFeedback } from "@/lib/words/feedback";

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"] as const;

const CELL_ACTIVE: Record<LetterFeedback, string> = {
  correct: "tile-correct",
  present: "tile-present",
  absent: "tile-absent",
};

export function WordleBoard({
  initialView,
  isGuest,
}: {
  initialView: WordleView | null;
  isGuest: boolean;
}) {
  const [mode, setMode] = useState<WordleMode>(initialView?.mode ?? "DAILY");
  const [view, setView] = useState<WordleView | null>(initialView);
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const wordLength = view?.wordLength ?? 5;
  const submitRef = useRef<() => void>(() => {});

  async function requestStart(nextMode: WordleMode) {
    setBusy(true);
    setError(null);
    setNotice(null);
    setCurrent("");
    try {
      const response = await fetch("/api/games/wordle/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? "Could not start the game.");
      }
      setView(data as WordleView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function submitGuess() {
    if (!view || busy || view.completed) return;
    if (current.length !== wordLength) {
      setError(`Enter a ${wordLength}-letter word.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/games/wordle/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultId: view.resultId, guess: current }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        setError((data as { error?: string }).error ?? "Could not submit that guess.");
        return;
      }
      setView(data as WordleView);
      setCurrent("");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Keep the keydown handler pointing at the latest submit logic without
  // re-registering the listener on every keystroke.
  useEffect(() => {
    submitRef.current = () => {
      void submitGuess();
    };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Enter") {
        event.preventDefault();
        submitRef.current();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setCurrent((previous) => previous.slice(0, -1));
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        setCurrent((previous) =>
          previous.length < wordLength ? previous + event.key.toLowerCase() : previous,
        );
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wordLength]);

  const keyboard = view ? keyboardState(view.board) : {};
  const attemptsUsed = view?.board.length ?? 0;

  if (!view) {
    return (
      <div
        className="glass mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-3xl p-6 text-center"
        data-testid="wordle-start-panel"
      >
        <p className="font-semibold">Ready to play?</p>
        <p className="text-sm text-muted">
          Guess the hidden word in six tries. A new daily puzzle appears at midnight IST.
        </p>
        {error ? (
          <p role="alert" data-testid="wordle-error" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            data-testid="wordle-start-daily"
            disabled={busy}
            onClick={() => {
              setMode("DAILY");
              void requestStart("DAILY");
            }}
            className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Play daily
          </button>
          <button
            type="button"
            data-testid="wordle-start-unlimited"
            disabled={busy}
            onClick={() => {
              setMode("UNLIMITED");
              void requestStart("UNLIMITED");
            }}
            className="glass rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            Play unlimited
          </button>
        </div>
      </div>
    );
  }

  async function share() {
    if (!view) return;
    const text = shareText(view.title, view.board, view.maxAttempts);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Result copied to clipboard!");
    } catch {
      setNotice(text);
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="glass inline-flex rounded-2xl p-1">
        {(["DAILY", "UNLIMITED"] as WordleMode[]).map((value) => (
          <button
            key={value}
            type="button"
            data-testid={`wordle-mode-${value.toLowerCase()}`}
            onClick={() => {
              if (value === mode) return;
              setMode(value);
              void requestStart(value);
            }}
            disabled={busy}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              value === mode
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted hover:text-foreground",
            )}
          >
            {value === "DAILY" ? "Daily" : "Unlimited"}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted" data-testid="wordle-attempts">
        {view.mode === "DAILY"
          ? `Daily puzzle · ${view.bucketKey} (IST)`
          : `Unlimited · pool refreshes every 12 hours (${view.bucketKey})`}{" "}
        · {attemptsUsed}/{view.maxAttempts} attempts
      </p>

      <div className="glass mx-auto w-fit rounded-3xl p-3 sm:p-4">
        <div
          className="grid gap-1.5 sm:gap-2"
          style={{ gridTemplateRows: `repeat(${view.maxAttempts}, minmax(0, 1fr))` }}
          data-testid="wordle-grid"
          role="grid"
          aria-label="Wordle board"
          aria-rowcount={view.maxAttempts}
          aria-colcount={wordLength}
        >
          {Array.from({ length: view.maxAttempts }).map((_, rowIndex) => {
            const revealed = rowIndex < view.board.length ? view.board[rowIndex] : null;
            const isCurrentRow = !revealed && rowIndex === view.board.length && !view.completed;

            return (
              <div
                key={rowIndex}
                role="row"
                className="grid gap-1.5 sm:gap-2"
                style={{ gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))` }}
                data-testid={
                  revealed
                    ? `wordle-row-${rowIndex}`
                    : isCurrentRow
                      ? "wordle-current-row"
                      : undefined
                }
              >
                {Array.from({ length: wordLength }).map((__, colIndex) => {
                  const letter = revealed
                    ? revealed.word[colIndex]
                    : isCurrentRow
                      ? (current[colIndex] ?? "")
                      : "";
                  const feedback = revealed?.feedback[colIndex];
                  const cellLabel = feedback
                    ? `${letter.toUpperCase()}, ${feedback}`
                    : letter
                      ? letter.toUpperCase()
                      : "empty";

                  return (
                    <div
                      key={colIndex}
                      role="gridcell"
                      aria-label={cellLabel}
                      className={cn(
                        "flex size-12 items-center justify-center rounded-xl text-lg font-bold uppercase sm:size-14 sm:text-xl",
                        feedback
                          ? CELL_ACTIVE[feedback]
                          : cn("glass-tile text-foreground", letter && "tile-pop"),
                      )}
                      style={feedback ? { animationDelay: `${colIndex * 70}ms` } : undefined}
                      data-feedback={feedback ?? ""}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-6 text-center text-sm" aria-live="polite" role="status">
        {error ? (
          <p role="alert" data-testid="wordle-error" className="font-medium text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p data-testid="wordle-notice" className="font-medium whitespace-pre-line text-success">
            {notice}
          </p>
        ) : null}
      </div>

      {view.completed ? (
        <div
          className="glass w-full max-w-md rounded-2xl p-4 text-center"
          data-testid="wordle-complete"
        >
          <p className="font-semibold">
            {view.solved
              ? `Solved in ${attemptsUsed}/${view.maxAttempts}!`
              : "Better luck next time."}
          </p>
          <p className="mt-1 text-sm text-muted">
            The word was{" "}
            <span
              data-testid="wordle-answer"
              className="font-mono font-bold tracking-widest uppercase"
            >
              {view.answer}
            </span>
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              data-testid="wordle-share"
              onClick={() => void share()}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              <Share2 className="size-4" />
              Share result
            </button>
            <button
              type="button"
              data-testid="wordle-new"
              onClick={() => void requestStart(mode)}
              disabled={busy}
              className="glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            >
              <RotateCcw className="size-4" />
              {view.mode === "DAILY" ? "Try unlimited" : "New word"}
            </button>
          </div>
        </div>
      ) : null}

      {isGuest ? (
        <p className="text-center text-xs text-muted" data-testid="wordle-signin">
          Playing as a guest — your progress is saved in this browser.{" "}
          <Link
            href="/signup?next=/games/wordle"
            className="font-semibold text-primary hover:underline"
          >
            Create an account
          </Link>{" "}
          to keep streaks across devices.
        </p>
      ) : null}

      <div className="w-full max-w-lg space-y-1.5" aria-label="On-screen keyboard">
        {KEY_ROWS.map((row, rowIndex) => (
          <div key={row} className="flex justify-center gap-1.5">
            {rowIndex === 2 ? (
              <button
                type="button"
                data-testid="wordle-key-enter"
                onClick={() => void submitGuess()}
                disabled={busy || view.completed}
                className="glass rounded-lg px-3 py-3 text-xs font-bold transition hover:opacity-90 disabled:opacity-50"
              >
                Enter
              </button>
            ) : null}

            {row.split("").map((letter) => {
              const state = keyboard[letter];
              return (
                <button
                  key={letter}
                  type="button"
                  data-testid={`wordle-key-${letter}`}
                  onClick={() =>
                    setCurrent((previous) =>
                      previous.length < wordLength ? previous + letter : previous,
                    )
                  }
                  disabled={busy || view.completed}
                  className={cn(
                    "size-8 rounded-lg text-sm font-bold uppercase transition disabled:opacity-50 sm:size-10",
                    state ? CELL_ACTIVE[state] : "glass-tile text-foreground",
                  )}
                >
                  {letter}
                </button>
              );
            })}

            {rowIndex === 2 ? (
              <button
                type="button"
                data-testid="wordle-key-backspace"
                onClick={() => setCurrent((previous) => previous.slice(0, -1))}
                disabled={busy || view.completed}
                className="glass inline-flex items-center justify-center rounded-lg px-3 py-3 transition hover:opacity-90 disabled:opacity-50"
                aria-label="Backspace"
              >
                <Delete className="size-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
