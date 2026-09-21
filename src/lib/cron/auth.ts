import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of a submitted scheduler token against CRON_SECRET.
 * Both values are hashed first so the comparison length is always equal.
 */
export function isCronAuthorized(provided: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !provided) return false;

  const providedHash = createHash("sha256").update(provided).digest();
  const secretHash = createHash("sha256").update(secret).digest();
  return timingSafeEqual(providedHash, secretHash);
}

/**
 * Accepts either the `Authorization: Bearer <secret>` header (what Vercel Cron
 * sends) or a `?secret=` query parameter (handy for cron-job.org and manual runs).
 */
export function extractCronToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }

  try {
    return new URL(request.url).searchParams.get("secret");
  } catch {
    return null;
  }
}
