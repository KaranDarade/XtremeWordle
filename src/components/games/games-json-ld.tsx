import type { PublicGame } from "@/lib/games/public";

/**
 * Structured data so search engines can understand the games hub.
 * Rendered as a JSON-LD script tag.
 */
export function GamesJsonLd({ games }: { games: PublicGame[] }) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Bubble Wordle",
        url: base,
        description:
          "Daily word games in one place, including Wordle, Spelling Bee and Connections.",
      },
      {
        "@type": "ItemList",
        name: "Word games",
        itemListElement: games.map((game, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: game.name,
          url: `${base}/games/${game.slug}`,
          description: game.tagline ?? game.description ?? undefined,
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe for a script tag here (no user input).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
