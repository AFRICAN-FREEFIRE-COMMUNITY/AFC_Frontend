"use client";

// ── CheckinCard (owner 2026-07-04) ───────────────────────────────────────────────
// User-facing check-in for an event. When the organizer has turned check-in on and this user is
// registered, they must tap "Check in" inside the window to stay eligible; a squad is eligible only
// when EVERY roster member checks in, and anyone who does not is relegated to the waitlist. Shows the
// window (in the viewer's timezone via LocalTime), the user's own state, and - for a squad - how many
// teammates have checked in. DATA: GET events/checkin/status/?event_id= + POST events/checkin/
// (afc_tournament_and_scrims/views_checkin.py). Mounted by EventDetailsWrapper in the registered block.

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import Cookies from "js-cookie";
import { env } from "@/lib/env";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/LocalTime";
import { IconUserCheck, IconLoader2, IconClock, IconCircleCheck } from "@tabler/icons-react";

interface Me {
  registered: boolean;
  checked_in: boolean;
  is_squad: boolean;
  roster_total?: number;
  roster_checked_in?: number;
  team_eligible?: boolean;
}

export function CheckinCard({ eventId }: { eventId: number }) {
  const t = useTranslations("events");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events`;

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${base}/checkin/status/?event_id=${eventId}`, { headers: authHeaders() });
      const d = r.data ?? {};
      setEnabled(!!d.checkin_enabled);
      setWindowOpen(!!d.window_open);
      setStart(d.checkin_start ?? null);
      setEnd(d.checkin_end ?? null);
      setMe(d.me ?? null);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = async () => {
    setBusy(true);
    try {
      await axios.post(`${base}/checkin/`, { event_id: eventId }, { headers: authHeaders() });
      toast.success(t("checkin.userCheckedIn"));
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("checkin.userFailed"));
    } finally {
      setBusy(false);
    }
  };

  // ── who sees this card ──
  // Anyone, once check-in is enabled (owner 2026-08-04: "if check-in is enabled for an event let
  // it show on the event page, check-in date and time etc"). It used to render ONLY for a
  // registered user, which meant the one group who most needed the information, people deciding
  // whether to enter, could not see that this event demands a check-in at all. A competitor who
  // registers without noticing is exactly who ends up relegated to the waitlist for missing it.
  //
  // What differs by viewer is the ACTION, not the information: the window and the explanation are
  // public, while the button, the squad progress and the personal status need a registration.
  if (loading || !enabled) return null;

  const registered = !!me?.registered;
  const checkedIn = !!me?.checked_in;
  const notOpenYet = !windowOpen && !!start && new Date(start).getTime() > Date.now();
  const closed = !windowOpen && !!end && new Date(end).getTime() < Date.now();

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <IconUserCheck className="text-primary size-5" />
          <p className="font-semibold">{t("checkin.userTitle")}</p>
          {registered && checkedIn ? (
            <Badge variant="outline" className="ml-auto border-green-600/60 text-green-500">
              <IconCircleCheck className="mr-1 size-3" /> {t("checkin.userDone")}
            </Badge>
          ) : registered && windowOpen ? (
            <Badge variant="outline" className="ml-auto border-green-600/60 text-green-500">{t("checkin.userOpen")}</Badge>
          ) : null}
        </div>

        <p className="text-muted-foreground text-sm">{t("checkin.userExplain")}</p>

        {/* Window in the viewer's timezone. */}
        {(start || end) && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
            <IconClock className="size-3" />
            {start ? <LocalTime value={start} /> : null}
            {start && end ? <span>-</span> : null}
            {end ? <LocalTime value={end} /> : null}
          </p>
        )}

        {/* Squad progress. */}
        {registered && me?.is_squad && typeof me.roster_total === "number" && (
          <p className="text-xs">
            {t("checkin.userSquadProgress", { done: me.roster_checked_in ?? 0, total: me.roster_total })}{" "}
            {me.team_eligible ? (
              <span className="text-green-500">{t("checkin.userSquadReady")}</span>
            ) : (
              <span className="text-amber-500">{t("checkin.userSquadWaiting")}</span>
            )}
          </p>
        )}

        {registered && !checkedIn && windowOpen && (
          <Button size="sm" onClick={checkIn} disabled={busy}>
            {busy ? <IconLoader2 className="mr-1 size-4 animate-spin" /> : <IconUserCheck className="mr-1 size-4" />}
            {t("checkin.userButton")}
          </Button>
        )}
        {registered && !checkedIn && notOpenYet && <p className="text-muted-foreground text-xs">{t("checkin.userNotOpen")}</p>}
        {registered && !checkedIn && closed && <p className="text-amber-500 text-xs">{t("checkin.userClosed")}</p>}
      </CardContent>
    </Card>
  );
}
