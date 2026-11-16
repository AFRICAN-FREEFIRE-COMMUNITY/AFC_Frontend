"use client";

// ── BroadcastKitCard (owner 2026-07-03) ─────────────────────────────────────────
// One-click download of the Free Fire PC client-side broadcast files, already customized to this
// event. Shows a readiness table (which teams have an assigned letter + logo, per-player UID/image
// coverage) so the operator knows what will end up in the zip, plus optional caster name + billboard
// / skybox uploads. DATA: GET  events/<id>/broadcast-kit/ (summary) and POST .../download/ (the zip)
// - afc_tournament_and_scrims/views_broadcast_kit.py, gated by _broadcast_gate (admin OR organizer
// with can_edit_events). Team letters are assigned on the Registered Teams tab (assigned_letter).
// Mounted by EventOverlayStudio (admin + organizer overlay studio).
//
// STAGE + LOBBY PICKERS (AFC inbox #602, owner 2026-11-16): letters are now distinct per LOBBY, so
// two lobbies of one stage may share a letter, and each team's flag file is NAMED after its letter.
// A stage-wide zip could then hold two logos under one name. Picking a stage sends stage_id (the zip
// uses that stage's letters); picking a lobby sends group_id too (only that lobby's teams), which is
// the zip an observer loads for one room. The summary's `stages` list feeds both pickers.

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";

import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UidInput } from "@/components/UidInput";
import { Label } from "@/components/ui/label";
import { IconDownload, IconLoader2, IconBroadcast } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewBadge } from "@/components/NewBadge";

type KitStage = { stage_id: number; stage_name: string; groups: { group_id: number; group_name: string }[] };

type TeamRow = {
  tournament_team_id: number;
  team_name: string;
  assigned_letter: string | null;
  headpic_id: string | null;
  has_logo: boolean;
  players: number;
  players_with_uid: number;
  players_with_image: number;
};

