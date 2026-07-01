"use client";

// ── Admin · OBS Overlays (central overlay manager) ───────────────────────────
// PURPOSE (owner 2026-07-01: "there should be a page to manage all these overlays"): one place that
// lists EVERY event so an admin can grab that event's live-leaderboard OBS Browser Source link and
// jump to where it is managed. Previously the overlay link + broadcast control lived only on each
// event's leaderboard edit page; this is the cross-event index over them.
//
// PER ROW:
//   • Copy OBS overlay link  -> <CopyOverlayLinkDialog eventId> (components/overlay): ensures the
//     event's read-only overlay_token and builds the browser-source URL (design/size/anim/columns/
//     follow-broadcast). Same dialog used on the leaderboard edit page.
//   • Leaderboard            -> /a/leaderboards/<event_id>/edit, where the results, the standings, the
//     BroadcastControl (what the overlay shows) and the export live.
//
// DATA: GET events/get-all-events/ (Bearer admin token, AuthContext). Read-only list; all writes go
// through the reused dialog + the leaderboard page. Look + feel mirrors the AFC admin idiom
// (PageHeader green title, bg-card rounded-md border card, Input search, Badge status).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import axios from "axios";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconChartBar, IconBroadcast } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { CopyOverlayLinkDialog } from "@/components/overlay/CopyOverlayLinkDialog";

// Only the fields the list needs off get-all-events (which returns more).
interface EventRow {
  event_id: number;
  event_name: string;
  event_status?: string;
  organization?: number | null;
  organization_id?: number | null;
}

export default function AdminOverlaysPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ events?: EventRow[] } | EventRow[]>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = res.data as { events?: EventRow[] } | EventRow[];
        const list = Array.isArray(data) ? data : (data.events ?? []);
        if (!cancelled) setEvents(list);
      } catch {
        if (!cancelled) toast.error("Could not load events.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? events.filter((e) => (e.event_name || "").toLowerCase().includes(s))
      : events;
  }, [events, q]);

  if (loading) return <FullLoader />;

  return (
    <div>
      <PageHeader
        title="OBS Overlays"
        description="Copy the live-leaderboard browser source for any event, then manage what it shows from that event's leaderboard."
      />

      <Card className="bg-card rounded-md border">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <IconBroadcast className="text-primary size-5" />
            <Input
              placeholder="Search events..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
            <span className="text-muted-foreground ml-auto text-xs">
              {filtered.length} event{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="divide-border divide-y">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No events found.
              </p>
            ) : (
              filtered.map((e) => {
                const orgId = e.organization ?? e.organization_id ?? null;
                return (
                  <div
                    key={e.event_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-medium">
                        {e.event_name}
                      </p>
                      {e.event_status ? (
                        <Badge
                          variant="outline"
                          className="mt-1 rounded-full px-2 py-0.5 text-xs capitalize"
                        >
                          {e.event_status}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {/* Reused dialog: ensures the overlay token + builds the OBS browser-source URL. */}
                      <CopyOverlayLinkDialog
                        eventId={e.event_id}
                        organizationId={orgId}
                      />
                      {/* Where the BroadcastControl (what the overlay shows) + results live. */}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/a/leaderboards/${e.event_id}/edit`}>
                          <IconChartBar className="size-4" />
                          Leaderboard
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
