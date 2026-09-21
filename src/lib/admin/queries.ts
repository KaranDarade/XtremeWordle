import { Prisma, Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { bucketKeyForMode, dailyBucketKey, type RotationMode } from "@/lib/time/buckets";
import { previewPuzzle, type GameRef } from "@/lib/words/resolver";
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function toPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------- Overview -------------------------------

export async function getOverviewStats() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const todayBucket = dailyBucketKey(now);

  const [
    totalUsers,
    newUsers7d,
    bannedUsers,
    totalGuests,
    activeGames,
    totalWords,
    resultsToday,
    results7d,
    solved7d,
    avgAttempts,
    puzzlesToday,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.guestSession.count(),
    prisma.game.count({ where: { isActive: true } }),
    prisma.wordEntry.count({ where: { isActive: true } }),
    prisma.gameResult.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.gameResult.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.gameResult.count({ where: { createdAt: { gte: weekAgo }, solved: true } }),
    prisma.gameResult.aggregate({ _avg: { attempts: true }, where: { solved: true } }),
    prisma.dailyPuzzle.count({ where: { bucketKey: todayBucket } }),
  ]);

  return {
    totalUsers,
    newUsers7d,
    bannedUsers,
    totalGuests,
    activeGames,
    totalWords,
    resultsToday,
    results7d,
    solved7d,
    solveRate7d: results7d === 0 ? 0 : Math.round((solved7d / results7d) * 100),
    avgAttempts: avgAttempts._avg.attempts ?? 0,
    puzzlesToday,
  };
}

export async function getRecentSignups(limit = 6) {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
}

export async function getRecentActivity(limit = 8) {
  return prisma.gameResult.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      game: { select: { name: true, slug: true } },
      user: { select: { name: true, email: true } },
      guest: { select: { id: true } },
    },
  });
}

// ------------------------------- Users -------------------------------

export interface ListUsersParams {
  q?: string;
  role?: Role | "ALL";
  page?: number;
  pageSize?: number;
}

export async function listUsers({ q, role = "ALL", page = 1, pageSize = 20 }: ListUsersParams) {
  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as Prisma.QueryMode } },
            { name: { contains: q, mode: "insensitive" as Prisma.QueryMode } },
          ],
        }
      : {}),
    ...(role !== "ALL" ? { role } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBanned: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { gameResults: true, sessions: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return toPage(items, total, page, pageSize);
}

export async function getUserDetail(userId: string) {
  const [user, sessions, results, solvedCount, playedCount, avg] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.gameResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { game: { select: { name: true, slug: true } } },
    }),
    prisma.gameResult.count({ where: { userId, solved: true } }),
    prisma.gameResult.count({ where: { userId } }),
    prisma.gameResult.aggregate({
      _avg: { attempts: true, durationMs: true },
      where: { userId, solved: true },
    }),
  ]);

  if (!user) return null;

  const now = Date.now();
  const sessionsWithStatus = sessions.map((session) => ({
    ...session,
    status: session.revokedAt
      ? ("revoked" as const)
      : session.expiresAt.getTime() < now
        ? ("expired" as const)
        : ("active" as const),
  }));

  return {
    user,
    sessions: sessionsWithStatus,
    results,
    stats: {
      played: playedCount,
      solved: solvedCount,
      solveRate: playedCount === 0 ? 0 : Math.round((solvedCount / playedCount) * 100),
      avgAttempts: avg._avg.attempts ?? 0,
      avgDurationMs: avg._avg.durationMs ?? 0,
    },
  };
}

// ------------------------------- Games -------------------------------

export async function listGames() {
  return prisma.game.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: { wordEntries: true, puzzles: true, gameResults: true, dailyPuzzles: true },
      },
    },
  });
}

export async function getGameBySlug(slug: string) {
  return prisma.game.findUnique({ where: { slug } });
}

// ------------------------------- Words -------------------------------

export interface ListWordsParams {
  gameId: string;
  q?: string;
  pool?: "ALL" | "ANSWERS" | "VALIDATION";
  page?: number;
  pageSize?: number;
}