export function BroadcastKitCard({ eventId }: { eventId: number }) {
  const t = useTranslations("organizer");
  // The stage + lobby picker copy lives with the rest of the letters copy (evEditTabs, inbox #602).
  const lt = useTranslations("evEditTabs");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [casterName, setCasterName] = useState("");
  const [casterUid, setCasterUid] = useState("");
  const [billboard, setBillboard] = useState<File | null>(null);
  const [skybox, setSkybox] = useState<File | null>(null);
  const [stages, setStages] = useState<KitStage[]>([]);
  const [stageId, setStageId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);

  const base = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/broadcast-kit`;
  const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${base}/`, {
        headers: authHeaders(),
        params: { stage_id: stageId ?? undefined, group_id: groupId ?? undefined },
      });
      setTeams(res.data?.teams ?? []);
      setStages(res.data?.stages ?? []);
    } catch {
      /* best-effort: the card just shows no rows if the summary can't load */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stageId, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async () => {
    setDownloading(true);
    try {
      const fd = new FormData();
      if (casterName.trim()) fd.append("caster_name", casterName.trim());
      if (casterUid.trim()) fd.append("caster_uid", casterUid.trim());
      if (billboard) fd.append("billboard", billboard);
      if (skybox) fd.append("skybox", skybox);
      if (stageId != null) fd.append("stage_id", String(stageId));
      if (stageId != null && groupId != null) fd.append("group_id", String(groupId));
      const res = await axios.post(`${base}/download/`, fd, {
        headers: authHeaders(),
        responseType: "blob",
      });
      // Trigger a browser download of the returned zip.
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `broadcast-kit-${eventId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("broadcastKit.downloaded"));
    } catch {
      toast.error(t("broadcastKit.downloadFailed"));
    } finally {
      setDownloading(false);
    }
  };

  const missingLetter = teams.filter((x) => !x.assigned_letter).length;
  const missingLogo = teams.filter((x) => x.assigned_letter && !x.has_logo).length;

  return (
    <div className="rounded-md bg-card p-3">
      <div className="mb-1 flex items-center gap-2">
        <IconBroadcast className="text-primary size-4" />
        <h3 className="text-primary text-sm font-semibold">{t("broadcastKit.title")}</h3>
        <span className="text-muted-foreground ml-auto text-xs">
          {t("broadcastKit.summary", { teams: teams.length })}
        </span>
      </div>
      <p className="text-muted-foreground mb-3 text-xs">{t("broadcastKit.description")}</p>

      {/* Which stage and lobby the zip is for (inbox #602). */}
      {stages.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={stageId == null ? "__all__" : String(stageId)}
              onValueChange={(v) => {
                setStageId(v === "__all__" ? null : Number(v));
                setGroupId(null);
              }}
            >
              <SelectTrigger className="h-8 w-40 text-xs" aria-label={lt("registeredTeams.kitStageLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{lt("registeredTeams.kitStageAll")}</SelectItem>
                {stages.map((s) => (
                  <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                    {s.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(stages.find((s) => s.stage_id === stageId)?.groups.length ?? 0) > 0 && (
              <Select
                value={groupId == null ? "__all__" : String(groupId)}
                onValueChange={(v) => setGroupId(v === "__all__" ? null : Number(v))}
              >
                <SelectTrigger className="h-8 w-40 text-xs" aria-label={lt("registeredTeams.kitGroupLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{lt("registeredTeams.kitGroupAll")}</SelectItem>
                  {stages
                    .find((s) => s.stage_id === stageId)!
                    .groups.map((g) => (
                      <SelectItem key={g.group_id} value={String(g.group_id)}>
                        {g.group_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            <NewBadge since="2026-11-16" />
          </div>
          <p className="text-muted-foreground text-[0.7rem]">{lt("registeredTeams.kitGroupHint")}</p>
        </div>
      )}

      {/* Warnings the operator should fix (letters are set on the Registered Teams tab). */}
      {(missingLetter > 0 || missingLogo > 0) && (
        <div className="mb-3 rounded-md bg-amber-500/10 p-2 text-[0.7rem] text-amber-600">
          {missingLetter > 0 ? <p>{t("broadcastKit.warnLetters", { count: missingLetter })}</p> : null}
          {missingLogo > 0 ? <p>{t("broadcastKit.warnLogos", { count: missingLogo })}</p> : null}
        </div>
      )}

      {/* Readiness table. */}
      <div className="mb-3 max-h-56 overflow-x-auto overflow-y-auto rounded-md bg-muted/30">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="p-1.5">{t("broadcastKit.colTeam")}</th>
              <th className="p-1.5">{t("broadcastKit.colLetter")}</th>
              <th className="p-1.5">{t("broadcastKit.colLogo")}</th>
              <th className="p-1.5">{t("broadcastKit.colPlayers")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground p-3 text-center">
                  <IconLoader2 className="inline size-4 animate-spin" />
                </td>
              </tr>
            ) : teams.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground p-3 text-center italic">
                  {t("broadcastKit.noTeams")}
                </td>
              </tr>
            ) : (
              teams.map((x) => (
                <tr key={x.tournament_team_id} className="border-t">
                  <td className="p-1.5 font-medium">{x.team_name}</td>
                  <td className="p-1.5">
                    {x.assigned_letter ? (
                      <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[0.6rem]">
                        {x.assigned_letter} · {x.headpic_id}
                      </Badge>
                    ) : (
                      <span className="text-amber-500">{t("broadcastKit.none")}</span>
                    )}
                  </td>
                  <td className="p-1.5">{x.has_logo ? "✓" : <span className="text-amber-500">✗</span>}</td>
                  <td className="p-1.5 text-muted-foreground">
                    {x.players_with_uid}/{x.players} UID · {x.players_with_image} img
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Optional caster + broadcast art. */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[0.65rem]">{t("broadcastKit.casterName")}</Label>
          <Input value={casterName} onChange={(e) => setCasterName(e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[0.65rem]">{t("broadcastKit.casterUid")}</Label>
          <UidInput value={casterUid} onChange={(e) => setCasterUid(e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[0.65rem]">{t("broadcastKit.billboard")}</Label>
          <input type="file" accept="image/*" className="w-full text-[0.65rem]"
            onChange={(e) => setBillboard(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[0.65rem]">{t("broadcastKit.skybox")}</Label>
          <input type="file" accept="image/*" className="w-full text-[0.65rem]"
            onChange={(e) => setSkybox(e.target.files?.[0] ?? null)} />
        </div>
      </div>

      <Button size="sm" onClick={download} disabled={downloading || teams.length === 0}>
        {downloading ? <IconLoader2 className="mr-1 size-4 animate-spin" /> : <IconDownload className="mr-1 size-4" />}
        {t("broadcastKit.download")}
      </Button>
    </div>
  );
}
