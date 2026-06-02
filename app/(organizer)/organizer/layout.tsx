// ─────────────────────────────────────────────────────────────────────────────
// Organizer portal layout.
//
// Mirrors app/(sponsor)/sponsor/layout.tsx: an OrganizerGuard (modelled on the
// sponsor's SponsorGuard) wrapping a header + content shell. On top of the sponsor
// shell this layout adds two organizer-specific pieces:
//   1. A left/top sub-nav (Overview · Profile · Members) — shadcn pill/segment Tabs
//      driven by the active route (NOT underline tabs, per AFC design constants).
//   2. An ORG SWITCHER — fetches getMyOrganizations() once, remembers the chosen
//      org slug in state + localStorage. One org → no switcher chrome, just use it.
//      Many orgs → a shadcn <Select> to switch between them.
//
// The selected slug + that membership's permissions are handed to the child pages
// through a tiny <OrganizerProvider> context (see ./_components/OrganizerContext),
// so pages never re-fetch the membership list or thread a ?org= query param.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { FullLoader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconArrowLeft, IconBuilding, IconLogout } from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { toast } from "sonner";
import { organizersApi } from "@/lib/organizers";
import {
  OrganizerProvider,
  OrgMembership,
} from "./_components/OrganizerContext";

// localStorage key that remembers the last org the user switched to (by slug).
const SELECTED_ORG_KEY = "organizer:selected-slug";

// The portal sub-routes the top sub-nav links to.
// "Events" sits between Overview and Profile — it's the org's events surface
// (list + create), gated per-page on the membership's can_create_events permission.
const NAV_ITEMS = [
  { label: "Overview", href: "/organizer/overview" },
  { label: "Events", href: "/organizer/events" },
  // "Design" — the org's leaderboard-design request surface (submit + history),
  // gated per-page on the membership's can_submit_designs permission (or owner).
  { label: "Design", href: "/organizer/design" },
  { label: "Profile", href: "/organizer/profile" },
  { label: "Members", href: "/organizer/members" },
  // "Metrics" — the org's aggregate stats (events / teams / players / kills / rating),
  // gated per-page on can_view_metrics (or owner).
  { label: "Metrics", href: "/organizer/metrics" },
  // "Reviews" — the org's per-event ratings + ANONYMOUS comments,
  // gated per-page on can_view_reviews (or owner).
  { label: "Reviews", href: "/organizer/reviews" },
];

// ── Guard ────────────────────────────────────────────────────────────────────
// Mirror of the sponsor SponsorGuard, gated on isOrganizer instead of a role
// string: redirect to /login when not authed, /unauthorized when not an organizer.

function OrganizerGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, isOrganizer } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!isOrganizer) {
      router.replace("/unauthorized");
    }
  }, [isAuthenticated, loading, isOrganizer, pathname, router]);

  if (loading) return <FullLoader text="Loading" />;
  if (!isAuthenticated || !isOrganizer)
    return <FullLoader text="Verifying Permissions..." />;

  return <>{children}</>;
}

// ── Portal shell (header + org switcher + sub-nav + content) ──────────────────

function OrganizerShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // The full membership list from getMyOrganizations() (org + role + permissions).
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // ── Load the caller's organizations once, then pick the selected one. ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await organizersApi.getMyOrganizations();
        const results: OrgMembership[] = res?.results ?? [];
        setMemberships(results);

        if (results.length > 0) {
          // Prefer a previously-remembered slug if it's still in the list,
          // otherwise fall back to the first org.
          const remembered =
            typeof window !== "undefined"
              ? localStorage.getItem(SELECTED_ORG_KEY)
              : null;
          const validRemembered = results.find(
            (m) => m.organization.slug === remembered,
          );
          setSelectedSlug(
            validRemembered
              ? validRemembered.organization.slug
              : results[0].organization.slug,
          );
        }
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to load your organizations.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Persist the chosen org so a refresh keeps the user on the same one.
  const onSwitchOrg = (slug: string) => {
    setSelectedSlug(slug);
    if (typeof window !== "undefined")
      localStorage.setItem(SELECTED_ORG_KEY, slug);
  };

  // The active sub-nav value is whichever NAV_ITEM the current path starts with.
  const activeNav =
    NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.href ??
    NAV_ITEMS[0].href;

  // The currently-selected membership (drives the context handed to child pages).
  const selectedMembership = memberships.find(
    (m) => m.organization.slug === selectedSlug,
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header — same shell as the sponsor portal, with logout. */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Back button — leaves the portal for wherever the user came from
                (the admin dashboard for admin-organizers, /home otherwise). */}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => router.back()}
            >
              <IconArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Link href={"/home"} className="flex items-center space-x-2">
              <Logo size="small" />
              <span className="text-base md:text-xl font-bold bg-gradient-to-r from-primary to-[var(--gold)] bg-clip-text text-transparent line-clamp-1 hover:text-primary">
                African Freefire Community
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user.in_game_name}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5"
              onClick={logout}
            >
              <IconLogout className="size-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container py-8">
        {loading ? (
          <FullLoader text="Loading your organizations..." />
        ) : memberships.length === 0 ? (
          // No org membership at all — nothing to show, point the user back home.
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <IconBuilding className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You aren&apos;t a member of any organization yet.
            </p>
            <Button variant="outline" onClick={() => router.push("/home")}>
              Back to home
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Org switcher + sub-nav row. */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Sub-nav: shadcn pill/segment tabs that navigate on click. */}
              <Tabs value={activeNav}>
                <TabsList>
                  {NAV_ITEMS.map((item) => (
                    <TabsTrigger
                      key={item.href}
                      value={item.href}
                      onClick={() => router.push(item.href)}
                    >
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Org switcher: only render chrome when the user has >1 org. */}
              {memberships.length > 1 && (
                <Select value={selectedSlug} onValueChange={onSwitchOrg}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => (
                      <SelectItem
                        key={m.organization.slug}
                        value={m.organization.slug}
                      >
                        {m.organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Hand the selected org + permissions to the child pages via context. */}
            {selectedMembership && (
              <OrganizerProvider
                // Re-mount the subtree on org switch so each page re-fetches its
                // own detail for the newly-selected slug.
                key={selectedMembership.organization.slug}
                value={{
                  slug: selectedMembership.organization.slug,
                  membership: selectedMembership,
                  isOwner: selectedMembership.role === "owner",
                }}
              >
                {children}
              </OrganizerProvider>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function OrganizerPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <OrganizerGuard>
      <OrganizerShell>{children}</OrganizerShell>
    </OrganizerGuard>
  );
}
