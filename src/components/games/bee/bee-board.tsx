"use client";

import { Loader2, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { BeeView } from "@/lib/games/bee";
import { cn } from "@/lib/utils";

export function BeeBoard({ initialView }: { initialView: BeeView | null }) {
  const [view, setView] = useState<BeeView | null>(initialView);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sortedFound = useMemo(
    () => [...(view?.found ?? [])].sort((a, b) => b.length - a.length || a.localeCompare(b)),
    [view?.found],
  );

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/games/spelling-bee/start", { method: "POST" });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "Could not start.");
      setView(data as BeeView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!view || busy) return;

    const word = input.trim().toLowerCase();
    if (!word) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/games/spelling-bee/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultId: view.resultId, word }),
      });
      const data = (await response.json()) as BeeView & {
        acceptedWord?: string;
        acceptedScore?: number;
        isPangram?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "That word is not accepted.");
        return;
      }

      setView(data);
      setInput("");
      setNotice(
        data.isPangram
          ? `Pangram! +${data.acceptedScore} points`
          : `+${data.acceptedScore} point${data.acceptedScore === 1 ? "" : "s"}`,
      );
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function appendLetter(letter: string) {
    if (input.length >= 15) return;
    setInput((previous) => previous + letter.toLowerCase());
  }

  if (!view) {
    return (
      <div
        className="glass mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-3xl p-6 text-center"
        data-testid="bee-start-panel"
      >
        <p className="font-semibold">Today&apos;s Spelling Bee</p>
        <p className="text-sm text-muted">
          Build as many words as you can from seven letters. Every word must use the centre letter.
        </p>
        {error ? (
          <p role="alert" data-testid="bee-error" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          data-testid="bee-start"
          disabled={busy}
          onClick={() => void start()}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Play today&apos;s puzzle
        </button>
      </div>
    );
  }

  const rows: string[][] = [view.outer.slice(0, 2), view.outer.slice(2, 5), view.outer.slice(5)];

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-4 text-sm">
        <span data-testid="bee-score" className="glass rounded-xl px-3 py-1.5 font-semibold">
          {view.score} / {view.maxScore} points
        </span>
        <span data-testid="bee-progress" className="glass rounded-xl px-3 py-1.5 font-semibold">
          {view.found.length} / {view.totalWords} words
        </span>
      </div>

      <div className="glass mx-auto w-fit rounded-3xl p-4 sm:p-5">
        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
              {row.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  data-testid={`bee-letter-${letter}`}
                  onClick={() => appendLetter(letter)}
                  className="glass-tile size-12 rounded-xl text-lg font-bold uppercase sm:size-14"
                >
                  {letter}
                </button>
              ))}
              {rowIndex === 1 ? (
                <button
                  type="button"
                  data-testid="bee-centre"
                  onClick={() => appendLetter(view.centre)}
                  className="tile-present grid size-12 place-items-center rounded-xl text-lg font-extrabold transition hover:brightness-105 sm:size-14"
                >
                  {view.centre.toUpperCase()}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="flex w-full max-w-sm items-center gap-2">
        <input
          data-testid="bee-input"
          value={input}
          onChange={(event) => setInput(event.target.value.replace(/[^a-zA-Z]/g, ""))}
          placeholder="Type a word"
          autoComplete="off"
          aria-label="Your word"
          className="glass w-full rounded-xl px-3.5 py-2.5 text-center text-sm font-semibold tracking-widest uppercase outline-none focus:ring-2 focus:ring-[var(--ring)]"
          maxLength={15}
        />
        <button
          type="submit"
          data-testid="bee-submit"
          disabled={busy || input.trim().length === 0}
          className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </button>
      </form>

      <div className="min-h-6 text-center text-sm" aria-live="polite" role="status">
        {error ? (
          <p role="alert" data-testid="bee-error" className="font-medium text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p data-testid="bee-notice" className="font-medium text-success">
            {notice}
          </p>
        ) : null}
      </div>

      {view.completed ? (
        <p
          className="glass rounded-xl px-4 py-2 text-sm font-semibold text-success"
          data-testid="bee-complete"
        >
          You found every word. Outstanding!
        </p>
      ) : null}

      <div className="w-full max-w-lg">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Found words ({view.found.length})
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sortedFound.map((word) => {
            const pangram = view.pangramsFound.includes(word);
            return (
              <span
                key={word}
                data-testid={`bee-found-${word}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-xs font-semibold uppercase",
                  pangram ? "bg-amber-400/20 text-amber-500" : "bg-white/10 text-foreground",
                )}
              >
                {pangram ? <Sparkles className="size-3" /> : null}
                {word}
              </span>
            );
          })}
          {view.found.length === 0 ? (
            <p className="text-xs text-muted">No words yet — the centre letter is required.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
