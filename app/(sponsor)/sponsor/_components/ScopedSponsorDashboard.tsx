"use client";

// ── ScopedSponsorDashboard ────────────────────────────────────────────────────
// The NEW member-scoped sponsor portal (sponsor-system redesign P1, owner-approved mockup:
// public/_sponsor_system_preview.html view 1). Rendered by app/(sponsor)/sponsor/dashboard/
// page.tsx when the caller has at least one SponsorMember row (GET /sponsors/mine/); members
// see ONLY their own sponsor(s) - the ydpay rule.
//
// FLOW (owner request 2026-06-13: "under the sponsor dashboard i should be able to see all
// events assigned to me as a sponsor and then i can decide which to open"):
//   1. The dashboard OPENS with a FLAT list of ALL events across ALL the caller's sponsor
//      memberships (every membership's GET /sponsors/<id>/events/ fetched in parallel, rows
//      merged and tagged with the sponsor they came from). Each row shows the event name,
//      a sponsor chip, the registrant count and the event status.
//   2. The sponsor switcher is now an optional FILTER (default "All sponsors"), not a hard
//      gate: it narrows the merged list client-side and only renders when the member belongs
//      to several sponsors.
//   3. Clicking a row opens the existing per-sponsor+event drill-down; the sponsor id rides
//      on the clicked row, so the drill-down fetches stay exactly as before.
//
// The drill-down probes GET .../engagement-submissions/ alongside the legacy submissions read:
//   - engagements CONFIGURED (P2 wizard wrote entries) -> EngagementSubmissionsPanel.tsx
//     (same folder): per-engagement pill tabs + the P4 approval queue + scoped CSV.
//   - NO engagements (or the P3 endpoint is missing on an older backend) -> the legacy
//     submissions table below, unchanged.
//
// HOW IT CONNECTS: lib/sponsors.ts -> afc_sponsors portal endpoints. The event list composes
// sponsorsApi.events(sponsorId) per membership (lib/sponsors.ts is untouched; the sponsor tag
// is added HERE). The legacy table reads the per-competitor sponsor ids (sponsorsApi
// .submissions); the new surface reads engagement submissions (sponsorsApi
// .engagementSubmissions) and decides via sponsorsApi.decideSubmission.
//
// Design: mirrors the CURRENT sponsor dashboard idioms (search input, light pill status
// badges, Card p-0 table, showing-x-of-y footer) per the owner's design-parity feedback.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import {
  sponsorsApi,
  type SponsorEventRow,
  type SponsorRow,
  type SponsorSubmissionRow,
} from "@/lib/sponsors";
import {
  IconArrowLeft,
  IconDownload,
  IconLoader2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";

// P3/P4: the per-engagement tables + approval queue (same folder). The payload type +
// page size are exported there so this probe fetch doubles as the panel's page 1.
import {
  ENGAGEMENT_PAGE_SIZE,
  EngagementSubmissionsPanel,
  type EngagementSubmissionsPayload,
} from "./EngagementSubmissionsPanel";

// One row of the merged event list: the backend SponsorEventRow tagged with the sponsor
// membership it was fetched under, so a click can derive the sponsor id (and the drill-down
// + CSV filename can name the sponsor) without a separate "selected sponsor" gate.
interface TaggedEventRow extends SponsorEventRow {
  sponsor_id: number;
  sponsor_name: string;
  sponsor_slug: string;
}

// The sponsor-filter Select's "no filter" sentinel ("All sponsors", the default).
const ALL_SPONSORS = "all";

// The CURRENT page's light pill badge, reused verbatim so both systems read identically.
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    registered: "bg-green-100 text-green-700",
    active: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        map[status] ?? "bg-yellow-100 text-yellow-700",
      )}
    >
      {status}
    </span>
  );
}

