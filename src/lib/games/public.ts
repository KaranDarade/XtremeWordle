import { prisma } from "@/lib/db";
import { dailyBucketKey } from "@/lib/time/buckets";

export interface PublicGame {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string;
  sortOrder: number;
  playCount: number;
  wordCount: number;
}

export async function getPublicGames(): Promise<PublicGame[]> {
  const games = await prisma.game.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { gameResults: true, wordEntries: true } } },
  });

  return games.map((game) => ({
    id: game.id,
    slug: game.slug,
    name: game.name,
    tagline: game.tagline,
    description: game.description,
    category: game.category,
    sortOrder: game.sortOrder,
    playCount: game._count.gameResults,
    wordCount: game._count.wordEntries,
  }));
}

export async function getPublicGameBySlug(slug: string) {
  return prisma.game.findFirst({
    where: { slug, isActive: true },
    include: { _count: { select: { gameResults: true, wordEntries: true, dailyPuzzles: true } } },
  });
}

export async function getPublicStats() {
  const [gamesCount, wordsCount, playsCount, playersCount, puzzlesToday] = await Promise.all([
    prisma.game.count({ where: { isActive: true } }),
    prisma.wordEntry.count({ where: { isActive: true } }),
    prisma.gameResult.count(),
    prisma.user.count(),
    prisma.dailyPuzzle.count({ where: { bucketKey: dailyBucketKey() } }),
  ]);

  return { gamesCount, wordsCount, playsCount, playersCount, puzzlesToday };
}
