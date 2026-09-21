import { Grid2x2, Grid3x3, Hexagon, Puzzle, type LucideIcon } from "lucide-react";

export interface GameAccent {
  icon: LucideIcon;
  gradient: string;
  ring: string;
}

/** Warm wood-tone accents: honey, oak, copper and mahogany. */
const ACCENTS: Record<string, GameAccent> = {
  wordle: {
    icon: Grid3x3,
    gradient: "from-amber-600/35 via-orange-800/22 to-transparent",
    ring: "group-hover:border-amber-500/50",
  },
  "spelling-bee": {
    icon: Hexagon,
    gradient: "from-yellow-500/32 via-amber-700/20 to-transparent",
    ring: "group-hover:border-yellow-500/50",
  },
  connections: {
    icon: Grid2x2,
    gradient: "from-orange-700/32 via-red-900/20 to-transparent",
    ring: "group-hover:border-orange-600/50",
  },
};

const FALLBACK: GameAccent = {
  icon: Puzzle,
  gradient: "from-stone-500/30 via-amber-800/20 to-transparent",
  ring: "group-hover:border-stone-400/50",
};

export function getGameAccent(slug: string): GameAccent {
  return ACCENTS[slug] ?? FALLBACK;
}
