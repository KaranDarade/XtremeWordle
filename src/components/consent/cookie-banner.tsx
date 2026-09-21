"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { recordConsentAction } from "@/lib/consent/actions";
import type { ConsentChoice } from "@/lib/consent/constants";

export function ConsentBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function choose(choice: ConsentChoice) {
    setDismissed(true);
    await recordConsentAction(choice);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl sm:inset-x-4">
      <div className="glass-strong flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Cookie className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold">We value your privacy</p>
            <p className="text-xs text-muted">
              We use essential cookies to keep you signed in and remember your progress. Optional
              analytics help us improve the games. Read our{" "}
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <button
            type="button"
            data-testid="consent-essential"
            onClick={() => void choose("essential")}
            className="glass rounded-xl px-3.5 py-2 text-xs font-semibold transition hover:opacity-90"
          >
            Essential only
          </button>
          <button
            type="button"
            data-testid="consent-all"
            onClick={() => void choose("all")}
            className="rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
