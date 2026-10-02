import { NextResponse } from "next/server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from "@/lib/auth/constants";
import { googleConfig } from "@/lib/auth/google";
import { completeGoogleSignIn } from "@/lib/auth/google-signin";
import { createSession } from "@/lib/auth/session";
import { safePath } from "@/lib/http/safe-path";
import { migrateGuestToUser } from "@/lib/session/guest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();

  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? null;
  const verifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value ?? null;
  const next = safePath(cookieStore.get(OAUTH_NEXT_COOKIE)?.value);

  cookieStore.delete(OAUTH_STATE_COOKIE);
  cookieStore.delete(OAUTH_VERIFIER_COOKIE);
  cookieStore.delete(OAUTH_NEXT_COOKIE);

  const result = await completeGoogleSignIn({
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    denied: url.searchParams.get("error"),
    savedState,
    verifier,
    config: googleConfig(),
  });

  if (!result.ok) {
    const target = new URL("/login", request.url);
    target.searchParams.set("error", result.reason);
    if (next !== "/") target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  await createSession(result.userId);
  await migrateGuestToUser(result.userId).catch(() => 0);
  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL(next, request.url));
}
