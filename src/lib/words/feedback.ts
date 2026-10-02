export type LetterFeedback = "correct" | "present" | "absent";

export interface GuessRow {
  word: string;
  feedback: LetterFeedback[];
}

/**
 * Standard Wordle scoring with correct duplicate-letter handling:
 * exact matches are scored first, then remaining letters are marked present
 * only while an unmatched copy of that letter remains in the answer.
 */
export function evaluateGuess(answer: string, guess: string): LetterFeedback[] {
  const target = answer.toLowerCase();
  const attempt = guess.toLowerCase();
  const length = target.length;

  const result: LetterFeedback[] = new Array(length).fill("absent");
  const remaining = new Map<string, number>();

  for (let i = 0; i < length; i += 1) {
    if (attempt[i] === target[i]) {
      result[i] = "correct";
    } else {
      remaining.set(target[i], (remaining.get(target[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < length; i += 1) {
    if (result[i] === "correct") continue;
    const count = remaining.get(attempt[i]) ?? 0;
    if (count > 0) {
      result[i] = "present";
      remaining.set(attempt[i], count - 1);
    }
  }

  return result;
}

/** Collapses a board into the best-known state per letter (for the keyboard). */
export function keyboardState(rows: GuessRow[]): Record<string, LetterFeedback> {
  const rank: Record<LetterFeedback, number> = { absent: 0, present: 1, correct: 2 };
  const state: Record<string, LetterFeedback> = {};

  for (const row of rows) {
    for (let i = 0; i < row.word.length; i += 1) {
      const letter = row.word[i].toLowerCase();
      const feedback = row.feedback[i];
      if (!state[letter] || rank[feedback] > rank[state[letter]]) {
        state[letter] = feedback;
      }
    }
  }

  return state;
}

const EMOJI: Record<LetterFeedback, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬜",
};

/** Spoiler-free share text, e.g. `Wordle Arena #2026-09-15 3/6`. */
export function shareText(title: string, rows: GuessRow[], maxAttempts: number): string {
  const solved = rows.some((row) => row.feedback.every((value) => value === "correct"));
  const score = solved ? `${rows.length}/${maxAttempts}` : `X/${maxAttempts}`;
  const grid = rows.map((row) => row.feedback.map((value) => EMOJI[value]).join("")).join("\n");
  return `${title} ${score}\n\n${grid}`;
}
