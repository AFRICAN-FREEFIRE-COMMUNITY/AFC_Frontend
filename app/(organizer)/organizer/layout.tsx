// ─────────────────────────────────────────────────────────────────────────────
// Organizer portal layout.
//
// Mirrors app/(sponsor)/sponsor/layout.tsx: an OrganizerGuard (modelled on the
// sponsor's SponsorGuard) wrapping a header + content shell. On top of the sponsor
// shell this layout adds two organizer-specific pieces:
//   1. A left sub-nav (Overview · Events · Design · Profile · Members · Metrics ·
//      Reviews) - now a shadcn collapsible <Sidebar>, the SAME pattern as the admin
//      dashboard (app/(a)/a/layout.tsx → AppSidebar + SiteHeader's <SidebarTrigger />).
//      This keeps a PERSISTENT top-left hamburger ("Toggle Sidebar") that never
//      disappears, instead of the old horizontal Tabs that overflowed/vanished on
//      narrow screens. Active link styling mirrors NavMain (bg-primary fill).
//   2. An ORG SWITCHER - fetches getMyOrganizations() once, remembers the chosen
//      org slug in state + localStorage. One org → no switcher chrome, just use it.
//      Many orgs → a shadcn <Select> to switch between them.
//
// The selected slug + that membership's permissions are handed to the child pages
// through a tiny <OrganizerProvider> context (see ./_components/OrganizerContext),
// so pages never re-fetch the membership list or thread a ?org= query param.
//
// Sidebar plumbing (SidebarProvider / Sidebar / SidebarTrigger / SidebarInset) is
// the exact same shadcn stack the admin layout uses - see components/ui/sidebar.tsx
// and components/site-header.tsx for the reference implementation we copy here.
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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  IconArrowLeft,
  IconBuilding,
  IconLogout,
  IconHome,
  IconLayoutDashboard,
} from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { organizersApi } from "@/lib/organizers";
import {
  OrganizerProvider,
  OrgMembership,
} from "./_components/OrganizerContext";

// localStorage key that remembers the last org the user switched to (by slug).
const SELECTED_ORG_KEY = "organizer:selected-slug";

// The portal sub-routes the top sub-nav links to.
// "Events" sits between Overview and Profile - it's the org's events surface
// (list + create), gated per-page on the membership's can_create_events permission.
const NAV_ITEMS = [
  { label: "Overview", href: "/organizer/overview" },
  { label: "Events", href: "/organizer/events" },
  // "Drafts" - the org's UNPUBLISHED (is_draft=True) events, saved from the
  // create/edit wizard but not yet live. Sits right under Events (it's an Events
  // sub-surface). Gated PER-PAGE on can_create_events / can_edit_events (or owner) -
  // the same set the backend get-drafted-events endpoint requires. See
  // app/(organizer)/organizer/events/drafts/page.tsx.
  { label: "Drafts", href: "/organizer/events/drafts" },
  // "Leaderboards" - the org's results-upload + leaderboard-management surface
  // (list the org's events, then manage each event's leaderboard: create/generate,
  // upload results manually or via OCR image upload, configure points, view/edit).
  // Sits between Events and Design. Gated PER-PAGE on the membership's
  // can_upload_results permission (or owner) - same pattern Events/Design use
  // (the nav item always shows; the page itself shows a lock notice when the
  // caller lacks the permission). See app/(organizer)/organizer/leaderboards/page.tsx.
  { label: "Leaderboards", href: "/organizer/leaderboards" },
  // "Design" - the org's leaderboard-design request surface (submit + history),
  // gated per-page on the membership's can_submit_designs permission (or owner).
  { label: "Design", href: "/organizer/design" },
  { label: "Profile", href: "/organizer/profile" },
  { label: "Members", href: "/organizer/members" },
  // "Metrics" - the org's aggregate stats (events / teams / players / kills / rating),
  // gated per-page on can_view_metrics (or owner).
  { label: "Metrics", href: "/organizer/metrics" },
  // "Reviews" - the org's per-event ratings + ANONYMOUS comments,
  // gated per-page on can_view_reviews (or owner).
  { label: "Reviews", href: "/organizer/reviews" },
  // "Blacklists" - block a team (and the players snapshotted on it) from registering
  // for this org's events, plus the queue of lift requests the affected party raises.
  // Gated PER-PAGE on can_manage_registrations (or owner) - the SAME permission the
  // backend blacklist endpoints require. See app/(organizer)/organizer/blacklists/page.tsx.
  { label: "Blacklists", href: "/organizer/blacklists" },
];

// ── Sidebar ──────────────────────────────────────────────────────────────────
// The organizer sub-nav as a shadcn collapsible Sidebar, mirroring the admin's
// AppSidebar (components/app-sidebar.tsx) + NavMain (components/nav-main.tsx).
// Same active-link idiom as NavMain: the current route gets the primary fill.
// collapsible="offcanvas" matches AppSidebar so the SidebarTrigger hamburger in
// the header toggles it open/closed on every screen size.

