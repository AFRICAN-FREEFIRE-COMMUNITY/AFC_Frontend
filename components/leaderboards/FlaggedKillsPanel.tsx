"use client";

/**
 * FlaggedKillsPanel — admin/organizer control for "ringer" kills on an event leaderboard.
 *
 * A flagged player is a Free Fire UID that a match-log FILE upload credited to a team it is NOT
 * rostered on (afc_tournament_and_scrims.MatchKillFlag). This panel shows the event-wide
 * "count flagged kills" default plus every flagged player, and lets an admin or organizer:
 *   • flip the event default (Switch) — count vs drop ALL flagged kills, or
 *   • override one player (Select: Follow / Count / Do not count).
 * Each change PATCHes the backend (lib/flaggedKills) which recomputes the team totals, then we
 * refetch + call onChanged() so the parent reloads the standings. Mounted on the admin event
 * leaderboard (app/(a)/a/leaderboards/[id]) and the organizer one
 * (app/(organizer)/organizer/events/[slug]/leaderboard). i18n namespace: "flaggedKills".
 */
import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconFlag, IconAlertTriangle } from "@tabler/icons-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { flaggedKillsApi, FlaggedKill } from "@/lib/flaggedKills";

type Props = {
  eventId: number | string;
  token: string | null;
  /** Whether the viewer may change the controls (admins + organizers with can_upload_results). */
  canManage?: boolean;
  /** Called after any successful change so the parent can refetch the standings. */
  onChanged?: () => void;
};

// Map the per-flag override (count_kills: null|true|false) to/from the Select value.
const toSel = (v: boolean | null) => (v === null ? "default" : v ? "count" : "exclude");
const fromSel = (v: string): boolean | null => (v === "default" ? null : v === "count");

export function FlaggedKillsPanel({ eventId, token, canManage = true, onChanged }: Props) {
  const t = useTranslations("flaggedKills");
  const [loading, setLoading] = useState(true);
  const [defaultOn, setDefaultOn] = useState(true);
  const [flags, setFlags] = useState<FlaggedKill[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await flaggedKillsApi.get(eventId, token);
      setDefaultOn(r.count_flagged_kills);
      setFlags(r.flags);
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [eventId, token, t]);

  useEffect(() => { load(); }, [load]);

  const afterChange = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const onToggleDefault = async (next: boolean) => {
    if (!token || busy) return;
    setBusy(true);
    setDefaultOn(next); // optimistic
    try {
      await flaggedKillsApi.setEventDefault(eventId, next, token);
      toast.success(t("updated"));
      await afterChange();
    } catch {
      setDefaultOn(!next); // revert
      toast.error(t("updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onChangeFlag = async (flag: FlaggedKill, sel: string) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await flaggedKillsApi.setFlag(flag.flag_id, fromSel(sel), token);
      toast.success(t("updated"));
      await afterChange();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Don't render anything until we know whether there's something to manage. We DO show the panel
  // (with just the toggle) even when there are no flags, so the default can be pre-set.
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">{t("loading")}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconFlag className="size-4 text-orange-400" />
              {t("title")}
              {flags.length > 0 && (
                <Badge variant="outline" className="rounded-full border-orange-500/40 px-2 py-0.5 text-[10px] text-orange-400">
                  {t("flaggedBadge", { count: flags.length })}
                </Badge>
              )}
            </CardTitle>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          {/* Event-wide default toggle */}
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium">{t("countAllLabel")}</span>
            <Switch checked={defaultOn} onCheckedChange={onToggleDefault} disabled={!canManage || busy} />
          </label>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {defaultOn ? t("countAllHintOn") : t("countAllHintOff")}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {flags.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <IconAlertTriangle className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{t("noFlags")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("noFlagsHint")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t("colPlayer")}</TableHead>
                <TableHead className="text-xs">{t("colTeam")}</TableHead>
                <TableHead className="text-right text-xs">{t("colKills")}</TableHead>
                <TableHead className="text-xs">{t("colReason")}</TableHead>
                <TableHead className="text-xs">{t("colCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((f) => (
                <TableRow key={f.flag_id}>
                  <TableCell className="py-2">
                    <div className="text-xs font-medium">{f.name || f.uid}</div>
                    <div className="text-[10px] text-muted-foreground">
                      UID {f.uid}
                      {f.registered_username ? ` · ${t("registeredAs", { name: f.registered_username })}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-xs">{f.team_name ?? "-"}</TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums">{f.kills}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                      {f.reason === "not_on_roster" ? t("reasonNotOnRoster") : t("reasonOtherTeam")}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={toSel(f.count_kills)}
                        onValueChange={(v) => onChangeFlag(f, v)}
                        disabled={!canManage || busy}
                      >
                        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">{t("optDefault")}</SelectItem>
                          <SelectItem value="count">{t("optCount")}</SelectItem>
                          <SelectItem value="exclude">{t("optExclude")}</SelectItem>
                        </SelectContent>
                      </Select>
                      {/* Resolved state badge: does this player's kills count right now? */}
                      <Badge
                        variant="outline"
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] " +
                          (f.effective_count
                            ? "border-green-500/40 text-green-400"
                            : "border-muted-foreground/30 text-muted-foreground")
                        }
                      >
                        {f.effective_count ? t("counting") : t("excluded")}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
