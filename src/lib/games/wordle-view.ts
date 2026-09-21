import type { GuessRow } from "@/lib/words/feedback";

export type WordleMode = "DAILY" | "UNLIMITED";

/** Shape sent to the browser. The answer is only revealed once the game ends. */
export interface WordleView {
  resultId: string;
  mode: WordleMode;
  bucketKey: string;
  wordLength: number;
  maxAttempts: number;
  board: GuessRow[];
  solved: boolean;
  completed: boolean;
  answer: string | null;
  title: string;
}
