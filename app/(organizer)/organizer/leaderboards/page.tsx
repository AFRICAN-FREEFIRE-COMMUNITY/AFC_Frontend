// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Leaderboards (the org's events + their leaderboard status).
//
// The org-side entry point for UPLOADING RESULTS and MANAGING LEADERBOARDS. It
// lists ONLY the selected organization's events (scoped via organization_id, the
// same scoping the organizer Events list uses) and, for each, shows whether a
// leaderboard exists yet plus a "Manage" link into the per-event surface at
// /organizer/events/<slug>/leaderboard.
//
// DATA (two read-only fetches, mirroring the ADMIN leaderboards list page
// app/(a)/a/leaderboards/page.tsx, which also reads both lists):
//   • GET /events/get-all-events/?organization_id=<id>  → this org's events (rows)
//   • GET /events/get-all-leaderboards/                  → every leaderboard; we
//     filter it down to leaderboards whose event belongs to THIS org's events, to
//     compute a per-event "Leaderboards: N / None" status. (get-all-leaderboards
//     is unscoped, so we intersect it with the org's event_id set client-side.)
// Both calls carry the Bearer token from AuthContext so an org-scoped backend can
// authorise the caller against the organization (same as the Events list page).
//
// GATING: the WHOLE surface is gated on membership.permissions.can_upload_results
// OR isOwner - the exact org permission the backend now requires to upload results
// (org_can(user, "can_upload_results", event) in afc_organizers/permissions.py).
// A member without it gets a read-only lock notice (mirrors the organizer Design /
// Create-Event pages' lock notice). The nav item still shows (per the portal's
// existing pattern); the gate lives here.
//
// REUSE: this is a LIST page, so it reuses no admin step components directly - the
// heavy multi-step reuse happens on the per-event page
// (events/[slug]/leaderboard/page.tsx). Design mirrors the sibling organizer pages
// (events / design): PageHeader, a single Card wrapping a Table, outline status
// badges (rounded-full, text-xs) per AFC constants, sonner toasts on error.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import axios from "axios";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconLock,
  IconSearch,
  IconSettings,
  IconTrophy,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "../_components/OrganizerContext";
// Standalone (event-less) leaderboards section — shared with the admin surface, scoped here to this
// org via organizationId so the organizer only sees + creates leaderboards owned by their org.
import { StandaloneLeaderboardList } from "@/app/(a)/a/leaderboards/standalone/_components/StandaloneLeaderboardList";
// This org's leaderboard design library (org-scoped). Organizers upload branded backgrounds here;
// the standalone leaderboard export picker renders standings onto the chosen one. Write access is
// gated on can_submit_designs (or owner) - the SAME permission the AFC design-request page uses.
import { LeaderboardDesignsManager } from "@/app/(a)/a/leaderboards/standalone/_components/LeaderboardDesignsManager";

// ── Row shapes ────────────────────────────────────────────────────────────────
// The org-scoped event row (subset of get-all-events). Only the fields the table
// renders + the slug used to deep-link into the per-event management surface.
interface OrgEvent {
  event_id: number | string;
  event_name: string;
  event_date: string;
  event_status: string;
  competition_type: string;
  slug: string;
}

// One leaderboard row from get-all-leaderboards - we only need its parent event_id
// to count leaderboards per event (so a row can show "Leaderboards: N" vs "None").
interface LeaderboardRow {
  leaderboard_id: number;
  event: { event_id: number };
}

// ── Status badge ──────────────────────────────────────────────────────────────
// Outline badge (rounded-full, text-xs) per AFC constants; colour by event status -
// same colour mapping the organizer Events list uses, kept consistent across pages.
function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();
  const colour =
    normalized === "ongoing"
      ? "border-green-500 text-green-600"
      : normalized === "completed"
        ? "border-blue-500 text-blue-600"
        : normalized === "draft"
          ? "border-muted-foreground text-muted-foreground"
          : // upcoming (and anything unrecognised) → gold/amber
            "border-yellow-500 text-yellow-600";
  return (
    <Badge variant="outline" className={`capitalize ${colour}`}>
      {status || "unknown"}
    </Badge>
  );
}

