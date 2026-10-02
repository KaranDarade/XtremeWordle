import { prisma } from "@/lib/db";

const RESERVED = new Set(["admin", "api", "profile", "settings", "login", "signup", "arena", "u"]);

/** URL-safe handle: lowercase, alphanumeric with single dashes. */
export function slugifyUsername(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20)
    .replace(/-+$/g, "");
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])?$/.test(value) && !RESERVED.has(value);
}

function randomSuffix(length = 4): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Best-effort handle from an email local-part, falling back to a random one. */
export function usernameCandidate(email: string, name?: string | null): string {
  const fromName = name ? slugifyUsername(name) : "";
  const fromEmail = slugifyUsername(email.split("@")[0] ?? "");
  const base = fromName || fromEmail || "player";
  if (isValidUsername(base)) return base;
  return `${slugifyUsername(base) || "player"}-${randomSuffix()}`;
}

/**
 * Finds a free handle, adding a short random suffix when the preferred one is
 * taken or reserved. Falls back to a fully random handle after a few attempts.
 */
export async function pickAvailableUsername(email: string, name?: string | null): Promise<string> {
  const base = usernameCandidate(email, name);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 15)}-${randomSuffix()}`;
    if (!isValidUsername(candidate)) continue;

    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `player-${randomSuffix(8)}`;
}
