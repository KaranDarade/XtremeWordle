import { NextResponse, type NextRequest } from "next/server";

import { GUEST_COOKIE, GUEST_TTL_SECONDS, SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Next.js 16 replaced `middleware.ts` with `proxy.ts`.
 *
 * This runs on every non-asset request and does two cheap things:
 *  1. Ensures every visitor has an anonymous guest cookie (no DB access).
 *  2. Optimistically redirects unauthenticated users away from /admin.
 *
 * Real authorization still happens in the Data Access Layer (`lib/auth/dal.ts`),
 * because proxy checks are only a first line of defence.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (!request.cookies.get(GUEST_COOKIE)?.value) {
    response.cookies.set(GUEST_COOKIE, globalThis.crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_TTL_SECONDS,
    });
  }

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin = pathname === "/admin/login";
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isAdminArea && !isAdminLogin && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