export async function listWords({
  gameId,
  q,
  pool = "ALL",
  page = 1,
  pageSize = 25,
}: ListWordsParams) {
  const where: Prisma.WordEntryWhereInput = {
    gameId,
    ...(q ? { normalized: { contains: q.toLowerCase() } } : {}),
    ...(pool === "ANSWERS" ? { isAnswerPool: true } : {}),
    ...(pool === "VALIDATION" ? { isAnswerPool: false } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.wordEntry.findMany({
      where,
      orderBy: { word: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.wordEntry.count({ where }),
  ]);

  return toPage(items, total, page, pageSize);
}

export async function getWordPoolCounts(gameId: string) {
  const [answers, validation] = await Promise.all([
    prisma.wordEntry.count({ where: { gameId, isAnswerPool: true, isActive: true } }),
    prisma.wordEntry.count({ where: { gameId, isAnswerPool: false, isActive: true } }),
  ]);
  return { answers, validation };
}

// ------------------------------- Schedule -------------------------------

export interface ScheduleRow {
  bucketKey: string;
  label: string;
  word: string | null;
  source: "AUTO" | "MANUAL" | "PREVIEW" | "EMPTY";
  isPreview: boolean;
  createdBy: string | null;
  isPast: boolean;
  isCurrent: boolean;
}

function bucketLabel(bucketKey: string, mode: RotationMode): string {
  if (mode === "twelve-hour") {
    const [, , , half] = bucketKey.split("-");
    return `${bucketKey.slice(0, 10)} · ${half === "12" ? "12:00 PM" : "12:00 AM"} IST`;
  }
  return bucketKey;
}

export async function getSchedule(game: GameRef, mode: RotationMode, window = 12) {
  const now = new Date();
  const step = mode === "twelve-hour" ? 12 * 60 * 60 * 1000 : DAY_MS;
  const currentKey = bucketKeyForMode(mode, now);

  const keys: string[] = [];
  for (let offset = -2; offset <= window; offset += 1) {
    keys.push(bucketKeyForMode(mode, new Date(now.getTime() + offset * step)));
  }

  const existing = await prisma.dailyPuzzle.findMany({
    where: { gameId: game.id, bucketKey: { in: keys } },
    include: { admin: { select: { name: true, email: true } } },
  });
  const byKey = new Map(existing.map((row) => [row.bucketKey, row]));

  const rows: ScheduleRow[] = [];
  for (const bucketKey of keys) {
    const row = byKey.get(bucketKey);
    const isCurrent = bucketKey === currentKey;
    const isPast = bucketKey < currentKey;

    if (row) {
      rows.push({
        bucketKey,
        label: bucketLabel(bucketKey, mode),
        word: row.word,
        source: row.source,
        isPreview: false,
        createdBy: row.admin?.name ?? row.admin?.email ?? null,
        isPast,
        isCurrent,
      });
      continue;
    }

    const preview = await previewPuzzle(game, bucketKey);
    rows.push({
      bucketKey,
      label: bucketLabel(bucketKey, mode),
      word: preview?.word ?? null,
      source: preview ? "PREVIEW" : "EMPTY",
      isPreview: true,
      createdBy: null,
      isPast,
      isCurrent,
    });
  }

  return rows;
}

// ------------------------------- Analytics -------------------------------

export async function getAnalytics(gameId: string, days = 14) {
  const since = new Date(Date.now() - days * DAY_MS);

  const [totalPlays, solved, guests, registered, avg, distribution, recentResults, puzzleCount] =
    await Promise.all([
      prisma.gameResult.count({ where: { gameId } }),
      prisma.gameResult.count({ where: { gameId, solved: true } }),
      prisma.gameResult.count({ where: { gameId, guestId: { not: null } } }),
      prisma.gameResult.count({ where: { gameId, userId: { not: null } } }),
      prisma.gameResult.aggregate({ _avg: { attempts: true }, where: { gameId, solved: true } }),
      prisma.gameResult.groupBy({
        by: ["attempts"],
        where: { gameId, solved: true },
        _count: { _all: true },
        orderBy: { attempts: "asc" },
      }),
      prisma.gameResult.findMany({
        where: { gameId, createdAt: { gte: since } },
        select: { createdAt: true, solved: true },
      }),
      prisma.dailyPuzzle.count({ where: { gameId } }),
    ]);

  const daily = new Map<string, { plays: number; solved: number }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    daily.set(dailyBucketKey(new Date(Date.now() - i * DAY_MS)), { plays: 0, solved: 0 });
  }
  for (const result of recentResults) {
    const key = dailyBucketKey(result.createdAt);
    const entry = daily.get(key);
    if (entry) {
      entry.plays += 1;
      if (result.solved) entry.solved += 1;
    }
  }

  return {
    totalPlays,
    solved,
    solveRate: totalPlays === 0 ? 0 : Math.round((solved / totalPlays) * 100),
    guests,
    registered,
    avgAttempts: avg._avg.attempts ?? 0,
    distribution: distribution.map((row) => ({ attempts: row.attempts, count: row._count._all })),
    series: [...daily.entries()].map(([date, value]) => ({ date, ...value })),
    puzzleCount,
  };
}

// ------------------------------- Audit -------------------------------

export async function listAuditLogs(limit = 60) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { admin: { select: { name: true, email: true } } },
  });
}

export const ROLE_VALUES = Object.values(Role);
