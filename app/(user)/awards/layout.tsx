import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

// WHY THIS FILE EXISTS: both awards pages are Client Components, and a "use client" page cannot
// export metadata. Without a section layout they would inherit app/(user)/layout.tsx, whose title
// is the literal string "Teams | African Free Fire Community", so every awards URL would announce
// itself as Teams in the browser tab, in a bookmark and in a shared link. Same pattern as the
// sibling sections (polls, news, rankings).
//
// The title is the SECTION, not a year. It used to read "NFCA 2025 Awards", from the days when this
// route was a hand-typed list of that one season's winners; the page now renders whichever season
// is leading, and a per-year page lives at /awards/<edition>, so a title naming 2025 would be wrong
// on both of them the moment a new season opens.
export const metadata: Metadata = generatePageMetadata({
  title: "Awards",
  description:
    "The African Free Fire Community awards: see who is nominated, vote in the categories you are "
    + "eligible for, and browse every winner in the hall of fame.",
  keywords: [
    "AFC awards",
    "NFCA",
    "Free Fire awards",
    "African gaming awards",
    "Free Fire content creator awards",
    "esports awards Africa",
    "vote Free Fire",
  ],
  url: "/awards",
});

export default function AwardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
