import { cn } from "@/lib/utils";

/**
 * Wordle Arena mark: a two-lobe brain with firing synapses.
 *
 * Inline SVG + CSS `transform`/`opacity` keyframes only — no images, no JS, no
 * filters — so it stays a fraction of a kilobyte and costs nothing at runtime.
 * Fully paused under `prefers-reduced-motion`.
 */
export function BrainLogo({ className }: { className?: string }) {
  return (
    <span className={cn("brain-mark", className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false" role="presentation">
        <g className="brain-breathe">
          <path
            className="brain-lobe brain-lobe-left"
            d="M15.2 6.1c-1.6-1.5-4.2-1.7-5.9-.3-2.3-.2-4.4 1.4-4.9 3.6-1.5 1.1-2.1 3.2-1.3 5.1-.7 1.8 0 3.9 1.6 5.1 0 2.3 1.7 4.3 4 4.8 1 1.6 2.9 2.4 4.7 1.9 1.1.4 1.8.2 1.8-.4Z"
          />
          <path
            className="brain-lobe brain-lobe-right"
            d="M16.8 6.1c1.6-1.5 4.2-1.7 5.9-.3 2.3-.2 4.4 1.4 4.9 3.6 1.5 1.1 2.1 3.2 1.3 5.1.7 1.8 0 3.9-1.6 5.1 0 2.3-1.7 4.3-4 4.8-1 1.6-2.9 2.4-4.7 1.9-1.1.4-1.8.2-1.8-.4Z"
          />

          <path className="brain-fold" d="M8.2 12.6c2.3-1 3.7.5 3.2 2.7" />
          <path className="brain-fold" d="M8.8 17.8c2.3-1 3.6.6 3.1 2.7" />
          <path className="brain-fold" d="M10.4 22.6c1.8-.9 2.9 0 3 1.2" />
          <path className="brain-fold" d="M23.8 12.6c-2.3-1-3.7.5-3.2 2.7" />
          <path className="brain-fold" d="M23.2 17.8c-2.3-1-3.6.6-3.1 2.7" />
          <path className="brain-fold" d="M21.6 22.6c-1.8-.9-2.9 0-3 1.2" />
        </g>

        {/* Firing synapses: a pulse on the node, a spark travelling the gap. */}
        <circle className="brain-node brain-node-1" cx="10.2" cy="12.4" r="1.4" />
        <circle className="brain-node brain-node-2" cx="11.8" cy="18.2" r="1.3" />
        <circle className="brain-node brain-node-3" cx="21.8" cy="12.4" r="1.4" />
        <circle className="brain-node brain-node-4" cx="20.2" cy="18.2" r="1.3" />
        <circle className="brain-node brain-node-5" cx="16" cy="23.4" r="1.2" />

        <circle className="brain-spark brain-spark-1" cx="10.2" cy="12.4" r="0.95" />
        <circle className="brain-spark brain-spark-2" cx="21.8" cy="12.4" r="0.95" />
        <circle className="brain-spark brain-spark-3" cx="16" cy="22.4" r="0.9" />
      </svg>
    </span>
  );
}
