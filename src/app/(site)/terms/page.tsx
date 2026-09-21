import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The rules for using Bubble Wordle.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 pt-12">
      <div className="glass rounded-3xl p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">Terms of use</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="text-base font-semibold text-foreground">Using the service</h2>
            <p>
              Bubble Wordle is provided free of charge for personal entertainment. You may play as a
              guest or create an account. Do not attempt to disrupt the service or access accounts
              that are not yours.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Accounts</h2>
            <p>
              You are responsible for keeping your password safe. We may suspend accounts that abuse
              the service or attempt to automate play in ways that harm other users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Puzzle content</h2>
            <p>
              Words and puzzles rotate automatically, sometimes curated by our editors. Puzzles are
              provided for entertainment and “as is”, with no guarantee of availability.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Changes</h2>
            <p>
              These terms may be updated as the service evolves. Continued use after a change means
              you accept the updated terms.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
