import { cn } from "@/lib/utils";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}

export function GoogleButton({
  next,
  label = "Continue with Google",
  className,
}: {
  next?: string;
  label?: string;
  className?: string;
}) {
  const href = next
    ? `/api/auth/google/start?next=${encodeURIComponent(next)}`
    : "/api/auth/google/start";

  return (
    <a
      href={href}
      data-testid="google-signin"
      className={cn(
        "glass glass-interactive flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold",
        className,
      )}
    >
      <GoogleGlyph />
      {label}
    </a>
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-muted uppercase">
      <span className="h-px flex-1 bg-[var(--glass-border)]" />
      {label}
      <span className="h-px flex-1 bg-[var(--glass-border)]" />
    </div>
  );
}

const OAUTH_MESSAGES: Record<string, string> = {
  google_unavailable: "Google sign-in isn't available on this deployment.",
  google_denied: "Google sign-in was cancelled.",
  google_state: "That sign-in link expired. Please try again.",
  google_code: "Google sign-in was interrupted. Please try again.",
  google_token: "Google sign-in failed. Please try again.",
  google_profile: "We couldn't read your Google profile. Please try again.",
  google_email: "Your Google email isn't verified, so we couldn't sign you in.",
  banned: "This account has been suspended.",
};

export function OAuthError({ code }: { code?: string }) {
  if (!code) return null;
  const message = OAUTH_MESSAGES[code];
  if (!message) return null;

  return (
    <p
      role="alert"
      data-testid="oauth-error"
      className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
    >
      {message}
    </p>
  );
}
