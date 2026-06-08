"use client";
import { FullLoader, Loader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, ArrowLeft, BadgeCheck } from "lucide-react";
import Image from "next/image";
import { DEFAULT_IMAGE, ITEMS_PER_PAGE } from "@/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { organizersApi } from "@/lib/organizers";
import { toast } from "sonner";

// --- Types ---
interface Event {
  event_id: number;
  event_name: string;
  event_date: string;
  event_status: "upcoming" | "ongoing" | "completed";
  competition_type: "tournament" | "scrims";
  event_banner: string;
  slug: string;
  prizepool: string;
  number_of_participants: number;
  total_registered_competitors: number;
  // ── organizer attribution (from get-all-events) ──
  // Events run by an external organization carry their identity; events with no
  // organization are AFC-official (these fields come back null/empty).
  organization_id?: number | null;
  organization_name?: string | null;
  organization_slug?: string | null;
  // ── Paid registration (Phase 1, Stripe) ──
  // Present when the list endpoint includes the paid-event fields. "paid" + a positive
  // registration_fee shows the "Paid: <currency> <fee>" badge on the card. Optional so the
  // card renders fine if get-all-events doesn't return them (it just omits the badge).
  registration_type?: "free" | "paid";
  registration_fee?: number | null;
  registration_fee_currency?: string;
}

type StatusFilter = "all" | "upcoming" | "ongoing" | "completed";
type DateSort = "newest" | "oldest";
type MonthFilter = "all" | string; // "YYYY-MM"
// "all" = every organizer, "afc" = AFC-official (no organization_name),
// otherwise the literal organization_name value to match.
type OrganizerFilter = "all" | "afc" | string;

// ── Organizer directory types ──
// Shape returned by organizersApi.getOrganizationsDirectory() (backend
// GET /organizers/get-organizations-public/). Every field is REAL data the backend
// derives from the org + its published events - logo/name/description off the
// Organization row; event_count / verified / tier derived from its events. The
// AFC-official pseudo-organizer (org-less events) is synthesized client-side and
// reuses this same shape with slug=null (no public org page to drill into).
interface OrganizerDirectoryItem {
  slug: string | null; // null only for the synthetic "AFC Official" card
  name: string;
  logo: string | null;
  default_banner: string | null; // org cover image, shown atop each directory card
  description: string | null;
  event_count: number;
  verified: boolean;
  tier: string | null; // "Tier 1" | "Tier 2" | "Tier 3" | null
}

// How the directory grid is sorted (mirrors the approved mockup's sort select).
type OrgSort = "events" | "name";
// Verified/official filter for the directory grid (mirrors the mockup's filter select).
type OrgVerFilter = "all" | "verified" | "afc";

