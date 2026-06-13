"use client";

// Sub-navigation shared by the Organizations admin index pages:
//   • Organizations  (/a/organizations)         - the org list
//   • Org Reports     (/a/organizations/reports) - integrity reports against orgs
// These live UNDER Organizations as one segmented bar, so the sidebar stays lean and the
// org-integrity tools sit where they belong (the same team triages them). (The "Design Requests"
// tab was removed 2026-06-13 with the request-a-design feature; organizers now self-serve designs
// on their Design page.)

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Organizations", href: "/a/organizations" },
  { label: "Org Reports", href: "/a/organizations/reports" },
] as const;

export function OrgSubNav() {
  const pathname = usePathname();

  return (
    // shadcn pill/segment styling (bg-muted track, active tab gets a bg-background fill)
    // to match the AFC tab idiom used elsewhere on the site.
    // data-tour="org-subnav": stable wrapper anchored by the admin tour (orgs-misc area)
    // so the org-list / org-reports sub-nav step can highlight it.
    <div
      data-tour="org-subnav"
      className="inline-flex h-9 w-fit items-center gap-1 rounded-md bg-muted p-1 text-muted-foreground"
    >
      {TABS.map((t) => {
        // "Organizations" is active only on the exact list route, so it does not also
        // light up on the reports sub-route. The sub-route matches by prefix so any
        // deeper path still highlights the right tab.
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
