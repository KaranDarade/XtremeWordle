import Link from "next/link";

import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  total,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return <p className="px-1 py-2 text-xs text-muted">{total} result(s)</p>;
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2 text-sm">
      <span className="text-xs text-muted">
        Page {page} of {pageCount} · {total} result(s)
      </span>
      <div className="flex items-center gap-2">
        <PageLink href={buildHref(prev)} disabled={page <= 1}>
          Previous
        </PageLink>
        <PageLink href={buildHref(next)} disabled={page >= pageCount}>
          Next
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className={cn("glass rounded-lg px-3 py-1.5 text-xs font-medium opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="glass glass-interactive rounded-lg px-3 py-1.5 text-xs font-medium"
    >
      {children}
    </Link>
  );
}
