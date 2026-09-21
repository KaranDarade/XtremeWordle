import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center">
      <div className="glass w-full rounded-3xl p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Compass className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          That puzzle does not exist — it may have been retired or the link is wrong.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Go home
          </Link>
          <Link
            href="/games"
            className="glass inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
          >
            Browse games
          </Link>
        </div>
      </div>
    </div>
  );
}
