import { ArrowRight, Bot, Swords, Users } from "lucide-react";
import Link from "next/link";

import { BrainLogo } from "@/components/brand/brain-logo";
import { getOnlineCounts } from "@/lib/arena/presence";

/**
 * Full-width spotlight for the multiplayer arena, sitting above the games grid
 * so the flagship mode reads as the main event rather than one card among many.
 */
export async function ArenaBand() {
  const online = await getOnlineCounts();

  return (
    <section className="rise-in mt-10 sm:mt-14" data-testid="arena-band">
      <div className="glass glass-card relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/25 via-orange-700/15 to-transparent"
        />

        <div className="relative flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
          <div className="flex flex-col items-center gap-4 sm:flex-row lg:items-start">
            <span className="brand-badge grid size-16 shrink-0 place-items-center rounded-2xl">
              <BrainLogo className="size-10" />
            </span>

            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary uppercase">
                <span className="live-dot size-1.5 rounded-full bg-primary" />
                Live 1v1
              </span>

              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Wordle <span className="text-primary">Arena</span>
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                Same word, same clock. Six rounds, twelve seconds a row — solve it before your
                opponent does.
              </p>

              <p
                className="mt-3 inline-flex items-center gap-2 text-xs text-muted"
                data-testid="arena-band-online"
              >
                <Users className="size-3.5 text-primary" />
                <span data-testid="arena-band-online-total">{online.total}</span> online ·{" "}
                <span data-testid="arena-band-online-matches">{online.inMatch}</span> in matches
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href="/arena"
              data-testid="arena-band-play"
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold whitespace-nowrap"
            >
              <Swords className="size-4" />
              Play Arena
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/arena"
              className="glass glass-interactive inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold whitespace-nowrap"
            >
              <Bot className="size-4" />
              Play the bot
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
