import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type Tone = "honey" | "copper" | "moss";

interface Neuron {
  left: string;
  top: string;
  size: number;
  tone: Tone;
  delay: number;
  duration: number;
  alpha: number;
}

/**
 * Decorative neural field: glowing neurons drifting and firing around the page
 * edges, filling the space beside the centred content without sitting behind
 * body copy.
 *
 * Pure CSS `transform`/`opacity` on a handful of elements, hidden from assistive
 * tech and pointer events, and removed entirely under `prefers-reduced-motion`.
 */
const NEURONS: Neuron[] = [
  { left: "4%", top: "13%", size: 14, tone: "honey", delay: 0, duration: 12, alpha: 0.95 },
  { left: "9%", top: "48%", size: 9, tone: "copper", delay: 3.5, duration: 14, alpha: 0.85 },
  { left: "6%", top: "80%", size: 11, tone: "moss", delay: 7, duration: 16, alpha: 0.75 },
  { left: "89%", top: "9%", size: 12, tone: "copper", delay: 2, duration: 13, alpha: 0.9 },
  { left: "92%", top: "44%", size: 15, tone: "honey", delay: 5.5, duration: 15, alpha: 0.8 },
  { left: "87%", top: "78%", size: 10, tone: "moss", delay: 9, duration: 17, alpha: 0.8 },
];

export function NeuralField({ className }: { className?: string }) {
  return (
    <div className={cn("neural-field", className)} aria-hidden="true">
      {NEURONS.map((neuron, index) => (
        <span
          key={index}
          className={cn("neuron", `neuron-tone-${neuron.tone}`)}
          style={
            {
              left: neuron.left,
              top: neuron.top,
              "--size": `${neuron.size}px`,
              "--neuron-alpha": neuron.alpha,
              animationDelay: `${neuron.delay}s`,
              animationDuration: `${neuron.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
