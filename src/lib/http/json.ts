/** Parses a JSON body defensively; returns `{}` for malformed or non-object input. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