function OrganizerSidebar() {
  const pathname = usePathname();
  // Close the mobile drawer after navigating, same as NavMain.handleLinkClick.
  const { setOpenMobile } = useSidebar();
  // isAdmin drives the "Admin Dashboard" exit link: a platform admin who is also an
  // organizer can jump straight back to the admin area from this menu; everyone else
  // gets the "User Dashboard" link back to the main site. This is what the hamburger
  // menu is for here (navigating OUT of the org portal), per the user's request.
  const { isAdmin } = useAuth();

  // Links that LEAVE the organizer portal (rendered as a separate menu group below
  // the org sub-nav). Admin Dashboard only shows for platform admins.
  const exitItems = [
    { label: "User Dashboard", href: "/home", icon: IconHome },
    ...(isAdmin
      ? [
          {
            label: "Admin Dashboard",
            href: "/a/dashboard",
            icon: IconLayoutDashboard,
          },
        ]
      : []),
  ];

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center justify-start gap-2">
          <Logo size="small" />
          <span className="font-medium text-sm text-muted-foreground">
            Organizer Portal
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                // Active = current path is, or sits under, this nav href - but the
                // MOST-SPECIFIC nav href wins. "Drafts" (/organizer/events/drafts)
                // sits under "Events" (/organizer/events), so without this only the
                // longest matching prefix highlights (otherwise both would). We pick
                // the longest NAV_ITEMS href that prefixes the current path.
                const matches = (href: string) =>
                  pathname === href || pathname.startsWith(`${href}/`);
                const bestMatch = NAV_ITEMS.filter((i) => matches(i.href)).sort(
                  (a, b) => b.href.length - a.href.length,
                )[0];
                const isActive = bestMatch?.href === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      asChild
                      className={cn(
                        isActive &&
                          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                      )}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                      >
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Leave the portal ── navigation OUT of the organizer area. */}
        <SidebarGroup className="mt-auto">
          <Separator className="mb-2" />
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {exitItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton tooltip={item.label} asChild>
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// ── Guard ────────────────────────────────────────────────────────────────────
// Mirror of the sponsor SponsorGuard, gated on isOrganizer instead of a role
// string: redirect to /login when not authed, /unauthorized when not an organizer.
//
// STALE-ROLE RECHECK: the 'organizer' role is granted the moment an owner/admin adds
// someone as a sub-organizer (add_organization_member / admin_manage_organization_member
// both UserRoles.get_or_create synchronously), but THIS browser only loaded its roles
// once, at page load. Without a recheck the freshly-added member bounces to
// /unauthorized until they hard-refresh or re-log ("access takes time"). So when the
// cached roles say "not an organizer", we refreshUser() exactly ONCE and only redirect
// if the FRESH roles still lack 'organizer'.

function OrganizerGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, isOrganizer, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // One-shot recheck state machine: idle → checking (profile refetch in flight)
  // → done (refetch resolved; cached verdict is now fresh and final).
  const [recheck, setRecheck] = useState<"idle" | "checking" | "done">("idle");

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!isOrganizer) {
      if (recheck === "idle") {
        // Roles might be stale (just granted) - refetch once before judging.
        setRecheck("checking");
        refreshUser().finally(() => setRecheck("done"));
        return;
      }
      if (recheck === "done") {
        // Fresh roles still lack 'organizer' - genuinely unauthorized.
        router.replace("/unauthorized");
      }
      // recheck === "checking": wait for the refetch; the effect re-runs when it
      // lands (isOrganizer flips or recheck becomes "done").
    }
  }, [isAuthenticated, loading, isOrganizer, recheck, refreshUser, pathname, router]);

  if (loading) return <FullLoader text="Loading" />;
  if (!isAuthenticated || !isOrganizer)
    return <FullLoader text="Verifying Permissions..." />;

  return <>{children}</>;
}

// ── Portal shell (header + org switcher + sub-nav + content) ──────────────────

function OrganizerShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

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

  // The currently-selected membership (drives the context handed to child pages).
  const selectedMembership = memberships.find(
    (m) => m.organization.slug === selectedSlug,
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  // Same shadcn shell as the admin dashboard: SidebarProvider wraps a collapsible
  // <Sidebar> (the sub-nav) + a <SidebarInset> for the header/content. The header's
  // <SidebarTrigger /> is the SAME persistent top-left hamburger the admin uses
  // (components/site-header.tsx), so it stays visible on every screen size.

  return (
    <SidebarProvider>
      {/* Left nav as a collapsible sidebar (mirrors admin AppSidebar). */}
      <OrganizerSidebar />

      <SidebarInset>
        {/* Header - same shell as the sponsor portal, with logout, now fronted
            by the SidebarTrigger hamburger that toggles OrganizerSidebar. */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/50 backdrop-blur-sm">
          <div className="container mx-auto h-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Persistent hamburger - mirrors the admin's "Toggle Sidebar"
                  button (components/site-header.tsx). Always visible. */}
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-4"
              />
              {/* Back button - leaves the portal for wherever the user came from
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
            // No org membership at all - nothing to show, point the user back home.
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
              {/* Org switcher row (the sub-nav now lives in the sidebar). */}
              {memberships.length > 1 && (
                <div className="flex justify-end">
                  {/* Org switcher: only render chrome when the user has >1 org. */}
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
                </div>
              )}

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
      </SidebarInset>
    </SidebarProvider>
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
