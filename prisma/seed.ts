import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

import bcrypt from "bcryptjs";

import { PrismaClient, Prisma, Role } from "../src/generated/prisma/client";
import { ARENA_DEFAULTS, ARENA_POINTS, LEAGUE_THRESHOLDS } from "../src/lib/arena/config";
import { DEMO_USERS, GAME_CATALOG } from "../src/lib/games/catalog";
import { createPrismaClient } from "../src/lib/prisma";

const prisma: PrismaClient = createPrismaClient();
const ADMIN_USERNAME = "arena-admin";

interface ConnectionsGroup {
  category: string;
  difficulty: number;
  words: string[];
}

interface ConnectionsFile {
  puzzles: {
    externalId: string;
    title: string;
    difficulty: number;
    groups: ConnectionsGroup[];
  }[];
}
const dataDir = path.join(process.cwd(), "prisma", "data");
const BCRYPT_ROUNDS = 12;
const CHUNK = 5000;

function readLines(file: string): string[] {
  return readFileSync(path.join(dataDir, file), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, file), "utf8")) as T;
}

async function insertWords(
  gameId: string,
  words: string[],
  options: { isAnswerPool: boolean; tags?: string[]; minLength?: number; maxLength?: number },
) {
  const { isAnswerPool, tags = [], minLength = 1, maxLength = 64 } = options;
  const unique = [
    ...new Set(
      words
        .map((word) => word.trim().toLowerCase())
        .filter((word) => {
          if (!/^[a-z]+$/.test(word)) return false;
          return word.length >= minLength && word.length <= maxLength;
        }),
    ),
  ];

  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = unique.slice(i, i + CHUNK).map((word) => ({
      gameId,
      word,
      normalized: word,
      length: word.length,
      isAnswerPool,
      isActive: true,
      tags,
    }));
    await prisma.wordEntry.createMany({ data: batch, skipDuplicates: true });
  }

  return unique.length;
}

function pickCentre(word: string): string {
  const vowels = "aeiou";
  const vowel = [...word].find((letter) => vowels.includes(letter));
  return vowel ?? word[0];
}

