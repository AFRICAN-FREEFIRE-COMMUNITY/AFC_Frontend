"use client";

// ── Organizer · Live Overlays list (/organizer/overlays) ─────────────────────
// The organizer's entry into the overlay studio (owner 2026-07-02: "give organizers studio also,
// gated only to each of their designs and data"). Lists ONLY this org's events
// (get-all-events?organization_id=<their org>); opening one mounts the shared studio, whose design
// library is org-scoped and whose backend writes are gated to orgs that can_edit_events the event.
// i18n: organizer surface → organizer.studio.* keys (en → fr/pt via pnpm i18n:translate).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import axios from "axios";

import { PageHeader } from "@/components/PageHeader";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconBroadcast, IconChevronRight } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "@/app/(organizer)/organizer/_components/OrganizerContext";
import { useLiveTick } from "@/hooks/useLiveTick";

interface EventRow {
  event_id: number;
  event_name: string;
  event_status?: string;
}

export default function OrganizerOverlaysListPage() {
  const t = useTranslations("organizer");
  const { token } = useAuth();
  const { membership } = useOrganizer();
  const organizationId = membership?.organization?.organization_id;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Live refresh (owner 2026-07-02): re-run the read-only org events fetch on the site-wide tick.
  // `loading` only starts true (never reset), so background refreshes don't flash the FullLoader;
  // errors only toast on the initial load (tick 0). The search box `q` filters client-side, so it
  // is untouched by a background refetch.
  const tick = useLiveTick();

  useEffect(() => {
    if (!token || !organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        // ONLY this org's events - the same org-scoping the capture + leaderboards pages use.
        const res = await axios.get<{ events?: EventRow[] } | EventRow[]>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { organization_id: organizationId },
          },
        );
        const data = res.data as { events?: EventRow[] } | EventRow[];
        if (!cancelled) setEvents(Array.isArray(data) ? data : (data.events ?? []));
      } catch {
        if (!cancelled && tick === 0) toast.error(t("studio.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, organizationId, t, tick]);

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
        title={t("studio.listTitle")}
        description={t("studio.listDescription")}
      />

      <Card className="bg-card rounded-md border" data-tour="org-overlays-list">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <IconBroadcast className="text-primary size-5" />
            <Input
              placeholder={t("studio.searchEvents")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="divide-border divide-y">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t("studio.noEvents")}
              </p>
            ) : (
              filtered.map((e) => (
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
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/organizer/overlays/${e.event_id}`}>
                      {t("studio.openOverlays")}
                      <IconChevronRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
