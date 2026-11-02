"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LiveKillOverlaysCard: the overlay studio's card for the two kill data overlays (inbox #398 kill stats
// overlay, #421b player duel overlay). It builds the Browser Source links and nothing else: the overlays
// themselves are app/overlay/kill-stats/[slug] and app/overlay/duel/[slug], and they read AFC-B
// GET events/kill-stats/ on their own.
//   * Kill stats overlay: pick a board (rotating, sniper kills, team head to head, who killed whom), copy the link.
//   * Player duel overlay: pick two players of this event (the names the kill data holds), copy the link.
// The links carry the event slug and player usernames only, never ids (owner rule R22).
// The overlays stay blank until the event's kill stats "Live overlays" switch is on (event settings, Basic
// info); this card says so while it is off. Mounted by components/overlay/EventOverlayStudio.tsx, which the
// admin (/a/overlays/[eventId]) and organizer (/organizer/overlays/[eventId]) pages share.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconCopy, IconExternalLink } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NewBadge } from "@/components/NewBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { killStatsApi, type KillStats } from "@/lib/killStats";
import { duelists } from "@/lib/killDuel";

// The day the two overlays went live (NewBadge keeps itself for 5 days).
const NEW_SINCE = "2026-11-02";
const VIEWS = ["auto", "sniper", "teams", "players"] as const;

export function LiveKillOverlaysCard({ eventSlug }: { eventSlug: string }) {
  const t = useTranslations("killOverlay");
  const [stats, setStats] = useState<KillStats | null>(null);
  const [view, setView] = useState<(typeof VIEWS)[number]>("auto");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  // The same read the overlays make. Organizers and admins may read it while the switch is still off.
  useEffect(() => {
    if (!eventSlug) return;
    let alive = true;
    killStatsApi
      .get(eventSlug, null)
      .then((d) => alive && setStats(d))
      .catch(() => alive && setStats(null));
    return () => {
      alive = false;
    };
  }, [eventSlug]);

  const players = useMemo(() => (stats ? duelists(stats) : []), [stats]);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const statsUrl = `${origin}/overlay/kill-stats/${eventSlug}${view === "auto" ? "" : `?view=${view}`}`;
  const duelUrl =
    a && b && a !== b
      ? `${origin}/overlay/duel/${eventSlug}?${new URLSearchParams({ a, b }).toString()}`
      : "";

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const playerSelect = (value: string, set: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {players.map((p) => (
          <SelectItem key={p.uid} value={p.name}>
            {p.name}
            {p.team ? ` (${p.team})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card data-tour="studio-kill-overlays">
      <CardContent className="space-y-5">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold">
            {t("studioTitle")}
            <NewBadge since={NEW_SINCE} />
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{t("studioLead")}</p>
          {stats && !stats.switches.overlay ? (
            <p className="bg-muted mt-3 rounded-md px-3 py-2 text-xs">{t("switchOff")}</p>
          ) : null}
        </div>

        {/* ── kill stats overlay ── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("statsHeading")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={view} onValueChange={(v) => setView(v as (typeof VIEWS)[number])}>
              <SelectTrigger className="w-56" aria-label={t("statsHeading")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEWS.map((v) => (
                  <SelectItem key={v} value={v}>{t(`view.${v}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => copy(statsUrl)}>
              <IconCopy className="size-4" />
              {t("copyLink")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={statsUrl} target="_blank" rel="noreferrer">
                <IconExternalLink className="size-4" />
                {t("preview")}
              </a>
            </Button>
          </div>
        </div>

        {/* ── player duel overlay ── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("duelHeading")}</p>
          {players.length < 2 ? (
            <p className="text-muted-foreground text-xs">{t("noPlayers")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {playerSelect(a, setA, t("playerA"))}
              {playerSelect(b, setB, t("playerB"))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={!duelUrl} onClick={() => copy(duelUrl)}>
              <IconCopy className="size-4" />
              {t("copyLink")}
            </Button>
            {duelUrl ? (
              <Button size="sm" variant="outline" asChild>
                <a href={duelUrl} target="_blank" rel="noreferrer">
                  <IconExternalLink className="size-4" />
                  {t("preview")}
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                <IconExternalLink className="size-4" />
                {t("preview")}
              </Button>
            )}
          </div>
        </div>

        <p className="text-muted-foreground text-xs">{t("sourceHint")}</p>
      </CardContent>
    </Card>
  );
}
