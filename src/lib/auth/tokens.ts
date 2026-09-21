import { createHash, randomBytes } from "node:crypto";

/** Opaque, URL-safe session token handed to the browser. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Only the hash is ever persisted, so a DB leak cannot be replayed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
