import type { LeagueName } from "./config";
import type { LetterFeedback } from "@/lib/words/feedback";

/**
 * Bot opponent ("Byte").
 *
 * Pure and deterministic: the same match id and round always produce the same
 * delay and guess, so the engine can lazily backfill past rounds without a
 * worker and still be idempotent.
 */

/** Common opening words — all are valid Wordle answers. */
const BOT_VOCABULARY = [
  "crane",
  "slate",
  "adieu",
  "audio",
  "raise",
  "arise",
  "stare",
  "trace",
  "least",
  "steam",
  "roate",
  "soare",
  "later",
  "alert",
  "alter",
  "irate",
  "ratio",
  "taser",
  "stale",
  "tears",
  "learn",
  "heart",
  "earth",
  "hater",
  "tales",
  "salet",
  "carte",
  "caret",
  "cater",
  "react",
  "siren",
  "rinse",
  "spine",
  "pines",
  "snipe",
  "print",
  "point",
  "paint",
  "inert",
  "tried",
  "tired",
  "diner",
  "lined",
  "under",
  "round",
  "sound",
  "wound",
  "bound",
  "found",
  "hound",
  "pound",
  "mount",
  "count",
  "fount",
  "shout",
  "about",
  "cloud",
  "spout",
  "stout",
  "pious",
  "mouse",
  "house",
  "mouse",
  "noise",
];

export interface BotDifficulty {
  /** Fraction of the play window the bot waits before guessing. */
  minThink: number;
  maxThink: number;
  /** 0 = random guesses, 1 = always uses its own feedback. */
  skill: number;
}

export function difficultyForLeague(league: LeagueName): BotDifficulty {
  switch (league) {
    case "DIAMOND":
      return { minThink: 0.1, maxThink: 0.35, skill: 1 };
    case "PLATINUM":
      return { minThink: 0.15, maxThink: 0.45, skill: 0.95 };
    case "GOLD":
      return { minThink: 0.2, maxThink: 0.6, skill: 0.8 };
    case "SILVER":
      return { minThink: 0.3, maxThink: 0.75, skill: 0.55 };
    default:
      return { minThink: 0.4, maxThink: 0.9, skill: 0.25 };
  }
}

/** FNV-1a — small, fast, stable across processes. */
function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unit(seed: string): number {
  return hash(seed) / 0xffffffff;
}

/** When (ms after the round's play window opens) the bot submits. */
export function botThinkMs(matchId: string, round: number, league: LeagueName): number {
  const { minThink, maxThink } = difficultyForLeague(league);
  const span = maxThink - minThink;
  return Math.round((minThink + unit(`${matchId}:${round}:think`) * span) * 1000);
}

/** Milliseconds *into the round* at which the bot submits. */
export function botSubmitOffsetMs(
  matchId: string,
  round: number,
  league: LeagueName,
  roundMs: number,
): number {
  return Math.min(roundMs - 250, botThinkMs(matchId, round, league));
}

export interface BotFeedbackRow {
  word: string;
  feedback: LetterFeedback[];
}

/** Narrows the vocabulary using the bot's own accumulated feedback. */
export function filterCandidates(rows: BotFeedbackRow[]): string[] {
  const required = new Map<string, number[]>();
  const banned = new Set<string>();
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (let i = 0; i < row.word.length; i += 1) {
      const letter = row.word[i];
      const state = row.feedback[i];
      if (state === "correct") required.set(letter, [...(required.get(letter) ?? []), i]);
      else if (state === "present") counts.set(letter, Math.max(counts.get(letter) ?? 1, 1));
      else if (!required.has(letter)) banned.add(letter);
    }
  }

  return BOT_VOCABULARY.filter((word) => {
    for (const [letter, positions] of required) {
      for (const position of positions) {
        if (word[position] !== letter) return false;
      }
      if (!word.includes(letter)) return false;
    }
    for (const letter of counts.keys()) {
      if (!word.includes(letter)) return false;
    }
    for (const letter of banned) {
      if (!required.has(letter) && word.includes(letter)) return false;
    }
    return true;
  });
}

/**
 * Chooses the bot's guess for a round. Falls back to an unused random word when
 * its feedback filter cannot find a candidate.
 */
export function botGuess(input: {
  matchId: string;
  round: number;
  league: LeagueName;
  history: BotFeedbackRow[];
  used: string[];
}): string {
  const { matchId, round, league, history, used } = input;
  const skill = difficultyForLeague(league).skill;
  const roll = unit(`${matchId}:${round}:skill`);

  const pool = BOT_VOCABULARY.filter((word) => !used.includes(word));
  const available = pool.length > 0 ? pool : BOT_VOCABULARY;

  if (roll <= skill) {
    const candidates = filterCandidates(history).filter((word) => !used.includes(word));
    if (candidates.length > 0) {
      return candidates[hash(`${matchId}:${round}:pick`) % candidates.length];
    }
  }

  // Guessing a word that repeats cleared letters wastes the round.
  if (roll > skill) {
    const fresh = available.filter((word) => !history.some((row) => row.word === word));
    if (fresh.length > 0) {
      return fresh[hash(`${matchId}:${round}:pick`) % fresh.length];
    }
  }

  return available[hash(`${matchId}:${round}:pick`) % available.length];
}

export const BOT_NAMES = ["Byte", "Cortex", "Synapse", "Axon", "Neuron"] as const;

export function botNameFor(matchId: string): string {
  return BOT_NAMES[hash(`${matchId}:bot`) % BOT_NAMES.length];
}
