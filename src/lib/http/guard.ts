import { NextResponse } from "next/server";

import { isSameOrigin } from "./origin";
import { clientIp, rateLimit } from "./rate-limit";

/**
 * Shared entry guard for JSON API routes: origin check + per-IP rate limit.
 * Returns a ready-to-send response when the request should be rejected.
 */
export function guardRequest(
  request: Request,
  scope: string,
  limit = 120,
  windowMs = 60_000,
): NextResponse | null {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const result = rateLimit(`${scope}:${clientIp(request)}`, limit, windowMs);
  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "retry-after": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) },
      },
    );
  }

  return null;
}
