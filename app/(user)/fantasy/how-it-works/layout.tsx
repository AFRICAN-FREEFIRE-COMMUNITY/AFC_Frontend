import { Metadata } from "next";

import { generatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: the guide is a Client Component, and a "use client" page cannot export
// metadata. Without its own layout it would inherit the parent's title and announce itself as the
// league listing in a browser tab, a bookmark, and anywhere it is shared. This page is the one
// most likely to be shared into Discord, so its own title and description matter more here than
// on most pages.
export const metadata: Metadata = generatePageMetadata({
  title: "How the AFC Fantasy League works",
  description:
    "The AFC Free Fire Fantasy League explained in plain words: how to pick a squad, exactly how "
    + "points are worked out with worked examples, what players cost and why, when picks close, "
    + "and what happens when a result is corrected.",
  keywords: [
    "AFC fantasy league rules",
    "Free Fire fantasy scoring",
    "fantasy league points explained",
    "AFC SEEDS",
  ],
  url: "/fantasy/how-it-works",
});

export default function FantasyGuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
