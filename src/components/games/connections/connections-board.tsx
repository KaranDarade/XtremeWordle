"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

import type { ConnectionsView } from "@/lib/games/connections";
import { cn } from "@/lib/utils";

const GROUP_STYLES = [
  "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "border-lime-600/40 bg-lime-600/15 text-lime-800 dark:text-lime-300",
  "border-orange-500/40 bg-orange-500/15 text-orange-800 dark:text-orange-300",
  "border-red-700/40 bg-red-700/15 text-red-800 dark:text-red-400",
];

export function ConnectionsBoard({ initialView }: { initialView: ConnectionsView | null }) {
  const [view, setView] = useState<ConnectionsView | null>(initialView);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/games/connections/start", { method: "POST" });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "Could not start.");
      setView(data as ConnectionsView);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(word: string) {
    setSelected((previous) =>
      previous.includes(word)
        ? previous.filter((item) => item !== word)
        : previous.length < 4
          ? [...previous, word]
          : previous,
    );
  }

  async function submit() {
    if (!view || busy || selected.length !== 4) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/games/connections/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultId: view.resultId, words: selected }),
      });
      const data = (await response.json()) as ConnectionsView & {
        correct?: boolean;
        matchedCategory?: string | null;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Those four words do not form a group.");
        return;
      }

      setView(data);
      setSelected([]);
      setNotice(
        data.correct ? `Correct: ${data.matchedCategory}` : "Not quite — one mistake used.",
      );
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return (
      <div
        className="glass mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-3xl p-6 text-center"
        data-testid="conn-start-panel"
      >
        <p className="font-semibold">Today&apos;s Connections</p>
        <p className="text-sm text-muted">
          Sixteen words, four hidden groups. Find the shared thread before you run out of mistakes.
        </p>
        {error ? (
          <p role="alert" data-testid="conn-error" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          data-testid="conn-start"
          disabled={busy}
          onClick={() => void start()}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Play today&apos;s puzzle
        </button>
      </div>
    );
  }

  const solvedWords = new Set(view.solvedGroups.flatMap((group) => group.words));
  const remaining = view.words.filter((word) => !solvedWords.has(word));
  const attemptsLeft = Math.max(0, view.maxMistakes - view.mistakes);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <span data-testid="conn-mistakes" className="glass rounded-xl px-3 py-1.5 font-semibold">
          Mistakes: {view.mistakes} / {view.maxMistakes}
        </span>
        <span data-testid="conn-solved" className="glass rounded-xl px-3 py-1.5 font-semibold">
          Groups solved: {view.solvedGroups.length} / 4
        </span>
      </div>

      <div className="flex w-full max-w-xl flex-col gap-2">
        {view.revealedGroups?.map((group, index) => (
          <div
            key={group.category}
            data-testid={`conn-category-${index}`}
            className={cn(
              "rounded-xl border px-3 py-2 text-center",
              GROUP_STYLES[group.difficulty] ?? GROUP_STYLES[0],
            )}
          >
            <p className="text-xs font-bold tracking-wide uppercase">{group.category}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold uppercase">
              {group.words.join(" · ")}
            </p>
          </div>
        ))}
      </div>

      <div className="glass w-full max-w-xl rounded-3xl p-3 sm:p-4">
        <div className="grid grid-cols-4 gap-2" data-testid="conn-grid">
          {remaining.map((word) => {
            const isSelected = selected.includes(word);
            return (
              <button
                key={word}
                type="button"
                data-testid={`conn-tile-${word}`}
                data-selected={isSelected ? "true" : "false"}
                onClick={() => toggle(word)}
                disabled={busy || view.completed}
                className={cn(
                  "flex h-16 items-center justify-center rounded-xl px-1 text-center font-mono text-xs font-bold uppercase transition sm:text-sm",
                  isSelected
                    ? "border border-primary bg-primary text-primary-foreground shadow-lg"
                    : "glass-tile",
                  (busy || view.completed) && "opacity-60",
                )}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        data-testid="conn-submit"
        onClick={() => void submit()}
        disabled={busy || selected.length !== 4 || view.completed}
        className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Checking…" : `Submit${selected.length ? ` (${selected.length}/4)` : ""}`}
      </button>

      <div className="min-h-6 text-center text-sm" aria-live="polite" role="status">
        {error ? (
          <p role="alert" data-testid="conn-error" className="font-medium text-danger">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p data-testid="conn-notice" className="font-medium text-muted">
            {notice}
          </p>
        ) : null}
      </div>

      {view.completed ? (
        <div className="glass rounded-2xl p-4 text-center" data-testid="conn-complete">
          <p className="flex items-center justify-center gap-2 font-semibold">
            {view.solved ? (
              <>
                <Check className="size-4 text-success" /> Solved with {attemptsLeft} mistakes to
                spare!
              </>
            ) : (
              <>
                <X className="size-4 text-danger" /> Out of mistakes — the groups are revealed
                above.
              </>
            )}
          </p>
        </div>
      ) : null}

      {view.attempts.length > 0 && !view.completed ? (
        <p className="text-xs text-muted" data-testid="conn-history">
          Last guess: {view.attempts[view.attempts.length - 1].words.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
