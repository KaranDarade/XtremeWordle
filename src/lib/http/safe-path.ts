/**
 * Only allow same-origin, absolute-path redirects. Blocks open-redirect payloads
 * such as `//evil.com`, `https://evil.com` and `/\evil.com`.
 */
export function safePath(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
