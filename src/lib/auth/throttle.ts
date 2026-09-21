import { clientIpFromHeaders, rateLimit } from "@/lib/http/rate-limit";

const AUTH_RATE_LIMIT = Number(process.env.AUTH_RATE_LIMIT ?? 30);
const AUTH_WINDOW_MS = 10 * 60 * 1000;

export interface ThrottleResult {
  allowed: boolean;
  retryAfterMinutes: number;
}

/**
 * Throttles credential attempts per IP + identifier. 30 attempts per 10 minutes
 * by default (override with AUTH_RATE_LIMIT).
 */
export async function authThrottle(scope: string, identifier: string): Promise<ThrottleResult> {
  const ip = await clientIpFromHeaders();
  const key = `auth:${scope}:${ip}:${identifier.trim().toLowerCase()}`;
  const result = rateLimit(key, AUTH_RATE_LIMIT, AUTH_WINDOW_MS);

  return {
    allowed: result.allowed,
    retryAfterMinutes: Math.max(1, Math.ceil(result.retryAfterMs / 60_000)),
  };
}
