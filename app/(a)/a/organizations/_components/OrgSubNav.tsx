"use client";

// Sub-navigation shared by the three Organizations admin index pages:
//   • Organizations  (/a/organizations)         - the org list
//   • Design Requests (/a/organizations/design-requests) - organizer leaderboard-design queue
//   • Org Reports     (/a/organizations/reports) - integrity reports against orgs
// These used to be three separate top-level sidebar entries. They now live UNDER
// Organizations as one segmented bar, so the sidebar stays lean and the org-integrity
// tools sit where they belong (the same team triages all three). The routes are
// unchanged; only the way you reach them moved.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Organizations", href: "/a/organizations" },
  { label: "Design Requests", href: "/a/organizations/design-requests" },
  { label: "Org Reports", href: "/a/organizations/reports" },
] as const;

export function OrgSubNav() {
  const pathname = usePathname();

  return (
    // shadcn pill/segment styling (bg-muted track, active tab gets a bg-background fill)
    // to match the AFC tab idiom used elsewhere on the site.
    <div className="inline-flex h-9 w-fit items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground">
      {TABS.map((t) => {
        // "Organizations" is active only on the exact list route, so it does not also
        // light up on the design-requests / reports sub-routes. The sub-routes match by
        // prefix so any deeper path still highlights the right tab.
        const active =
          t.href === "/a/organizations"
            ? pathname === "/a/organizations"
            : pathname.startsWith(t.href);

        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex h-7 items-center rounded-sm px-3 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
