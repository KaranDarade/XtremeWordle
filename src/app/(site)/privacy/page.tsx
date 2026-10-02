import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Wordle Arena handles your data, cookies and sessions.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 pt-12">
      <div className="glass rounded-3xl p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="text-base font-semibold text-foreground">What we collect</h2>
            <p>
              When you play as a guest we create an anonymous session identifier and store gameplay
              results against it so your progress survives a page reload. If you create an account
              we additionally store your name, email address and a securely hashed password.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Cookies we use</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Essential:</strong> a session cookie to keep you
                signed in, and a guest cookie to remember anonymous progress. These cannot be turned
                off while still using the games.
              </li>
              <li>
                <strong className="text-foreground">Preferences:</strong> a theme cookie so the site
                remembers light or dark mode.
              </li>
              <li>
                <strong className="text-foreground">Optional analytics:</strong> only set when you
                choose “Accept all” in the cookie banner.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Data retention</h2>
            <p>
              Sessions expire automatically and can be revoked at any time from your browser by
              signing out. Anonymous guest sessions may be cleaned up periodically.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground">Your choices</h2>
            <p>
              You can play every game without an account. If you would like your account data
              removed, contact us and we will delete it.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
