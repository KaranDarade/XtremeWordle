/**
 * Reads a required secret from the environment.
 *
 * Development falls back to a documented default so the app runs with no setup.
 * Production fails closed: silently using a public fallback would be a real
 * vulnerability, so a missing required secret throws instead.
 */
export function requiredSecret(name: string, devFallback: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production.`);
  }
  return devFallback;
}
