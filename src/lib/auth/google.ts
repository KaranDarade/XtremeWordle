import { createHash, randomBytes } from "node:crypto";

/**
 * Minimal Google OAuth 2.0 helper (authorization code + PKCE).
 *
 * Only `fetch` and env vars are used, so this module is safe to import in unit
 * tests and can be pointed at a stub endpoint by overriding the URLs.
 */

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOAuthState(): string {
  return randomBytes(16).toString("base64url");
}

/** Returns null when Google sign-in has not been configured. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${base}/api/auth/google/callback`;

  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return googleConfig() !== null;
}

export function googleAuthUrl(input: {
  state: string;
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export async function exchangeGoogleCode(input: {
  code: string;
  codeVerifier: string;
  config: GoogleConfig;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const doFetch = input.fetchImpl ?? fetch;

  const response = await doFetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.config.clientId,
      client_secret: input.config.clientSecret,
      redirect_uri: input.config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    }).toString(),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { access_token?: unknown };
  return typeof payload.access_token === "string" ? payload.access_token : null;
}

export async function fetchGoogleProfile(
  accessToken: string,
  fetchImpl?: typeof fetch,
): Promise<GoogleProfile | null> {
  const doFetch = fetchImpl ?? fetch;

  const response = await doFetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
  };

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}
