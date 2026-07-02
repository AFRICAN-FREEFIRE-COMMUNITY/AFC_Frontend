"use client";

// ── Organizer · Live Overlays · EVENT STUDIO (/organizer/overlays/[eventId]) ──
// Thin wrapper mounting the SHARED <EventOverlayStudio> for ONE of THIS org's events (owner
// 2026-07-02: organizers get the studio "gated only to each of their designs and data"):
//   • the event list here is fetched org-scoped, and an event that isn't the org's shows a notice
//     (defence-in-depth: every backend write is ALSO gated - views_overlays._broadcast_gate requires
//     the org to can_edit_events on the event's org, so a forged URL cannot touch foreign data);
//   • the design library inside the studio is scoped to organizationId → only THEIR designs.
// i18n: organizer surface → the shared component's organizer.studio.* keys.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import axios from "axios";

import { FullLoader } from "@/components/Loader";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizer } from "@/app/(organizer)/organizer/_components/OrganizerContext";
import { EventOverlayStudio } from "@/components/overlay/EventOverlayStudio";
import { useLiveTick } from "@/hooks/useLiveTick";

export default function OrganizerEventOverlayStudioPage() {
  const t = useTranslations("organizer");
  const { token } = useAuth();
  const { membership } = useOrganizer();
  const organizationId = membership?.organization?.organization_id ?? null;

  const params = useParams<{ eventId: string }>();
  const eventId = Number(params?.eventId);

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState("");
  const [belongsToOrg, setBelongsToOrg] = useState(false);

  // Live refresh (owner 2026-07-02): re-run the read-only name/ownership resolve on the site-wide
  // tick (picks up an event rename without a manual reload). `loading` only starts true, so no
  // FullLoader flash; errors only toast on the initial load (tick 0).
  const tick = useLiveTick();

  useEffect(() => {
    if (!token || !eventId || !organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        // Org-scoped fetch: the event only resolves when it is THIS org's.
        const res = await axios.get<{ events?: any[] } | any[]>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { organization_id: organizationId },
          },
        );
        const rows = Array.isArray(res.data) ? res.data : (res.data.events ?? []);
        const ev = rows.find((e: any) => Number(e.event_id) === eventId);
        if (!cancelled) {
          setBelongsToOrg(!!ev);
          setEventName(ev?.event_name || `Event ${eventId}`);
        }
      } catch {
        if (!cancelled && tick === 0) toast.error(t("studio.loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, eventId, organizationId, t, tick]);

  if (loading) return <FullLoader />;

  if (!belongsToOrg) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {t("studio.notYourEvent")}
      </p>
    );
  }

  return (
    <EventOverlayStudio
      eventId={eventId}
      eventName={eventName}
      organizationId={organizationId}
      backHref="/organizer/overlays"
      leaderboardHref={null}
    />
  );
}
