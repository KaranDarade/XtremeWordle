import type { Metadata } from "next";

import { ArenaStage, type ArenaMe } from "@/components/arena/arena-stage";
import type { LeagueName } from "@/lib/arena/config";
import { findActiveMatch, getArenaState, resolveArenaIdentity } from "@/lib/arena/engine";
import { getOnlineCounts } from "@/lib/arena/presence";
import type { ArenaState } from "@/lib/arena/view";
import { avatarFromSeed, normalizeAvatar } from "@/lib/avatar/config";
import { getCurrentUser } from "@/lib/auth/dal";
import { getIdentity } from "@/lib/session/identity";

export const metadata: Metadata = {
  title: "Arena",
  description:
    "Live 1v1 Wordle duels on Wordle Arena. Same word, twelve seconds a row — fastest solver wins.",
};

export default async function ArenaPage() {
  const [user, identity, online] = await Promise.all([
    getCurrentUser(),
    getIdentity(),
    getOnlineCounts(),
  ]);

  const arena = await resolveArenaIdentity(identity);

  const me: ArenaMe = {
    displayName: user?.name ?? user?.username ?? arena?.displayName ?? "Guest",
    avatar: user
      ? normalizeAvatar(user.avatarConfig)
      : avatarFromSeed(arena?.avatarSeed ?? "guest"),
    league: (arena?.league ?? "BRONZE") as LeagueName,
    rankPoints: arena?.rankPoints ?? 0,
    signedIn: Boolean(user),
  };

  // Refreshing mid-match rejoins the duel instead of dropping back to the lobby.
  let initialMatch: ArenaState | null = null;
  if (arena) {
    const activeMatchId = await findActiveMatch(arena);
    if (activeMatchId) {
      const state = await getArenaState(activeMatchId, arena);
      if (state?.status === "PLAYING") initialMatch = state;
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8">
      <header className="mb-5 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Arena</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Live 1v1 duels. Same word, same clock — solve it before your opponent does.
        </p>
      </header>

      <ArenaStage
        me={me}
        initialOnline={{ total: online.total, inMatch: online.inMatch }}
        initialMatch={initialMatch}
      />
    </div>
  );
}
