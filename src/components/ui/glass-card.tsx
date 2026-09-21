import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function GlassCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("glass rounded-3xl", className)} {...props} />;
}

export function GlassPanel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("glass-strong rounded-2xl", className)} {...props} />;
}
