"use client";

// ── Admin · Live Overlays · EVENT STUDIO (/a/overlays/[eventId]) ─────────────
// Thin wrapper: resolves the event's name + owning org (get-all-events, Bearer admin), then mounts
// the SHARED <EventOverlayStudio> (components/overlay/EventOverlayStudio.tsx) — the same studio the
// organizer portal mounts at /organizer/overlays/[eventId], org-gated there. All behaviour +
// strings live in the shared component (organizer.studio.* i18n keys; admins read the English).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";

import { FullLoader } from "@/components/Loader";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { EventOverlayStudio } from "@/components/overlay/EventOverlayStudio";

export default function AdminEventOverlayStudioPage() {
  const { token } = useAuth();
  const params = useParams<{ eventId: string }>();
  const eventId = Number(params?.eventId);

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState("");
  const [orgId, setOrgId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ events?: any[] } | any[]>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const rows = Array.isArray(res.data) ? res.data : (res.data.events ?? []);
        const ev = rows.find((e: any) => Number(e.event_id) === eventId);
        if (!cancelled) {
          setEventName(ev?.event_name || `Event ${eventId}`);
          setOrgId(ev?.organization ?? ev?.organization_id ?? null);
        }
      } catch {
        if (!cancelled) toast.error("Could not load the event.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, eventId]);

  if (loading) return <FullLoader />;

  return (
    <EventOverlayStudio
      eventId={eventId}
      eventName={eventName}
      organizationId={orgId}
      backHref="/a/overlays"
      leaderboardHref={`/a/leaderboards/${eventId}/edit`}
    />
  );
}
