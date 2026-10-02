import { NextResponse } from "next/server";

import { cookies } from "next/headers";

import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_TTL_SECONDS,
  OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/constants";
import { createOAuthState, createPkcePair, googleAuthUrl, googleConfig } from "@/lib/auth/google";
import { guardRequest } from "@/lib/http/guard";
import { safePath } from "@/lib/http/safe-path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guardRequest(request, "oauth:start", 30);
  if (blocked) return blocked;

  const config = googleConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Google sign-in is not configured on this deployment." },
      { status: 503 },
    );
  }

  const { verifier, challenge } = createPkcePair();
  const state = createOAuthState();
  const next = safePath(new URL(request.url).searchParams.get("next"));

  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_TTL_SECONDS,
  };

  cookieStore.set(OAUTH_STATE_COOKIE, state, options);
  cookieStore.set(OAUTH_VERIFIER_COOKIE, verifier, options);
  cookieStore.set(OAUTH_NEXT_COOKIE, next, options);

  return NextResponse.redirect(
    googleAuthUrl({
      state,
      codeChallenge: challenge,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
    }),
  );
}