function buildLetterSets(dictionary: string[], limit = 200) {
  const candidates = dictionary
    .filter((word) => word.length === 7 && new Set(word).size === 7)
    .sort();

  const seen = new Set<string>();
  const sets: { externalId: string; centre: string; outer: string[]; pangram: string }[] = [];

  for (const word of candidates) {
    const centre = pickCentre(word);
    const outer = [...new Set(word)].filter((letter) => letter !== centre).sort();
    const key = `${centre}:${outer.join("")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push({
      externalId: `${centre}${outer.join("")}`.toUpperCase(),
      centre,
      outer,
      pangram: word,
    });
    if (sets.length >= limit) break;
  }

  return sets;
}

async function main() {
  console.log("Seeding Wordle Arena...");

  // --- Admin + demo users ---
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@extremewordle.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@12345";
  const adminName = process.env.ADMIN_NAME ?? "Arena Admin";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, username: ADMIN_USERNAME, role: Role.ADMIN, isBanned: false },
    create: {
      email: adminEmail,
      username: ADMIN_USERNAME,
      name: adminName,
      passwordHash: await bcrypt.hash(adminPassword, BCRYPT_ROUNDS),
      role: Role.ADMIN,
    },
  });
  console.log(`  admin: ${adminEmail}`);

  // Demo accounts have a well-known password, so they are opt-in only. They
  // must never be created on a production database by accident.
  if (process.env.SEED_DEMO_USERS === "1") {
    for (const demo of DEMO_USERS) {
      await prisma.user.upsert({
        where: { email: demo.email },
        update: { username: demo.username },
        create: {
          email: demo.email,
          username: demo.username,
          name: demo.name,
          passwordHash: await bcrypt.hash(demo.password, BCRYPT_ROUNDS),
          role: Role.USER,
        },
      });
    }
    console.log(`  demo users: ${DEMO_USERS.length}`);
  } else {
    console.log("  demo users: skipped (set SEED_DEMO_USERS=1 to create)");
  }

  // --- Games ---
  const games = new Map<string, string>();
  for (const definition of GAME_CATALOG) {
    // `resolver` lives inside settings so the runtime only has one place to read it.
    const settings = {
      ...definition.settings,
      resolver: definition.resolver,
      rotation: definition.rotation,
    } as Prisma.InputJsonValue;

    const game = await prisma.game.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.name,
        tagline: definition.tagline,
        description: definition.description,
        category: definition.category,
        sortOrder: definition.sortOrder,
        isActive: true,
        settings,
      },
      create: {
        slug: definition.slug,
        name: definition.name,
        tagline: definition.tagline,
        description: definition.description,
        category: definition.category,
        sortOrder: definition.sortOrder,
        isActive: true,
        settings,
      },
    });
    games.set(definition.slug, game.id);
  }
  console.log(`  games: ${games.size}`);

  // --- Wordle: answers + allowed guesses ---
  const wordleId = games.get("wordle")!;
  const answers = readLines("wordle-answers.txt");
  const guesses = readLines("wordle-guesses.txt");
  const answerCount = await insertWords(wordleId, answers, {
    isAnswerPool: true,
    tags: ["answer"],
    minLength: 5,
    maxLength: 5,
  });
  const guessCount = await insertWords(wordleId, guesses, {
    isAnswerPool: false,
    tags: ["guess"],
    minLength: 5,
    maxLength: 5,
  });
  console.log(`  wordle: ${answerCount} answers, ${guessCount} extra guesses`);

  // --- Spelling Bee: dictionary + letter sets ---
  const beeId = games.get("spelling-bee")!;
  const dictionary = readLines("enable1.txt");
  const dictCount = await insertWords(beeId, dictionary, {
    isAnswerPool: false,
    tags: ["dictionary"],
    minLength: 4,
    maxLength: 15,
  });
  const letterSets = buildLetterSets(dictionary);
  for (const set of letterSets) {
    await prisma.gamePuzzle.upsert({
      where: { gameId_externalId: { gameId: beeId, externalId: set.externalId } },
      update: { payload: { centre: set.centre, outer: set.outer, pangram: set.pangram } },
      create: {
        gameId: beeId,
        externalId: set.externalId,
        title: null,
        difficulty: 0,
        payload: { centre: set.centre, outer: set.outer, pangram: set.pangram },
      },
    });
  }
  console.log(`  spelling-bee: ${dictCount} dictionary words, ${letterSets.length} letter sets`);

  // --- Connections: curated puzzles ---
  const connectionsId = games.get("connections")!;
  const connections = readJson<ConnectionsFile>("connections-puzzles.json");

  for (const puzzle of connections.puzzles) {
    const payload = { groups: puzzle.groups } as unknown as Prisma.InputJsonValue;
    await prisma.gamePuzzle.upsert({
      where: { gameId_externalId: { gameId: connectionsId, externalId: puzzle.externalId } },
      update: { title: puzzle.title, difficulty: puzzle.difficulty, payload },
      create: {
        gameId: connectionsId,
        externalId: puzzle.externalId,
        title: puzzle.title,
        difficulty: puzzle.difficulty,
        payload,
      },
    });
  }
  console.log(`  connections: ${connections.puzzles.length} puzzles`);

  // --- Arena configuration (single source of truth for the engine + admin UI) ---
  const arenaSettings: { key: string; value: Prisma.InputJsonValue }[] = [
    { key: "arena.leagues", value: LEAGUE_THRESHOLDS as unknown as Prisma.InputJsonValue },
    { key: "arena.points", value: ARENA_POINTS as unknown as Prisma.InputJsonValue },
    {
      key: "arena.timings",
      value: {
        roundMs: ARENA_DEFAULTS.roundMs,
        breakMs: ARENA_DEFAULTS.breakMs,
        countdownMs: ARENA_DEFAULTS.countdownMs,
        roundCount: ARENA_DEFAULTS.roundCount,
      },
    },
  ];

  for (const setting of arenaSettings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    });
  }
  console.log(`  arena settings: ${arenaSettings.length}`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