export function ScopedSponsorDashboard({ sponsors }: { sponsors: SponsorRow[] }) {
  const { user } = useAuth();

  // ── state ──
  // events: the MERGED flat list across every membership. null = parallel fetch in flight.
  const [events, setEvents] = useState<TaggedEventRow[] | null>(null);
  // sponsorFilter: "all" (default) or a sponsor id as a string (Select values are strings).
  const [sponsorFilter, setSponsorFilter] = useState<string>(ALL_SPONSORS);
  const [openEvent, setOpenEvent] = useState<TaggedEventRow | null>(null);
  const [rows, setRows] = useState<SponsorSubmissionRow[] | null>(null);
  // P3 probe result. null = in flight. engagements NON-EMPTY -> render the new
  // per-engagement surface (the payload doubles as its page 1); EMPTY -> legacy table.
  const [engData, setEngData] = useState<EngagementSubmissionsPayload | null>(null);
  const [search, setSearch] = useState("");

  // ── load ALL memberships' events in parallel and merge ──
  // One sponsorsApi.events() call per membership; each result row is tagged with its
  // sponsor before the lists are flattened. A failing sponsor degrades to an empty list
  // (one toast for the whole batch) so one bad membership never blanks the dashboard.
  useEffect(() => {
    let cancelled = false;
    let anyFailed = false;
    setEvents(null);
    setOpenEvent(null);
    Promise.all(
      sponsors.map((s) =>
        sponsorsApi
          .events(s.id)
          .then((res) =>
            res.results.map(
              (e): TaggedEventRow => ({
                ...e,
                sponsor_id: s.id,
                sponsor_name: s.name,
                sponsor_slug: s.slug,
              }),
            ),
          )
          .catch(() => {
            anyFailed = true;
            return [] as TaggedEventRow[];
          }),
      ),
    ).then((perSponsor) => {
      if (cancelled) return;
      if (anyFailed) toast.error("Some of your sponsors' events failed to load.");
      setEvents(perSponsor.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [sponsors]);

  // ── the visible list: merged events, narrowed by the optional sponsor filter ──
  const visibleEvents = useMemo(() => {
    if (!events) return [];
    if (sponsorFilter === ALL_SPONSORS) return events;
    const id = parseInt(sponsorFilter, 10);
    return events.filter((e) => e.sponsor_id === id);
  }, [events, sponsorFilter]);

  // The sponsor entity behind the OPEN event (for the engagement panel's props + the
  // privacy line). sponsor_id always comes from `sponsors`, so find() always hits; the
  // ?? fallback only satisfies the type (the page gate guarantees sponsors is non-empty).
  const openSponsor =
    sponsors.find((s) => s.id === openEvent?.sponsor_id) ?? sponsors[0];

  // ── drill into one event (sponsor id rides on the clicked row) ──
  const drillIn = useCallback((e: TaggedEventRow) => {
    setOpenEvent(e);
    setRows(null);
    setEngData(null);
    setSearch("");
    // Legacy read (still the surface for events without engagements).
    sponsorsApi
      .submissions(e.sponsor_id, e.event_id)
      .then((res) => setRows(res.results))
      .catch(() => {
        toast.error("Failed to load submissions.");
        setRows([]);
      });
    // P3 probe, fetched alongside: page 1 of the engagement submissions (All tab,
    // no status filter). Errors (e.g. an older backend without the endpoint) fall
    // back silently to the legacy table so the portal never goes blank.
    sponsorsApi
      .engagementSubmissions(e.sponsor_id, e.event_id, {
        limit: ENGAGEMENT_PAGE_SIZE,
        offset: 0,
      })
      .then(setEngData)
      .catch(() =>
        setEngData({
          event: { event_id: e.event_id, event_name: e.event_name },
          engagements: [],
          requires_approval: false,
          results: [],
          total_count: 0,
          has_more: false,
          next_offset: null,
        }),
      );
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search.trim()) return rows;
    return rows.filter((r) => matchesSearch([r.username, r.team_name, r.value], search));
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-3 mx-auto">
      <PageHeader
        title={`Welcome, ${user?.full_name || user?.in_game_name || ""}`}
        description={
          openEvent
            ? `${openEvent.event_name} submissions for ${openEvent.sponsor_name}`
            : sponsors.length > 1
              ? "All events across your sponsors"
              : `Your ${sponsors[0].name} sponsor dashboard`
        }
      />

      {/* ── sponsor filter row ──
          The switcher is an optional FILTER now, not a gate: "All sponsors" is the
          default and the event list always opens merged. Changing it also pops any
          open drill-down so the user lands back on the (re)filtered list. Single
          membership keeps the plain name label, exactly as before. */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="rounded-full border-gold px-2 py-0.5 text-xs" style={{ color: "var(--gold)" }}>
          Sponsor
        </Badge>
        {sponsors.length > 1 ? (
          <Select
            value={sponsorFilter}
            onValueChange={(v) => {
              setSponsorFilter(v);
              setOpenEvent(null);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SPONSORS}>All sponsors</SelectItem>
              {sponsors.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-semibold">{sponsors[0].name}</span>
        )}
      </div>

      {!openEvent ? (
        // ── events list (ALL memberships merged; rows tagged with a sponsor chip) ──
        events === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
            <IconLoader2 className="size-5 animate-spin" /> Loading your events...
          </div>
        ) : visibleEvents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {events.length === 0
                ? sponsors.length > 1
                  ? "No events are attached to your sponsors yet."
                  : `No events are attached to ${sponsors[0].name} yet.`
                : "No events for this sponsor yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleEvents.map((e) => (
              // Key includes the sponsor id: the same event can be attached to two of
              // the caller's sponsors, and each pairing is its own drill-down.
              <button
                key={`${e.sponsor_id}-${e.event_id}`}
                type="button"
                onClick={() => drillIn(e)}
                className="flex items-center justify-between gap-3 rounded-md border bg-card p-4 text-left hover:border-primary/50"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{e.event_name}</span>
                    {/* Sponsor chip: which membership this row belongs to. */}
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                      {e.sponsor_name}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.registrants} registrant{e.registrants !== 1 ? "s" : ""}
                  </div>
                </div>
                <span className="text-xs font-medium capitalize text-muted-foreground">
                  {e.event_status}
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        // ── one event's drill-down (per sponsor+event; sponsor came from the row) ──
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setOpenEvent(null)}>
              <IconArrowLeft className="size-4" /> Back to your events
            </Button>
            {/* The legacy CSV rides with the legacy surface only; the engagement
                panel ships its own tab + status scoped Export CSV. */}
            {engData !== null && engData.engagements.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  sponsorsApi.submissionsCsv(
                    openEvent.sponsor_id,
                    openEvent.event_id,
                    `${openEvent.sponsor_slug}-${openEvent.slug || openEvent.event_id}-submissions.csv`,
                  )
                }
              >
                <IconDownload className="size-4" /> Export CSV
              </Button>
            )}
          </div>

          {engData === null ? (
            // P3 probe in flight: which surface this event gets is not known yet.
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
              <IconLoader2 className="size-5 animate-spin" /> Loading submissions...
            </div>
          ) : engData.engagements.length > 0 ? (
            // ── NEW surface (P3/P4): per-engagement tables + approval queue ──
            // key remounts the panel per sponsor+event so tab/filter/page state resets.
            <EngagementSubmissionsPanel
              key={`${openEvent.sponsor_id}-${openEvent.event_id}`}
              sponsor={openSponsor}
              event={openEvent}
              initial={engData}
            />
          ) : (
            // ── LEGACY surface (no engagements configured): the original table ──
            <>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username, team, or submitted value..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearch("")}
                  >
                    <IconX className="size-4" />
                  </button>
                )}
              </div>

              {rows === null ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
                  <IconLoader2 className="size-5 animate-spin" /> Loading submissions...
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {rows.length === 0
                      ? "No registrations for this event yet."
                      : "No results match your search."}
                  </CardContent>
                </Card>
              ) : (
                <Card className="pt-2">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>Submitted value</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{r.username}</TableCell>
                              <TableCell>{r.team_name ?? "-"}</TableCell>
                              <TableCell>
                                {r.value ?? (
                                  <span className="text-muted-foreground italic text-xs">
                                    Not provided
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={r.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="px-4 py-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {filtered.length} of {rows.length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
