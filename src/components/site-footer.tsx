import { Mail } from "lucide-react";
import Link from "next/link";

import { BubbleLogo } from "@/components/brand/bubble-logo";

const CONTACT_EMAIL = "daradekaran123@gmail.com";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-7xl px-4 pb-8">
      <div className="glass flex flex-col gap-4 rounded-2xl px-5 py-4 text-sm text-muted">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <Link href="/" className="flex items-center gap-2" aria-label="Bubble Wordle home">
            <span className="bubble-badge grid size-7 place-items-center rounded-lg">
              <BubbleLogo className="size-5" />
            </span>
            <span className="font-semibold">
              Bubble <span className="text-foreground">Wordle</span>
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            <Link href="/games" className="transition hover:text-foreground">
              Games
            </Link>
            <Link href="/privacy" className="transition hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3 sm:flex-row">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            data-testid="footer-contact"
            className="inline-flex items-center gap-2 transition hover:text-foreground"
          >
            <Mail className="size-4 text-primary" />
            <span>
              Contact: <span className="font-medium text-foreground">{CONTACT_EMAIL}</span>
            </span>
          </a>
          <p>© {new Date().getFullYear()} Bubble Wordle</p>
        </div>
      </div>
    </footer>
  );
}
