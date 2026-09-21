import { getCurrentUser } from "@/lib/auth/dal";

import { getGuestSession } from "./guest";

export interface Identity {
  userId: string | null;
  guestId: string | null;
}

/** Resolves who is playing: a signed-in user first, otherwise the guest cookie. */
export async function getIdentity(): Promise<Identity> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id, guestId: null };

  const guest = await getGuestSession();
  return { userId: null, guestId: guest?.id ?? null };
}

export function hasIdentity(identity: Identity): boolean {
  return Boolean(identity.userId || identity.guestId);
}

/** Prisma `where` fragment that scopes a query to the current player. */
export function identityWhere(identity: Identity) {
  return identity.userId ? { userId: identity.userId } : { guestId: identity.guestId };
}
