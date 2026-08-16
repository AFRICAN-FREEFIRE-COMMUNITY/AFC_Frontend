import { Metadata } from "next";

import { generatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the fantasy page is a Client Component, and a "use client" page cannot
// export metadata. Without a section layout it would inherit app/(user)/layout.tsx, whose title is
// the literal string "Teams | African Free Fire Community", so the page would announce itself as
// Teams in the browser tab, in a bookmark and in anything it is shared into. Same pattern as the
// sibling sections (awards, polls, news).
export const metadata: Metadata = generatePageMetadata({
  title: "Fantasy League",
  description:
    "The AFC Free Fire Fantasy League: pick a squad from the players in a real AFC event, score "
    + "points from what they actually do in their matches, and see where you finish.",
  keywords: [
    "Free Fire fantasy league",
    "AFC fantasy",
    "fantasy esports Africa",
    "Free Fire fantasy squad",
  ],
  url: "/fantasy",
});

export default function FantasyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
