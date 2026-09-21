import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type Tone = "honey" | "copper" | "moss";

interface FieldBubble {
  left: string;
  top: string;
  size: number;
  tone: Tone;
  delay: number;
  duration: number;
  alpha: number;
}

/**
 * Decorative bubbles drifting and popping around the page edges.
 *
 * Positioned near the viewport edges so they fill the empty space beside the
 * centred content and never sit behind body copy. Pure CSS `transform`/`opacity`
 * animation on a handful of elements, so it stays cheap; entirely hidden from
 * assistive tech and pointer events, and paused under `prefers-reduced-motion`.
 */
const BUBBLES: FieldBubble[] = [
  { left: "3.5%", top: "12%", size: 150, tone: "honey", delay: 0, duration: 14, alpha: 0.92 },
  { left: "8%", top: "58%", size: 104, tone: "copper", delay: 4.5, duration: 16, alpha: 0.8 },
  { left: "16%", top: "88%", size: 168, tone: "moss", delay: 9, duration: 18, alpha: 0.66 },
  { left: "88%", top: "9%", size: 128, tone: "copper", delay: 2, duration: 15, alpha: 0.85 },
  { left: "90%", top: "52%", size: 196, tone: "honey", delay: 6, duration: 17, alpha: 0.72 },
  { left: "84%", top: "86%", size: 118, tone: "moss", delay: 11, duration: 19, alpha: 0.7 },
];

export function BubbleField({ className }: { className?: string }) {
  return (
    <div className={cn("bubble-field", className)} aria-hidden="true">
      {BUBBLES.map((bubble, index) => (
        <span
          key={index}
          className={cn("bubble-field-item", `bubble-tone-${bubble.tone}`)}
          style={
            {
              left: bubble.left,
              top: bubble.top,
              "--size": `${bubble.size}px`,
              "--bubble-alpha": bubble.alpha,
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${bubble.duration}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
