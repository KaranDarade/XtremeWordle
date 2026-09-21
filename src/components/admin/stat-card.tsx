import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("glass glass-card rounded-2xl p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    MANUAL: "bg-primary/15 text-primary",
    AUTO: "bg-success/15 text-success",
    PREVIEW: "bg-warning/15 text-warning",
    EMPTY: "bg-danger/15 text-danger",
  };
  const label = source === "PREVIEW" ? "AUTO (preview)" : source;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        styles[source] ?? "bg-white/10 text-muted",
      )}
    >
      {label}
    </span>
  );
}
