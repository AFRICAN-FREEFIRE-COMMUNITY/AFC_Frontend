"use client";
// ─────────────────────────────────────────────────────────────────────────────
// QualifiedFromBanner  ·  public provenance banner (event linking P2).
//
// On the PUBLIC tournament page, shows where part of this event's field came
// from: "top N from <stage> of <source event>" plus the qualifier names, for
// every FIRED inbound qualification link. Renders nothing when the event has
// no fired inbound links (the overwhelmingly common case), so it is safe to
// mount unconditionally.
//
// DATA: GET /events/<event_id>/links/public/ (afc_tournament_and_scrims/
// event_links.py public_inbound_links, NO auth - only promoted/replaced names
// are exposed, pending/declined slots stay private).
// CONSUMED BY: app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import axios from "axios";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IconTrophy } from "@tabler/icons-react";
import { env } from "@/lib/env";

interface InboundRow {
  source_event_name: string;
  source_event_id: number;
  source_stage_name: string;
  qualify_count: number;
  qualifiers: string[];
}

export function QualifiedFromBanner({ eventId }: { eventId: number }) {
  const [rows, setRows] = useState<InboundRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/links/public/`,
        );
        if (!cancelled) setRows(res.data?.results ?? []);
      } catch {
        // Public decoration only: failure just means no banner.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (rows.length === 0) return null;

  return (
    <Card className="border-gold/40 bg-gold/5">
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gold">
          <IconTrophy className="size-4" /> Qualified field
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">
              Top {r.qualify_count} from {r.source_stage_name} of
            </span>
            <b>{r.source_event_name}</b>
            {r.qualifiers.map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
              >
                {name}
              </Badge>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
