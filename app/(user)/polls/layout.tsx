import { Metadata } from "next";

import { generatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: both polls pages are Client Components, and a "use client" page cannot
// export metadata. Without a section layout they inherited app/(user)/layout.tsx, whose title is
// the literal string "Teams | African Free Fire Community", so every poll page announced itself
// as Teams in the browser tab, in a bookmark and in a shared link. Same pattern as the sibling
// sections (awards, news, rankings): one server layout carrying the section's metadata.
export const metadata: Metadata = generatePageMetadata({
  title: "Polls",
  description:
    "Vote in AFC community polls and award ballots. See what the African Free Fire community "
    + "thinks, and check the results once voting closes.",
  keywords: [
    "AFC polls",
    "Free Fire community poll",
    "African Free Fire vote",
    "award ballot",
    "esports poll Africa",
  ],
  url: "/polls",
});

export default function PollsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