// --- Event Card ---
const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const formattedDate = formatDate(event.event_date);

  const statusColors: Record<string, string> = {
    upcoming: "text-blue-500",
    ongoing: "text-green-500",
    completed: "text-muted-foreground",
  };

  // Paid-event badge: only when the list endpoint flags this event "paid" with a
  // positive fee. Formats "<currency> <fee>"; the detail page (EventDetailsWrapper)
  // shows the same badge + drives the actual Stripe checkout.
  const isPaid =
    event.registration_type === "paid" &&
    typeof event.registration_fee === "number" &&
    event.registration_fee > 0;
  const paidFeeLabel = isPaid
    ? `${event.registration_fee_currency || "USD"} ${Number(
        event.registration_fee,
      ).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "";

  return (
    <Card
      className="overflow-hidden h-full bg-transparent gap-0 p-0"
      key={event.event_id}
    >
      <Link href={`/tournaments/${event.slug}`}>
        <Image
          src={event.event_banner || DEFAULT_IMAGE}
          alt={event.event_name}
          width={1000}
          height={1000}
          className="object-cover size-full aspect-video"
        />
      </Link>

      <CardContent className="py-4 space-y-2">
        <CardTitle className="hover:text-primary hover:underline">
          <Link href={`/tournaments/${event.slug}`}>{event.event_name}</Link>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Date: {formattedDate}</p>
        <p
          className={`text-sm font-medium ${statusColors[event.event_status] ?? "text-muted-foreground"}`}
        >
          {event.event_status.charAt(0).toUpperCase() +
            event.event_status.slice(1)}
        </p>

        {/* ── Organizer badge ──
            Only shown when the event is run by an external organization. Outline
            Badge in the AFC tier-badge idiom; links to that org's public page
            when a slug is present (asChild keeps the badge styling on the <Link>). */}
        {(event.organization_name || isPaid) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {event.organization_name &&
              (event.organization_slug ? (
                <Badge variant="outline" asChild>
                  <Link href={`/organizations/${event.organization_slug}`}>
                    {event.organization_name}
                  </Link>
                </Badge>
              ) : (
                <Badge variant="outline">{event.organization_name}</Badge>
              ))}
            {/* Paid-event badge in the AFC tier-badge idiom (rounded-full, green accent). */}
            {isPaid && (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0.5 text-xs border-primary/50 text-primary"
              >
                Paid: {paidFeeLabel}
              </Badge>
            )}
          </div>
        )}

        <Button className="w-full" variant={"outline"} asChild>
          <Link href={`/tournaments/${event.slug}`}>View Details</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

// --- Paginated Event List ---
const EventList: React.FC<{ events: Event[]; searchQuery: string }> = ({
  events,
  searchQuery,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, events]);

  const filtered = useMemo(() => {
    if (!searchQuery) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.event_name.toLowerCase().includes(query) ||
        e.event_date.includes(query) ||
        e.event_status.toLowerCase().includes(query),
    );
  }, [events, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <>
      <div className="grid grid-cols-1 mt-4 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {paginated.length > 0 ? (
          paginated.map((event) => (
            <EventCard key={event.event_id} event={event} />
          ))
        ) : (
          <p className="text-center text-muted-foreground col-span-full py-8">
            {searchQuery
              ? `No events match "${searchQuery}"`
              : "No events available."}
          </p>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="hidden md:block text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of{" "}
            {filtered.length}
          </p>
          <Pagination className="w-full md:w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1,
                )
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        isActive={currentPage === page}
                        onClick={() => setCurrentPage(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  </React.Fragment>
                ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Organizer directory tab
// ─────────────────────────────────────────────────────────────────────────────
// The new third tab on this page. Two states share one component:
//   A) DIRECTORY  - a grid of organizer cards (logo, name, verified tick, event
//                   count, tier badge, blurb). Built from the public directory
//                   endpoint PLUS a synthetic "AFC Official" card aggregating every
//                   org-less event already in `events`.
//   B) DETAIL     - click a card to drill into one organizer: a header (logo +
//                   verified + stats) and that org's OWN Tournaments / Scrims
//                   sub-tabs, reusing the same EventCard idiom as the rest of the
//                   page. The detail event lists come straight from the `events`
//                   prop (already fetched by the parent) filtered by organization,
//                   so no extra round-trip is needed to drill in.
//
// Data sources (all REAL):
//   - directory cards   → organizersApi.getOrganizationsDirectory()
//   - AFC Official card → derived from events with no organization_name
//   - detail event grid → `events` filtered by organization_slug (or org-less for AFC)
//   - "View full page"  → links to the existing /organizations/<slug> route
//                          (hidden for the AFC card, which has no org page).
//
// The status filter (statusFilter) is threaded in so the directory + detail event
// counts stay in sync with the status buttons at the top of the page, matching how
// the Tournaments / Scrims tabs already react to that filter.

// Card for one organizer in the directory grid.
const OrganizerCard: React.FC<{
  org: OrganizerDirectoryItem;
  onOpen: (org: OrganizerDirectoryItem) => void;
}> = ({ org, onOpen }) => {
  // Tier badge colour follows the AFC tier-badge idiom: outline rounded-full, with
  // a tier-specific accent (1 = gold/best, 2 = green, 3 = blue).
  const tierClass =
    org.tier === "Tier 1"
      ? "border-gold/55 text-gold"
      : org.tier === "Tier 2"
        ? "border-primary/50 text-primary"
        : "border-blue-500/50 text-blue-500";

  return (
    <Card
      className="bg-card rounded-md border p-0 gap-0 shadow-sm h-full cursor-pointer overflow-hidden transition-colors hover:border-primary/45"
      onClick={() => onOpen(org)}
    >
      {/* ── Banner header: the organizer's cover image so users can SEE the org's
          branding at a glance. Falls back to the AFC primary/gold gradient when the
          org hasn't uploaded one. (default_banner comes from get-organizations-public.) */}
      <div className="relative h-24 w-full bg-gradient-to-br from-primary/20 to-gold/20">
        {org.default_banner && (
          <Image
            src={org.default_banner}
            alt={`${org.name} banner`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        )}
      </div>

      <CardContent className="flex flex-col gap-3 h-full p-6 pt-0">
        {/* Logo + name + verified tick. The logo overlaps the banner (-mt-8). */}
        <div className="flex items-center gap-3 -mt-8">
          <Avatar className="h-14 w-14 rounded-md border-4 border-card bg-card">
            <AvatarImage
              src={org.logo || undefined}
              alt={org.name}
              className="object-cover"
            />
            <AvatarFallback className="rounded-md">
              {org.name?.[0] ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 mt-8">
            <div className="flex items-center gap-1.5">
              <span className="font-bold truncate">{org.name}</span>
              {/* Verified tick: shown only when AFC has verified at least one of
                  this org's event results (real rankings_verified signal). */}
              {org.verified && (
                <BadgeCheck
                  className="h-4 w-4 text-gold shrink-0"
                  aria-label="Verified organizer"
                />
              )}
            </div>
          </div>
        </div>

        {/* Blurb (org description). min-h keeps card heights even across the grid. */}
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
          {org.description || "No description provided yet."}
        </p>

        {/* Footer badges: event count, tier, verified/official status. All outline
            rounded-full per the AFC badge idiom. */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="rounded-full px-2 py-0.5 text-xs border-primary/50 text-primary"
          >
            {org.event_count} events
          </Badge>
          {org.tier && (
            <Badge
              variant="outline"
              className={`rounded-full px-2 py-0.5 text-xs ${tierClass}`}
            >
              {org.tier}
            </Badge>
          )}
          {org.slug === null ? (
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 text-xs border-gold/55 text-gold"
            >
              AFC Official
            </Badge>
          ) : org.verified ? (
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 text-xs border-gold/55 text-gold"
            >
              Verified
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 text-xs border-orange-500/55 text-orange-500"
            >
              Unverified
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// One stat tile in the organizer detail header.
const OrgStat: React.FC<{ value: React.ReactNode; label: string; tone?: string }> =
  ({ value, label, tone }) => (
    <div className="bg-background border rounded-md px-4 py-2.5 text-center min-w-[88px]">
      <div className={`text-xl font-bold ${tone ?? ""}`}>{value}</div>
      <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );

const OrganizerDirectory: React.FC<{
  // All published events the parent already fetched. Used to build the AFC Official
  // card and to power the per-organizer detail event grids (no extra fetch).
  events: Event[];
  // Status filter from the top of the page, threaded so detail counts match it.
  statusFilter: StatusFilter;
}> = ({ events, statusFilter }) => {
  // Directory cards from the public endpoint (real org branding + derived stats).
  const [orgs, setOrgs] = useState<OrganizerDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // The drilled-into organizer (null = directory grid shown). Holds the full item
  // so the detail header can render without a second lookup.
  const [activeOrg, setActiveOrg] = useState<OrganizerDirectoryItem | null>(null);
  // Detail view's own Tournaments / Scrims sub-tab.
  const [detailSubTab, setDetailSubTab] = useState<"tournaments" | "scrims">(
    "tournaments",
  );

  // Directory grid controls (mirror the approved mockup).
  const [orgSearch, setOrgSearch] = useState("");
  const [orgVerFilter, setOrgVerFilter] = useState<OrgVerFilter>("all");
  const [orgSort, setOrgSort] = useState<OrgSort>("events");

  // ── load the directory once ──
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await organizersApi.getOrganizationsDirectory();
        if (active) setOrgs(data.organizations || []);
      } catch (err: any) {
        if (active) {
          toast.error(
            err?.response?.data?.message || "Failed to load organizers",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // ── synthetic "AFC Official" card ──
  // AFC runs events directly (organization is null on those). They aren't an
  // Organization row, so the endpoint never returns them - we build one card here
  // from the org-less events already in `events`. Its tier is the best tier among
  // those events; slug=null marks it as having no drill-to-full-page link.
  const afcCard = useMemo<OrganizerDirectoryItem | null>(() => {
    const afcEvents = events.filter((e) => !e.organization_name?.trim());
    if (afcEvents.length === 0) return null;
    return {
      slug: null,
      name: "AFC Official",
      logo: null,
      default_banner: null, // synthetic card has no uploaded banner -> gradient fallback
      description:
        "Events run directly by the African Freefire Community. Flagship leagues, majors, and weekly community scrims.",
      event_count: afcEvents.length,
      verified: true,
      tier: null,
    };
  }, [events]);

  // Full directory list = AFC card (first) + endpoint orgs.
  const allOrgs = useMemo(() => {
    return afcCard ? [afcCard, ...orgs] : orgs;
  }, [afcCard, orgs]);

  // ── apply search + filter + sort to the directory grid ──
  const visibleOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    let list = allOrgs.filter((o) => {
      const matchesQuery = !q || o.name.toLowerCase().includes(q);
      const matchesFilter =
        orgVerFilter === "all" ||
        (orgVerFilter === "verified" && o.verified) ||
        (orgVerFilter === "afc" && o.slug === null);
      return matchesQuery && matchesFilter;
    });
    list = [...list].sort((a, b) =>
      orgSort === "name"
        ? a.name.localeCompare(b.name)
        : b.event_count - a.event_count,
    );
    return list;
  }, [allOrgs, orgSearch, orgVerFilter, orgSort]);

  // ── detail view: this organizer's events, split by competition type ──
  // For a real org we match on organization_slug; for the AFC card we take the
  // org-less events. Status filter is applied so the counts match the page filter.
  const detailEvents = useMemo(() => {
    if (!activeOrg) return [] as Event[];
    const base =
      activeOrg.slug === null
        ? events.filter((e) => !e.organization_name?.trim())
        : events.filter((e) => e.organization_slug === activeOrg.slug);
    return statusFilter === "all"
      ? base
      : base.filter((e) => e.event_status === statusFilter);
  }, [activeOrg, events, statusFilter]);

  const detailTournaments = useMemo(
    () => detailEvents.filter((e) => e.competition_type === "tournament"),
    [detailEvents],
  );
  const detailScrims = useMemo(
    () => detailEvents.filter((e) => e.competition_type === "scrims"),
    [detailEvents],
  );

  // Upcoming count for the detail header (ignores the status filter so the header
  // always reflects the org's true upcoming slate).
  const headerStats = useMemo(() => {
    if (!activeOrg) return { total: 0, upcoming: 0 };
    const orgEvents =
      activeOrg.slug === null
        ? events.filter((e) => !e.organization_name?.trim())
        : events.filter((e) => e.organization_slug === activeOrg.slug);
    return {
      total: orgEvents.length,
      upcoming: orgEvents.filter((e) => e.event_status === "upcoming").length,
    };
  }, [activeOrg, events]);

  // Open a card → detail view, reset its sub-tab, scroll up.
  const openOrg = useCallback((org: OrganizerDirectoryItem) => {
    setActiveOrg(org);
    setDetailSubTab("tournaments");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  if (isLoading) return <Loader text="Loading organizers..." />;

  // ── STATE B: organizer detail ──
  if (activeOrg) {
    const list =
      detailSubTab === "tournaments" ? detailTournaments : detailScrims;
    return (
      <div className="mt-4">
        {/* Back to directory */}
        <button
          type="button"
          onClick={() => setActiveOrg(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          All organizers
        </button>

        {/* Organizer header: logo + name + verified + stats */}
        <Card className="bg-card rounded-md border py-6 shadow-sm mb-4">
          <CardContent className="flex flex-col md:flex-row md:items-center gap-4">
            <Avatar className="h-16 w-16 rounded-md">
              <AvatarImage
                src={activeOrg.logo || undefined}
                alt={activeOrg.name}
                className="object-cover"
              />
              <AvatarFallback className="rounded-md text-xl">
                {activeOrg.name?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-bold">
                  {activeOrg.name}
                </h2>
                {activeOrg.verified && (
                  <BadgeCheck className="h-5 w-5 text-gold shrink-0" />
                )}
              </div>
              {activeOrg.description && (
                <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                  {activeOrg.description}
                </p>
              )}
              {/* Link to the full public org page (real orgs only). */}
              {activeOrg.slug && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                  asChild
                >
                  <Link href={`/organizations/${activeOrg.slug}`}>
                    View full organizer page
                  </Link>
                </Button>
              )}
            </div>

            {/* Stat tiles, pushed right on desktop. */}
            <div className="flex flex-wrap gap-2 md:ml-auto">
              <OrgStat
                value={headerStats.total}
                label="Events"
                tone="text-primary"
              />
              <OrgStat value={headerStats.upcoming} label="Upcoming" />
              {activeOrg.tier && (
                <OrgStat
                  value={activeOrg.tier.replace("Tier ", "T")}
                  label="Tier"
                  tone="text-gold"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* The organizer's OWN Tournaments / Scrims sub-tabs (pill style). */}
        <Tabs
          value={detailSubTab}
          onValueChange={(v) => setDetailSubTab(v as "tournaments" | "scrims")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="tournaments">
              Tournaments ({detailTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="scrims">
              Scrims ({detailScrims.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Event grid for the active sub-tab (reuses the page EventCard). */}
        <div className="grid grid-cols-1 mt-4 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {list.length > 0 ? (
            list.map((event) => <EventCard key={event.event_id} event={event} />)
          ) : (
            <p className="text-center text-muted-foreground col-span-full py-8">
              No {detailSubTab} from this organizer match the current filter.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── STATE A: organizer directory grid ──
  return (
    <div className="mt-4">
      {/* Directory-only controls: search by organizer name, verified filter, sort.
          Kept distinct from the page-level event toolbar so the two don't fight. */}
      <div className="flex w-full mb-3 items-center gap-2 flex-col md:flex-row">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search organizers by name..."
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            className="bg-background/50 backdrop-blur-sm pl-10"
          />
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <Select
            value={orgVerFilter}
            onValueChange={(v) => setOrgVerFilter(v as OrgVerFilter)}
          >
            <SelectTrigger className="w-full md:w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizers</SelectItem>
              <SelectItem value="verified">Verified only</SelectItem>
              <SelectItem value="afc">AFC official</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={orgSort}
            onValueChange={(v) => setOrgSort(v as OrgSort)}
          >
            <SelectTrigger className="w-full md:w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="events">Most events</SelectItem>
              <SelectItem value="name">Name (A to Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Directory grid (same 1/2/3-column layout as the event grids). */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {visibleOrgs.length > 0 ? (
          visibleOrgs.map((org) => (
            <OrganizerCard
              key={org.slug ?? "afc-official"}
              org={org}
              onOpen={openOrg}
            />
          ))
        ) : (
          <p className="text-center text-muted-foreground col-span-full py-8">
            {orgSearch
              ? `No organizers match "${orgSearch}".`
              : "No organizers to show yet."}
          </p>
        )}
      </div>
    </div>
  );
};

// --- Main Component ---
const EventsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("all");
  const [organizerFilter, setOrganizerFilter] =
    useState<OrganizerFilter>("all");
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setEvents(data.events || []);
    } catch {
      setError(
        "Failed to load events. Please check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Derive sorted unique month options from all events
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const months: { value: string; label: string }[] = [];
    [...events]
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .forEach((e) => {
        const ym = e.event_date.slice(0, 7); // "YYYY-MM"
        if (!seen.has(ym)) {
          seen.add(ym);
          const [year, month] = ym.split("-");
          const label = new Date(
            Number(year),
            Number(month) - 1,
          ).toLocaleString("default", { month: "long", year: "numeric" });
          months.push({ value: ym, label });
        }
      });
    return months;
  }, [events]);

  // Derive sorted distinct organizer names present in the fetched events. Used
  // to build the "Organizer" dropdown - only organizers that actually appear are
  // listed (plus the static "All organizers" and "AFC (official)" options that
  // the dropdown adds itself). Events with no organization_name are AFC-official
  // and are reachable via the "afc" option, not listed here.
  const organizerOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const e of events) {
      const name = e.organization_name?.trim();
      if (name) seen.add(name);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [events]);

  // Apply filters + sort before splitting by competition type
  const filteredEvents = useMemo(() => {
    let result = events;

    if (statusFilter !== "all") {
      result = result.filter((e) => e.event_status === statusFilter);
    }

    if (monthFilter !== "all") {
      result = result.filter((e) => e.event_date.startsWith(monthFilter));
    }

    // ── Organizer filter ──
    // "afc" keeps only events with no organization_name (AFC-official); any other
    // non-"all" value matches the event's organization_name exactly.
    if (organizerFilter === "afc") {
      result = result.filter((e) => !e.organization_name?.trim());
    } else if (organizerFilter !== "all") {
      result = result.filter(
        (e) => e.organization_name?.trim() === organizerFilter,
      );
    }

    result = [...result].sort((a, b) => {
      const diff =
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      return dateSort === "newest" ? -diff : diff;
    });

    return result;
  }, [events, statusFilter, monthFilter, organizerFilter, dateSort]);

  const tournaments = useMemo(
    () => filteredEvents.filter((e) => e.competition_type === "tournament"),
    [filteredEvents],
  );
  const scrims = useMemo(
    () => filteredEvents.filter((e) => e.competition_type === "scrims"),
    [filteredEvents],
  );

  const statusCounts = useMemo(() => {
    const counts = {
      all: events.length,
      upcoming: 0,
      ongoing: 0,
      completed: 0,
    };
    for (const e of events) {
      if (e.event_status in counts) counts[e.event_status]++;
    }
    return counts;
  }, [events]);

  if (isLoading) return <FullLoader />;

  return (
    <div>
      <PageHeader title="Tournaments & Scrims" />

      {/* Search */}
      <div className="flex w-full mb-3 items-center justify-center gap-2 flex-col md:flex-row">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by title, date (YYYY-MM-DD), or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background/50 backdrop-blur-sm pl-10"
          />
        </div>
        <div className="flex w-full md:w-auto items-center gap-2 justify-center">
          {/* ── Organizer filter ──
              Built from the distinct organization_name values in the fetched
              events. "All organizers" is the default; "AFC (official)" matches
              events that have no organization. */}
          <Select
            value={organizerFilter}
            onValueChange={(v) => setOrganizerFilter(v as OrganizerFilter)}
          >
            <SelectTrigger className="w-full md:w-44 text-xs">
              <SelectValue placeholder="All organizers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizers</SelectItem>
              <SelectItem value="afc">AFC (official)</SelectItem>
              {organizerOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={monthFilter}
            onValueChange={(v) => setMonthFilter(v as MonthFilter)}
          >
            <SelectTrigger className="w-full md:w-44 text-xs">
              <SelectValue placeholder="All Dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date sort */}
          <Select
            value={dateSort}
            onValueChange={(v) => setDateSort(v as DateSort)}
          >
            <SelectTrigger className="w-full md:w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Status filter buttons */}
        <div className="flex flex-wrap gap-1">
          {(["all", "upcoming", "ongoing", "completed"] as StatusFilter[]).map(
            (s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
                className="capitalize text-xs"
              >
                {s === "all" ? "All" : s}
                <span className="ml-1 text-xs opacity-70">
                  ({s === "all" ? statusCounts.all : statusCounts[s]})
                </span>
              </Button>
            ),
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-4">
          {error}
        </div>
      )}

      {!error && (
        <Tabs defaultValue="tournaments">
          <TabsList className="w-full">
            <TabsTrigger value="tournaments">
              Tournaments ({tournaments.length})
            </TabsTrigger>
            <TabsTrigger value="scrims">Scrims ({scrims.length})</TabsTrigger>
            {/* ── NEW: Organizers tab ──
                Sits alongside the existing pill tabs (does NOT replace them). It
                renders the organizer directory + drill-down. It is fed the full
                fetched `events` list (for the AFC-official card + per-org event
                grids) and the current statusFilter (so detail counts stay in sync
                with the page's status buttons). No count is shown on the trigger
                because the directory size is computed inside OrganizerDirectory
                (from the public organizers endpoint), not on this page. */}
            <TabsTrigger value="organizers">Organizers</TabsTrigger>
          </TabsList>
          <TabsContent value="tournaments">
            <EventList events={tournaments} searchQuery={searchQuery} />
          </TabsContent>
          <TabsContent value="scrims">
            <EventList events={scrims} searchQuery={searchQuery} />
          </TabsContent>
          <TabsContent value="organizers">
            {/* events is the UNFILTERED-by-type set; OrganizerDirectory does its
                own organization grouping and applies statusFilter internally. */}
            <OrganizerDirectory events={events} statusFilter={statusFilter} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default EventsPage;
