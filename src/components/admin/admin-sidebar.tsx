"use client";

import {
  BarChart3,
  CalendarClock,
  ExternalLink,
  Gamepad2,
  LayoutDashboard,
  Library,
  ScrollText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BubbleLogo } from "@/components/brand/bubble-logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/schedule", label: "Word schedule", icon: CalendarClock },
  { href: "/admin/words", label: "Word lists", icon: Library },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();

  return (
    <aside className="lg:w-64 lg:shrink-0">
      <div className="glass sticky top-4 rounded-2xl p-3">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="bubble-badge grid size-8 place-items-center rounded-lg">
            <BubbleLogo className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-wide text-muted uppercase">
              Bubble Wordle
            </p>
            <p className="truncate text-sm font-semibold">{adminName}</p>
          </div>
        </div>

        <nav className="mt-1 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {LINKS.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                data-testid={`admin-nav-${link.href.split("/").pop() || "overview"}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                  active
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted hover:bg-white/10 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 border-t border-white/10 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground"
          >
            <ExternalLink className="size-4" />
            Back to site
          </Link>
        </div>
      </div>
    </aside>
  );
}
