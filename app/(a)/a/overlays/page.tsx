"use client";

// ── Admin · Live Overlays (central overlay + capture hub) ────────────────────
// PURPOSE (owner 2026-07-01): one admin place to run the live leaderboard overlays. Renamed from
// "OBS Overlays" because the browser-source works in OBS, vMix, or ANY software that takes a Browser
// Source, so nothing here is OBS-specific.
//
// WHAT AN ADMIN DOES HERE:
//   • Get the AFC Capture software (download + how-to link) — the desktop app that auto-uploads
//     results + pushes live standings.
//   • Pick an event → the per-event OVERLAY STUDIO (/a/overlays/[eventId]) opens with EVERYTHING
//     inline (owner 2026-07-02: no dialogs): every design as a live preview + per-link animation
//     controls, the Timer scene, the Broadcast control, and the capture key.
//
// DATA: GET events/get-all-events/ (Bearer admin). Writes go through the reused dialog + controls.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import axios from "axios";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  IconBroadcast,
  IconChevronRight,
  IconDownload,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveTick } from "@/hooks/useLiveTick";

interface EventRow {
  event_id: number;
  event_name: string;
  event_status?: string;
  organization?: number | null;
  organization_id?: number | null;
}

// The AFC Capture installer served by this frontend (or a hosted override).
const CAPTURE_DOWNLOAD_URL =
  env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL || "/downloads/AFC-Capture-Setup.exe";

export default function AdminLiveOverlaysPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Live refresh (owner 2026-07-02): re-run the read-only events fetch on the site-wide tick.
  // `loading` only starts true (never reset), so background refreshes don't flash the FullLoader;
  // fetch errors only toast on the initial load (tick 0), never on background ticks.
  const tick = useLiveTick();

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
        if (!cancelled) setEvents(Array.isArray(data) ? data : (data.events ?? []));
      } catch {
        if (!cancelled && tick === 0) toast.error("Could not load events.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, tick]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? events.filter((e) => (e.event_name || "").toLowerCase().includes(s))
      : events;
  }, [events, q]);

  if (loading) return <FullLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Overlays"
        description="Run the live leaderboard overlays. The browser source works in OBS, vMix, or any software that takes a Browser Source."
      />

      {/* ── AFC Capture software (download + how-to) ── */}
      <Card className="bg-card rounded-md border" data-tour="overlays-capture">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconDownload className="text-primary size-5" />
            AFC Capture software
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            The Windows desktop app that runs on the room-hosting PC: it auto-uploads each round's
            result and pushes live in-round standings to the overlay. It only works with the Free Fire
            3D observer client on the same PC. Generate an event's capture key below, paste it into the
            app, and leave it running while you host.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <a href={CAPTURE_DOWNLOAD_URL} download>
                <IconDownload className="size-4" />
                Download AFC Capture
              </a>
            </Button>
          </div>
          {/* Setup guide INLINE (owner 2026-07-02): admins run overlays from here, so the steps live on
              this admin page instead of linking out to the organizer portal's /organizer/capture page
              (which is organizer-scoped and the wrong context for an admin). */}
          <ol className="text-muted-foreground ml-4 list-decimal space-y-1 text-xs">
            <li>Install and open AFC Capture on the PC running the Free Fire 3D observer client.</li>
            <li>
              Generate the event&apos;s <b>Capture key</b> below and paste it into AFC Capture.
            </li>
            <li>
              Copy the event&apos;s overlay link and add it as a Browser Source in OBS, vMix, or any
              software.
            </li>
            <li>
              Use <b>Broadcast</b> to choose which stage or group (or a cumulative) the overlay shows.
            </li>
            <li>
              Leave AFC Capture running while you host: it auto-uploads each round and pushes live
              standings to the overlay.
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* ── Per-event overlay controls ── */}
      <Card className="bg-card rounded-md border" data-tour="overlays-events">
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
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/a/overlays/${e.event_id}`}>
                          Open overlays
                          <IconChevronRight className="size-4" />
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
