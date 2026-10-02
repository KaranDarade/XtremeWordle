/**
 * Cloudflare Turnstile verification.
 *
 * When no secret is configured the check is bypassed so the reset flow works in
 * development and tests; the widget is hidden at the same time (see
 * `isTurnstileConfigured`), so a real deployment always has it enforced.
 */

export const TURNSTILE_VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}

export function turnstileSecret(): string | null {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  return secret ? secret : null;
}

export function isTurnstileConfigured(): boolean {
  return turnstileSiteKey() !== null && turnstileSecret() !== null;
}

export interface TurnstileResult {
  ok: boolean;
  /** True when no captcha is configured, so callers know it was skipped. */
  skipped: boolean;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  const secret = turnstileSecret();
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, skipped: false };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetchImpl(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) return { ok: false, skipped: false };

    const payload = (await response.json()) as { success?: unknown };
    return { ok: payload.success === true, skipped: false };
  } catch (error) {
    console.error("[turnstile] verification failed", error);
    return { ok: false, skipped: false };
  }
}
