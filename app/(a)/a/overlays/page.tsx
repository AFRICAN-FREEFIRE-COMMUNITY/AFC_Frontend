"use client";

// ── Admin · Live Overlays (central overlay + capture hub) ────────────────────
// PURPOSE (owner 2026-07-01): one admin place to run the live leaderboard overlays. Renamed from
// "OBS Overlays" because the browser-source works in OBS, vMix, or ANY software that takes a Browser
// Source, so nothing here is OBS-specific.
//
// WHAT AN ADMIN DOES HERE:
//   • Get the AFC Capture software (download + how-to link) — the desktop app that auto-uploads
//     results + pushes live standings.
//   • Per event:
//       - Capture key   : POST events/<id>/upload/token/ (uploadTokenApi.ensure) — the WRITE key the
//         desktop app authenticates with. Gate = AFC event admin OR the org (so admins can mint it).
//       - Copy overlay link : <CopyOverlayLinkDialog> — the read-only browser-source URL.
//       - Broadcast     : <BroadcastControl> in a dialog — SET / TRIGGER which stage/group (or a
//         cumulative) the overlay shows, live, from here. The overlay follows within one poll.
//       - Leaderboard   : jump to the full results page.
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  IconChartBar,
  IconBroadcast,
  IconKey,
  IconDownload,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { CopyOverlayLinkDialog } from "@/components/overlay/CopyOverlayLinkDialog";
import { BroadcastControl } from "@/components/overlay/BroadcastControl";
import { uploadTokenApi } from "@/lib/overlay";

interface EventRow {
  event_id: number;
  event_name: string;
  event_status?: string;
  organization?: number | null;
  organization_id?: number | null;
}

// The AFC Capture installer served by this frontend (or a hosted override).
const CAPTURE_DOWNLOAD_URL =
  env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL || "/downloads/AFC-Capture.exe";

// ── Per-row capture key: mint (or return) the event's upload token, then copy it. Own state so each
//    row is independent. Gate is server-side (event admin OR org), so an AFC admin can mint any. ──
function CaptureKeyButton({ eventId }: { eventId: number }) {
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");

  const getAndCopy = async () => {
    setBusy(true);
    try {
      const k = key || (await uploadTokenApi.ensure(eventId));
      setKey(k);
      await navigator.clipboard?.writeText(k);
      toast.success("Capture key copied. Paste it into AFC Capture.");
    } catch {
      toast.error("Could not generate the capture key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={getAndCopy} disabled={busy}>
      <IconKey className="size-4" />
      {key ? "Copy capture key" : "Capture key"}
    </Button>
  );
}

// ── Per-row broadcast control in a dialog (lazy: BroadcastControl only fetches when opened). ──
function BroadcastDialog({ eventId }: { eventId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconBroadcast className="size-4" />
          Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>What the overlay shows</DialogTitle>
        </DialogHeader>
        {/* Only mounts (and fetches) while the dialog is open. */}
        {open ? <BroadcastControl eventId={eventId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminLiveOverlaysPage() {
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
        if (!cancelled) setEvents(Array.isArray(data) ? data : (data.events ?? []));
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
    <div className="space-y-6">
      <PageHeader
        title="Live Overlays"
        description="Run the live leaderboard overlays. The browser source works in OBS, vMix, or any software that takes a Browser Source."
      />

      {/* ── AFC Capture software (download + how-to) ── */}
      <Card className="bg-card rounded-md border">
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
            <Button variant="outline" asChild>
              <Link href="/organizer/capture">Setup guide &amp; FAQ</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Per-event overlay controls ── */}
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
                      <CaptureKeyButton eventId={e.event_id} />
                      <CopyOverlayLinkDialog
                        eventId={e.event_id}
                        organizationId={orgId}
                      />
                      <BroadcastDialog eventId={e.event_id} />
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
