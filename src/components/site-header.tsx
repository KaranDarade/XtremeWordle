import { LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";

import { BubbleLogo } from "@/components/brand/bubble-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logoutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/dal";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-3 z-50 mx-auto w-full max-w-7xl px-4">
      <div className="glass flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 sm:px-4">
        <Link
          href="/"
          aria-label="Bubble Wordle home"
          className="group flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="bubble-badge grid size-9 place-items-center rounded-xl transition duration-300 group-hover:scale-105">
            <BubbleLogo className="size-6" />
          </span>
          <span className="text-sm whitespace-nowrap sm:text-lg">
            Bubble <span className="text-primary">Wordle</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/games"
            data-testid="nav-games"
            className="hidden rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground sm:inline-flex"
          >
            Games
          </Link>

          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              data-testid="admin-link"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:text-foreground sm:inline-flex"
            >
              <LayoutDashboard className="size-4" />
              Admin
            </Link>
          ) : null}

          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2">
              <span
                data-testid="header-user"
                className="hidden max-w-40 truncate text-sm font-medium sm:inline"
              >
                {user.name ?? user.email}
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  data-testid="logout-button"
                  className="glass glass-interactive inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                data-testid="login-link"
                className="rounded-xl px-2.5 py-2 text-sm font-medium whitespace-nowrap text-muted transition hover:text-foreground sm:px-3"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                data-testid="signup-link"
                className="btn-primary rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap sm:px-3.5"
              >
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