// ── Leaderboard-status badge ────────────────────────────────────────────────────
// "Leaderboards: N" (green) when at least one exists for the event, "None" (muted)
// otherwise - the at-a-glance signal that tells the organizer whether there is
// anything to manage yet for that event.
function LeaderboardCountBadge({ count }: { count: number }) {
  return (
    <Badge
      variant="outline"
      className={
        count > 0
          ? "border-green-500 text-green-600"
          : "border-muted-foreground text-muted-foreground"
      }
    >
      {count > 0 ? `Leaderboards: ${count}` : "None yet"}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerLeaderboardsPage() {
  const { membership, isOwner } = useOrganizer();
  const { token } = useAuth();

  // The numeric id used to scope the events fetch (lives on the selected membership).
  const organizationId = membership.organization.organization_id;
  // The SAME gate the backend enforces for results upload: owner OR can_upload_results.
  const canUploadResults =
    membership.permissions.can_upload_results || isOwner;

  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [leaderboards, setLeaderboards] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Load this org's events + every leaderboard (intersected client-side). ──
  // Re-runs when the org switches: the portal layout re-mounts this subtree keyed
  // on slug, so organizationId is always current for the selected org.
  useEffect(() => {
    // Skip the fetch entirely when the caller can't manage results - the page only
    // renders the lock notice in that case, so there's nothing to load.
    if (!canUploadResults) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // Both reads are public/read-only but carry the Bearer so an org-scoped
        // backend can authorise the caller against the organization.
        const authHeaders = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const [eventsRes, leaderboardsRes] = await Promise.all([
          axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`, {
            params: { organization_id: organizationId },
            headers: authHeaders,
          }),
          axios.get(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboards/`,
            { headers: authHeaders },
          ),
        ]);

        setEvents(eventsRes.data?.events ?? []);
        setLeaderboards(leaderboardsRes.data?.leaderboards ?? []);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to load your leaderboards.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [organizationId, token, canUploadResults]);

  // ── Per-event leaderboard counts ──────────────────────────────────────────────
  // get-all-leaderboards is unscoped, so we intersect it with THIS org's events:
  // a Map from event_id → number of leaderboards, used to badge each row. Built
  // once per data change so the table render stays cheap.
  const leaderboardCountByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const lb of leaderboards) {
      const id = String(lb.event?.event_id ?? "");
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [leaderboards]);

  // ── Search filter (name / type / status), mirroring the admin list page. ──
  // Uses the shared matchesSearch() helper (lib/search.ts) so the search box is
  // punctuation/space/accent-insensitive and folds stylized "fancy font" unicode,
  // matching every other "Search ..." box on the site. The three fields are passed
  // as one array haystack, replacing the old OR-chain of .toLowerCase().includes().
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    return events.filter((e) =>
      matchesSearch(
        [e.event_name, e.competition_type, e.event_status],
        searchQuery,
      ),
    );
  }, [events, searchQuery]);

  // ── Permission gate: read-only lock notice (mirrors Design / Create-Event). ──
  if (!canUploadResults) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Leaderboards"
          description="Upload results and manage your events' leaderboards."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              You do not have permission to manage results for this organization.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/overview">Back to overview</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leaderboards"
        description="Upload results and manage your events' leaderboards."
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Your Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search row - same idiom as the admin leaderboards list. */}
          <div className="flex items-center justify-start gap-2">
            <Input
              type="search"
              placeholder="Search events by name, type, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background/50 backdrop-blur-sm block"
            />
            <Button className="w-9 h-9 md:h-12 md:w-auto" type="button">
              <IconSearch />
              <span className="hidden md:inline-block">Search</span>
            </Button>
          </div>

          {loading ? (
            // Inline loading row - matches the organizer Events page loading copy.
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            // ── Empty state ── nothing homed to this org yet (no events → no
            // leaderboards to manage). Mirrors the Events list empty state.
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <IconTrophy className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your organization hasn&apos;t created any events yet, so there are
                no leaderboards to manage.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/organizer/events">Go to events</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leaderboard</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => {
                    const count =
                      leaderboardCountByEvent.get(String(event.event_id)) ?? 0;
                    return (
                      <TableRow key={event.event_id}>
                        <TableCell className="font-medium">
                          {event.event_name}
                        </TableCell>
                        <TableCell className="capitalize">
                          {event.competition_type}
                        </TableCell>
                        <TableCell>
                          {event.event_date ? formatDate(event.event_date) : "-"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={event.event_status} />
                        </TableCell>
                        <TableCell>
                          <LeaderboardCountBadge count={count} />
                        </TableCell>
                        <TableCell>
                          {/* "Manage" deep-links into the per-event results +
                              leaderboard surface, keyed by the event slug. */}
                          <div className="flex items-center justify-end">
                            <Button asChild variant="outline" size="sm">
                              <Link
                                href={`/organizer/events/${event.slug}/leaderboard`}
                              >
                                <IconSettings className="size-4" />
                                Manage
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No events match your search query.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Standalone (event-less) leaderboards ──────────────────────────────
          Sits below the per-event table. Scoped to THIS org via organizationId so
          the organizer only lists/creates leaderboards owned by their org. The
          "Create standalone" button reuses the same wizard the admin uses; the
          backend forces the new leaderboard's organization to the caller's org and
          forces counts_toward_rankings off for organizers.

          createHref / viewHrefBase point at the ORGANIZER-portal copies of the
          create wizard + view page (app/(organizer)/organizer/leaderboards/standalone/...),
          NOT the admin /a/... routes (which the OrganizerProvider-gated organizer
          cannot reach). Those organizer pages reuse the same admin-owned wizard/view
          components, just mounted with the organizer basePath, so an organizer gets
          the full create flow (including the OCR "Upload screenshots" batch dialog). */}
      <StandaloneLeaderboardList
        organizationId={organizationId}
        createHref="/organizer/leaderboards/standalone/create"
        viewHrefBase="/organizer/leaderboards/standalone"
      />

      {/* ── This org's leaderboard design library ───────────────────────────────
          Scoped to organizationId so the organizer only sees + manages their own
          designs. Write buttons gate on can_submit_designs (or owner) - the design
          permission, distinct from the can_upload_results gate on this page above. */}
      <LeaderboardDesignsManager
        organizationId={organizationId}
        canManage={membership.permissions.can_submit_designs || isOwner}
      />
    </div>
  );
}
