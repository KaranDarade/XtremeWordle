import { Shield } from "lucide-react";

import type { LeagueName } from "@/lib/arena/config";
import { cn } from "@/lib/utils";

const LEAGUE_STYLES: Record<LeagueName, { label: string; className: string }> = {
  BRONZE: { label: "Bronze", className: "bg-[#a9744f]/20 text-[#c58b5f] border-[#a9744f]/40" },
  SILVER: { label: "Silver", className: "bg-[#b9b9c0]/20 text-[#d3d3da] border-[#b9b9c0]/40" },
  GOLD: { label: "Gold", className: "bg-[#d4a15a]/20 text-[#e6bb78] border-[#d4a15a]/40" },
  PLATINUM: { label: "Platinum", className: "bg-[#8fd3d0]/20 text-[#a9e6e3] border-[#8fd3d0]/40" },
  DIAMOND: { label: "Diamond", className: "bg-[#9fd0ff]/20 text-[#b9ddff] border-[#9fd0ff]/40" },
};

export function LeagueBadge({
  league,
  points,
  className,
}: {
  league: LeagueName;
  points?: number;
  className?: string;
}) {
  const style = LEAGUE_STYLES[league] ?? LEAGUE_STYLES.BRONZE;

  return (
    <span
      data-testid={`league-badge-${league.toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
        style.className,
        className,
      )}
    >
      <Shield className="size-3" />
      {style.label}
      {typeof points === "number" ? (
        <span className="font-semibold opacity-80">{points}</span>
      ) : null}
    </span>
  );
}
