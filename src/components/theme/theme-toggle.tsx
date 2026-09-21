"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Icon visibility is driven purely by the `.dark` class on <html>, so there is
 * no hydration mismatch and no client state to synchronise. The click handler
 * only runs after hydration, where `resolvedTheme` is available.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label="Toggle colour theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "glass glass-interactive inline-flex size-10 items-center justify-center rounded-full text-foreground",
        className,
      )}
    >
      <Moon className="size-5 dark:hidden" />
      <Sun className="hidden size-5 dark:block" />
    </button>
  );
}
