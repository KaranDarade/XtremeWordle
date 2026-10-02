import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

import { ADMIN_LOGIN_PATH, SESSION_COOKIE } from "./constants";
import { hashToken } from "./tokens";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: "USER" | "ADMIN";
  createdAt: Date;
  avatarConfig: unknown;
  league: string;
  rankPoints: number;
}

/**
 * Data Access Layer. Every server-side read of the signed-in user goes
 * through here so authorization is centralized. `cache` dedupes the DB hit
 * across a single request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.isBanned) return null;

  const { id, email, username, name, role, createdAt, avatarConfig, league, rankPoints } =
    session.user;
  return { id, email, username, name, role, createdAt, avatarConfig, league, rankPoints };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`${ADMIN_LOGIN_PATH}?error=unauthorized`);
  if (user.role !== "ADMIN") redirect("/?error=forbidden");
  return user;
}
