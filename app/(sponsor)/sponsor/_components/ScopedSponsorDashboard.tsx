"use client";

// ── ScopedSponsorDashboard ────────────────────────────────────────────────────
// The NEW member-scoped sponsor portal (sponsor-system redesign P1, owner-approved mockup:
// public/_sponsor_system_preview.html view 1). Rendered by app/(sponsor)/sponsor/dashboard/
// page.tsx when the caller has at least one SponsorMember row (GET /sponsors/mine/); members
// see ONLY their own sponsor(s) - the ydpay rule.
//
// FLOW: sponsor switcher (when in several) -> the sponsor's attached events -> one event's
// drill-down. The drill-down probes GET .../engagement-submissions/ alongside the legacy
// submissions read:
//   - engagements CONFIGURED (P2 wizard wrote entries) -> EngagementSubmissionsPanel.tsx
//     (same folder): per-engagement pill tabs + the P4 approval queue + scoped CSV.
//   - NO engagements (or the P3 endpoint is missing on an older backend) -> the legacy
//     submissions table below, unchanged.
//
// HOW IT CONNECTS: lib/sponsors.ts -> afc_sponsors portal endpoints. The legacy table reads
// the per-competitor sponsor ids (sponsorsApi.submissions); the new surface reads engagement
// submissions (sponsorsApi.engagementSubmissions) and decides via sponsorsApi.decideSubmission.
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
  const [sponsorId, setSponsorId] = useState<number>(sponsors[0].id);
  const sponsor = sponsors.find((s) => s.id === sponsorId) ?? sponsors[0];

  const [events, setEvents] = useState<SponsorEventRow[] | null>(null);
  const [openEvent, setOpenEvent] = useState<SponsorEventRow | null>(null);
  const [rows, setRows] = useState<SponsorSubmissionRow[] | null>(null);
  // P3 probe result. null = in flight. engagements NON-EMPTY -> render the new
  // per-engagement surface (the payload doubles as its page 1); EMPTY -> legacy table.
  const [engData, setEngData] = useState<EngagementSubmissionsPayload | null>(null);
  const [search, setSearch] = useState("");

  // Events of the selected sponsor (reloads on switcher change).
  useEffect(() => {
    setEvents(null);
    setOpenEvent(null);
    sponsorsApi
      .events(sponsorId)
      .then((res) => setEvents(res.results))
      .catch(() => {
        toast.error("Failed to load this sponsor's events.");
        setEvents([]);
      });
  }, [sponsorId]);

  const drillIn = useCallback((e: SponsorEventRow) => {
    setOpenEvent(e);
    setRows(null);
    setEngData(null);
    setSearch("");
    // Legacy read (still the surface for events without engagements).
    sponsorsApi
      .submissions(sponsorId, e.event_id)
      .then((res) => setRows(res.results))
      .catch(() => {
        toast.error("Failed to load submissions.");
        setRows([]);
      });
    // P3 probe, fetched alongside: page 1 of the engagement submissions (All tab,
    // no status filter). Errors (e.g. an older backend without the endpoint) fall
    // back silently to the legacy table so the portal never goes blank.
    sponsorsApi
      .engagementSubmissions(sponsorId, e.event_id, {
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
  }, [sponsorId]);

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
            ? `${openEvent.event_name} submissions for ${sponsor.name}`
            : `Your ${sponsor.name} sponsor dashboard`
        }
      />

      {/* Sponsor switcher (only when the member belongs to several sponsors). */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="rounded-full border-gold px-2 py-0.5 text-xs" style={{ color: "var(--gold)" }}>
          Sponsor
        </Badge>
        {sponsors.length > 1 ? (
          <Select value={String(sponsorId)} onValueChange={(v) => setSponsorId(parseInt(v, 10))}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sponsors.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-semibold">{sponsor.name}</span>
        )}
      </div>

      {!openEvent ? (
        // ── events list ──
        events === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
            <IconLoader2 className="size-5 animate-spin" /> Loading your events...
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No events are attached to {sponsor.name} yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {events.map((e) => (
              <button
                key={e.event_id}
                type="button"
                onClick={() => drillIn(e)}
                className="flex items-center justify-between gap-3 rounded-md border bg-card p-4 text-left hover:border-primary/50"
              >
                <div>
                  <div className="font-semibold">{e.event_name}</div>
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
        // ── one event's drill-down ──
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
                    sponsorId,
                    openEvent.event_id,
                    `${sponsor.slug}-${openEvent.slug || openEvent.event_id}-submissions.csv`,
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
              key={`${sponsorId}-${openEvent.event_id}`}
              sponsor={sponsor}
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
