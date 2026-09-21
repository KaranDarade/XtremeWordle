import type { Metadata } from "next";
import Link from "next/link";

import { ImportWordsForm } from "@/components/admin/import-words-form";
import { Pagination } from "@/components/admin/pagination";
import { SelectInput, TextInput } from "@/components/ui/form";
import { getWordPoolCounts, listGames, listWords } from "@/lib/admin/queries";
import { buildQuery } from "@/lib/admin/url";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Word lists", robots: { index: false } };

type Pool = "ALL" | "ANSWERS" | "VALIDATION";

export default async function AdminWordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const games = await listGames();

  if (games.length === 0) {
    return <p className="text-sm text-muted">No games exist yet. Run the seed script first.</p>;
  }

  const slugParam = typeof sp.game === "string" ? sp.game : games[0].slug;
  const game = games.find((candidate) => candidate.slug === slugParam) ?? games[0];
  const q = typeof sp.q === "string" ? sp.q : "";
  const pool: Pool = sp.pool === "ANSWERS" || sp.pool === "VALIDATION" ? (sp.pool as Pool) : "ALL";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : "1") || 1);

  const [data, counts] = await Promise.all([
    listWords({ gameId: game.id, q, pool, page }),
    getWordPoolCounts(game.id),
  ]);

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Word lists</h1>
        <p className="text-sm text-muted">
          Answer pools feed automatic rotation; validation lists accept player guesses.
        </p>
      </header>

      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <span className="px-1 text-xs font-semibold text-muted uppercase">Game</span>
        {games.map((candidate) => (
          <Link
            key={candidate.slug}
            href={`/admin/words?game=${candidate.slug}`}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-medium transition",
              candidate.slug === game.slug
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:bg-white/10 hover:text-foreground",
            )}
          >
            {candidate.name}
          </Link>
        ))}
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Import words</h2>
        <p className="mb-4 text-xs text-muted">
          Bulk-add words to the selected game. Existing duplicates are skipped.
        </p>
        <ImportWordsForm
          games={games.map((candidate) => ({ id: candidate.id, name: candidate.name }))}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted uppercase">Answer pool</p>
          <p className="text-2xl font-bold">{counts.answers.toLocaleString()}</p>
          <p className="text-xs text-muted">Words that can be chosen as puzzles</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted uppercase">Validation list</p>
          <p className="text-2xl font-bold">{counts.validation.toLocaleString()}</p>
          <p className="text-xs text-muted">Words accepted as guesses</p>
        </div>
      </section>

      <form
        method="get"
        action="/admin/words"
        className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4"
      >
        <input type="hidden" name="game" value={game.slug} />
        <div className="min-w-48 flex-1">
          <label htmlFor="word-q" className="mb-1 block text-xs font-semibold text-muted uppercase">
            Search
          </label>
          <TextInput id="word-q" name="q" defaultValue={q} placeholder="e.g. crane" />
        </div>
        <div>
          <label htmlFor="pool" className="mb-1 block text-xs font-semibold text-muted uppercase">
            Pool
          </label>
          <SelectInput id="pool" name="pool" defaultValue={pool}>
            <option value="ALL">All words</option>
            <option value="ANSWERS">Answer pool</option>
            <option value="VALIDATION">Validation list</option>
          </SelectInput>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Filter
        </button>
      </form>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <th className="px-4 py-3">Word</th>
                <th className="px-4 py-3 text-right">Length</th>
                <th className="px-4 py-3">Pool</th>
                <th className="px-4 py-3">Tags</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((word) => (
                <tr key={word.id} className="border-t border-white/10">
                  <td className="px-4 py-2.5 font-mono font-medium uppercase">{word.word}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{word.length ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        word.isAnswerPool ? "bg-primary/15 text-primary" : "bg-white/10 text-muted",
                      )}
                    >
                      {word.isAnswerPool ? "ANSWER" : "VALID"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{word.tags.join(", ") || "—"}</td>
                </tr>
              ))}
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No words match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        total={data.total}
        buildHref={(nextPage) =>
          `/admin/words${buildQuery({
            game: game.slug,
            q,
            pool: pool === "ALL" ? undefined : pool,
            page: nextPage,
          })}`
        }
      />
    </>
  );
}
