"use client";

import { useActionState } from "react";

import { SourceBadge } from "@/components/admin/stat-card";
import { Notice } from "@/components/ui/form";
import { regenerateWordAction } from "@/lib/admin/actions";
import type { ScheduleRow } from "@/lib/admin/queries";
import { IDLE_ADMIN_STATE } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

export function ScheduleTable({ gameSlug, rows }: { gameSlug: string; rows: ScheduleRow[] }) {
  const [state, formAction, pending] = useActionState(regenerateWordAction, IDLE_ADMIN_STATE);

  return (
    <div className="space-y-3">
      <Notice status={state.status} message={state.message} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-muted uppercase">
              <th className="px-3 py-2">Slot (IST)</th>
              <th className="px-3 py-2">Word</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Set by</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.bucketKey}
                data-testid={`schedule-row-${row.bucketKey}`}
                className={cn(
                  "border-t border-white/10",
                  row.isCurrent && "bg-primary/10",
                  row.isPast && "opacity-60",
                )}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.label}
                  {row.isCurrent ? (
                    <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      NOW
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono font-semibold tracking-wide uppercase">
                  {row.word ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <SourceBadge source={row.source} />
                </td>
                <td className="px-3 py-2 text-xs text-muted">{row.createdBy ?? "—"}</td>
                <td className="px-3 py-2">
                  <form action={formAction} className="flex justify-end gap-2">
                    <input type="hidden" name="gameSlug" value={gameSlug} />
                    <input type="hidden" name="bucketKey" value={row.bucketKey} />
                    <button
                      type="submit"
                      name="force"
                      value="false"
                      disabled={pending}
                      className="glass rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    <button
                      type="submit"
                      name="force"
                      value="true"
                      disabled={pending}
                      data-testid={`force-${row.bucketKey}`}
                      className="rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/25 disabled:opacity-50"
                    >
                      Force new
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
