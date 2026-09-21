"use client";

import { Gamepad2, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center">
      <div className="glass w-full rounded-3xl p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger/15 text-danger">
          <Gamepad2 className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          An unexpected error interrupted the game. Your progress is safe — try again.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-muted">Reference: {error.digest}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
          <Link
            href="/"
            className="glass inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
          >
            Back to games
          </Link>
        </div>
      </div>
    </div>
  );
}
