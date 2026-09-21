import { cn } from "@/lib/utils";

/**
 * Bubble Wordle mark: bubbles drift upward and one pops on a loop.
 *
 * Deliberately cheap — inline SVG plus CSS `transform`/`opacity` keyframes only
 * (no images, no JS, no layout work), so it costs nothing at runtime and is
 * disabled entirely under `prefers-reduced-motion`.
 */
export function BubbleLogo({ className }: { className?: string }) {
  return (
    <span className={cn("bubble-mark", className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false" role="presentation">
        <g className="bubble-float bubble-float-a">
          <g className="bubble-pop bubble-pop-a">
            <circle className="bubble-fill-a" cx="12" cy="15" r="7" />
            <ellipse className="bubble-shine" cx="9.6" cy="12.2" rx="2.2" ry="1.6" />
          </g>
        </g>
        <circle className="bubble-ring bubble-ring-a" cx="12" cy="15" r="7" />

        <g className="bubble-float bubble-float-b">
          <g className="bubble-pop bubble-pop-b">
            <circle className="bubble-fill-b" cx="23" cy="21.5" r="4.6" />
            <ellipse className="bubble-shine" cx="21.6" cy="19.9" rx="1.3" ry="0.95" />
          </g>
        </g>
        <circle className="bubble-ring bubble-ring-b" cx="23" cy="21.5" r="4.6" />
      </svg>
    </span>
  );
}
