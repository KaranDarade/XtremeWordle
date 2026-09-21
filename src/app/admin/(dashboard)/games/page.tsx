import type { Metadata } from "next";
import { Gamepad2 } from "lucide-react";

import { GameEditForm } from "@/components/admin/game-edit-form";
import { toggleGameActiveAction } from "@/lib/admin/actions";
import { listGames } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Games", robots: { index: false } };

export default async function AdminGamesPage() {
  const games = await listGames();

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Games</h1>
        <p className="text-sm text-muted">
          Toggle visibility on the site and edit how each game appears on the landing page.
        </p>
      </header>

      <div className="space-y-4">
        {games.map((game) => (
          <section
            key={game.id}
            className="glass rounded-2xl p-5"
            data-testid={`game-${game.slug}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Gamepad2 className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">
                    {game.name} <span className="font-mono text-xs text-muted">/{game.slug}</span>
                  </h2>
                  <p className="text-sm text-muted">{game.tagline ?? "No tagline"}</p>
                  <p className="mt-1 text-xs text-muted">
                    {game._count.wordEntries.toLocaleString()} words · {game._count.puzzles} puzzles
                    · {game._count.dailyPuzzles} scheduled · {game._count.gameResults} plays
                  </p>
                </div>
              </div>

              <form action={toggleGameActiveAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={game.id} />
                <button
                  type="submit"
                  data-testid={`toggle-game-${game.slug}`}
                  data-active={game.isActive ? "true" : "false"}
                  aria-pressed={game.isActive}
                  className={
                    game.isActive
                      ? "rounded-xl bg-success/15 px-3 py-2 text-xs font-semibold text-success"
                      : "glass rounded-xl px-3 py-2 text-xs font-semibold text-muted"
                  }
                >
                  <span className="sr-only">{game.name} is </span>
                  {game.isActive ? "Active — click to hide" : "Hidden — click to show"}
                </button>
              </form>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Edit details
              </summary>
              <div className="mt-3">
                <GameEditForm
                  game={{
                    id: game.id,
                    name: game.name,
                    tagline: game.tagline,
                    description: game.description,
                    sortOrder: game.sortOrder,
                  }}
                />
              </div>
            </details>
          </section>
        ))}
      </div>
    </>
  );
}
