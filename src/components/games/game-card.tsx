import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { getGameAccent } from "@/components/games/game-accent";
import type { PublicGame } from "@/lib/games/public";
import { cn } from "@/lib/utils";

export function GameCard({ game, index = 0 }: { game: PublicGame; index?: number }) {
  const accent = getGameAccent(game.slug);
  const Icon = accent.icon;

  return (
    <Link
      href={`/games/${game.slug}`}
      data-testid={`game-card-${game.slug}`}
      style={{ "--i": index } as CSSProperties}
      className={cn(
        "glass glass-card glass-interactive rise-in group relative flex flex-col overflow-hidden rounded-3xl p-5",
        accent.ring,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          accent.gradient,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/15 text-foreground backdrop-blur">
          <Icon className="size-5.5" />
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
          {game.category}
        </span>
      </div>

      <h3 className="relative mt-4 text-lg font-bold tracking-tight">{game.name}</h3>
      <p className="relative mt-1 flex-1 text-sm text-muted">
        {game.tagline ?? game.description ?? "A daily word challenge."}
      </p>

      <div className="relative mt-4 flex items-center justify-between text-xs text-muted">
        <span>{game.playCount.toLocaleString()} plays</span>
        <span className="inline-flex items-center gap-1 font-semibold text-primary">
          Play now
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
