import type { RotationMode } from "@/lib/time/buckets";

export type ResolverKind = "word" | "puzzle";

export interface GameDefinition {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  sortOrder: number;
  resolver: ResolverKind;
  rotation: RotationMode;
  settings: Record<string, unknown>;
}

export const GAME_CATALOG: GameDefinition[] = [
  {
    slug: "wordle",
    name: "Wordle",
    tagline: "Guess the 5-letter word in 6 tries",
    description:
      "The classic daily word puzzle. Every guess reveals how close you are: green means the right letter in the right spot, yellow means the right letter in the wrong spot.",
    category: "word",
    sortOrder: 1,
    resolver: "word",
    rotation: "daily",
    settings: {
      answerLength: 5,
      maxAttempts: 6,
      unlimitedRotation: "twelve-hour",
    },
  },
  {
    slug: "spelling-bee",
    name: "Spelling Bee",
    tagline: "Make words from 7 letters",
    description:
      "Build as many words as you can from seven letters. Every answer must use the centre letter, and words with all seven letters are pangrams.",
    category: "word",
    sortOrder: 2,
    resolver: "puzzle",
    rotation: "daily",
    settings: {
      minWordLength: 4,
      requiredLetters: 7,
    },
  },
  {
    slug: "connections",
    name: "Connections",
    tagline: "Group words. Find the connections.",
    description:
      "Sixteen words, four hidden groups. Find the shared thread before you run out of mistakes.",
    category: "word",
    sortOrder: 3,
    resolver: "puzzle",
    rotation: "daily",
    settings: {
      groups: 4,
      wordsPerGroup: 4,
      maxMistakes: 4,
    },
  },
];

export const DEMO_USERS = [
  { email: "user@demo.local", name: "Demo User", password: "Demo@12345" },
  { email: "ayaan@demo.local", name: "Ayaan Khan", password: "Demo@12345" },
  { email: "priya@demo.local", name: "Priya Sharma", password: "Demo@12345" },
];
