import { ArrowRight, Swords } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The arena is not a row in the Game table (it is a mode, not a word list), so
 * it gets its own card alongside the database-driven ones.
 */
export function ArenaCard({ index = 0, className }: { index?: number; className?: string }) {
  return (
    <Link
      href="/arena"
      data-testid="game-card-arena"
      style={{ "--i": index } as React.CSSProperties}
      className={cn(
        "glass glass-card glass-interactive rise-in group relative flex flex-col overflow-hidden rounded-3xl p-5 ring-1 ring-[var(--ring)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/30 via-orange-800/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/15 text-foreground backdrop-blur">
          <Swords className="size-5.5" />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary uppercase">
          <span className="live-dot size-1.5 rounded-full bg-primary" />
          Live 1v1
        </span>
      </div>

      <h3 className="relative mt-4 text-lg font-bold tracking-tight">Wordle Arena</h3>
      <p className="relative mt-1 flex-1 text-sm text-muted">
        Same word, same clock. Solve it before your opponent does.
      </p>

      <div className="relative mt-4 flex items-center justify-between text-xs text-muted">
        <span>Ranked duels &amp; bots</span>
        <span className="inline-flex items-center gap-1 font-semibold text-primary">
          Duel now
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
