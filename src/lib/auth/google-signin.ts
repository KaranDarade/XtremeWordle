import { resolveGoogleAccount } from "./google-account";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  type GoogleConfig,
  type GoogleProfile,
} from "./google";

export interface CompleteGoogleSignInInput {
  code: string | null;
  state: string | null;
  denied: string | null;
  savedState: string | null;
  verifier: string | null;
  config: GoogleConfig | null;
  /** Injection points for tests; default to the real Google endpoints. */
  profileLoader?: (accessToken: string) => Promise<GoogleProfile | null>;
  tokenExchanger?: (input: {
    code: string;
    codeVerifier: string;
    config: GoogleConfig;
  }) => Promise<string | null>;
}

export type GoogleSignInResult =
  { ok: true; userId: string; created: boolean; linked: boolean } | { ok: false; reason: string };

/**
 * Verifies the OAuth round-trip and maps the Google profile onto a local
 * account. Cookie handling, session creation and redirecting stay in the route
 * so this stays unit/integration testable without a request context.
 */
export async function completeGoogleSignIn(
  input: CompleteGoogleSignInInput,
): Promise<GoogleSignInResult> {
  if (!input.config) return { ok: false, reason: "google_unavailable" };
  if (input.denied) return { ok: false, reason: "google_denied" };
  if (!input.code) return { ok: false, reason: "google_code" };
  if (!input.state || !input.savedState || input.state !== input.savedState) {
    return { ok: false, reason: "google_state" };
  }
  if (!input.verifier) return { ok: false, reason: "google_state" };

  const exchange = input.tokenExchanger ?? exchangeGoogleCode;
  const accessToken = await exchange({
    code: input.code,
    codeVerifier: input.verifier,
    config: input.config,
  });
  if (!accessToken) return { ok: false, reason: "google_token" };

  const loadProfile = input.profileLoader ?? ((token: string) => fetchGoogleProfile(token));
  const profile = await loadProfile(accessToken);
  if (!profile) return { ok: false, reason: "google_profile" };

  const outcome = await resolveGoogleAccount(profile);
  if (outcome.status !== "ok") {
    return { ok: false, reason: outcome.reason === "banned" ? "banned" : "google_email" };
  }

  return { ok: true, userId: outcome.userId, created: outcome.created, linked: outcome.linked };
}
