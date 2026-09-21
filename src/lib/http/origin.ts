/**
 * Lightweight CSRF guard for JSON API routes: browsers always send an Origin
 * header on cross-origin requests, so a mismatch (or missing host) is rejected.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
