"use client";

/**
 * PendingCapturesPanel — admin/organizer resolver for "decide later" capture uploads (complaint D).
 *
 * When the desktop AFC Capture client has an EXTRA game (every configured map slot for a group is
 * already scored) the operator can choose "decide later", which parks the raw upload server-side
 * (afc_tournament_and_scrims.PendingCaptureUpload) instead of inventing a phantom map. This panel lists
 * those parked uploads for an event and lets an admin/organizer:
 *   • RESOLVE one — score it into a chosen group as a NEW map or as a REPLACEMENT of an existing map
 *     (runs the SAME scoring path a live upload uses), or
 *   • DISCARD one — drop a genuine mis-capture (wrong event, duplicate run).
 * Each action calls lib/pendingCaptures then refetches + calls onChanged() so the parent reloads the
 * standings. Mounted on the admin event leaderboard editor's Flagging tab (app/(a)/a/leaderboards/[id]/
 * edit). Admin (a)/ surface -> i18n-exempt (English copy). No pending captures -> renders nothing.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { IconInbox, IconAlertTriangle } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  pendingCapturesApi,
  PendingCapture,
  PendingStage,
  PendingGroup,
} from "@/lib/pendingCaptures";

type Props = {
  eventId: number | string;
  token: string | null;
  /** Whether the viewer may resolve/discard (admins + organizers with can_upload_results). */
  canManage?: boolean;
  /** Called after any successful change so the parent can refetch the standings. */
  onChanged?: () => void;
};

// Per-row resolve draft (which group + new/replace + which slot to replace).
type Draft = { groupId: string; mode: "new" | "replace"; matchId: string };

export function PendingCapturesPanel({ eventId, token, canManage = true, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingCapture[]>([]);
  const [stages, setStages] = useState<PendingStage[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);

  // Flat group lookup so a row can resolve its chosen group's existing map slots for the Replace picker.
  const groupsById = useMemo(() => {
    const map: Record<string, PendingGroup> = {};
    for (const s of stages) for (const g of s.groups) map[String(g.group_id)] = g;
    return map;
  }, [stages]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await pendingCapturesApi.list(eventId, token);
      setPending(r.pending);
      setStages(r.stages ?? []);
      // Seed each row's draft: default the target group to the client's set group, mode "new".
      setDrafts((prev) => {
        const next: Record<number, Draft> = {};
        for (const p of r.pending) {
          next[p.id] = prev[p.id] ?? {
            groupId: p.group_id ? String(p.group_id) : "",
            mode: "new",
            matchId: "",
          };
        }
        return next;
      });
    } catch {
      toast.error("Failed to load pending captures.");
    } finally {
      setLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => { load(); }, [load]);

  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const onResolve = async (p: PendingCapture) => {
    if (!token || busy) return;
    const d = drafts[p.id];
    if (!d || !d.groupId) {
      toast.error("Pick a target group first.");
      return;
    }
    let attribution = "new";
    if (d.mode === "replace") {
      if (!d.matchId) {
        toast.error("Pick which map to replace.");
        return;
      }
      attribution = `replace:${d.matchId}`;
    }
    setBusy(true);
    try {
      await pendingCapturesApi.resolve(
        eventId,
        p.id,
        { attribution, group_id: Number(d.groupId) },
        token,
      );
      toast.success("Capture scored.");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve capture.");
    } finally {
      setBusy(false);
    }
  };

  const onDiscard = async (p: PendingCapture) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await pendingCapturesApi.discard(eventId, p.id, token);
      toast.success("Capture discarded.");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to discard capture.");
    } finally {
      setBusy(false);
    }
  };

  // Nothing to show (still loading, or no parked captures) -> stay out of the way.
  if (loading || pending.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <IconInbox className="size-4 text-orange-400" />
          Pending captures
          <Badge variant="outline" className="rounded-full border-orange-500/40 px-2 py-0.5 text-[10px] text-orange-400">
            {pending.length}
          </Badge>
        </CardTitle>
        <p className="mt-1 max-w-xl text-xs text-muted-foreground">
          Extra games the capture client could not auto-attribute (all map slots were already scored).
          Score each as a new or replacement map, or discard a genuine mis-capture.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {pending.map((p) => {
            const d = drafts[p.id] ?? { groupId: "", mode: "new" as const, matchId: "" };
            const slots = d.groupId ? groupsById[d.groupId]?.match_slots ?? [] : [];
            const teams = p.summary?.teams ?? [];
            return (
              <div key={p.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{p.file_name || "MatchResult.log"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Sent for {p.stage_name ?? "stage ?"} / {p.group_name ?? "group ?"}
                      {p.uploaded_by ? ` by ${p.uploaded_by}` : ""}
                      {" · "}
                      {p.summary?.team_count ?? teams.length} teams, {p.summary?.player_count ?? 0} players
                    </div>
                    {teams.length > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {teams
                          .slice(0, 6)
                          .map((t) => `#${t.placement} ${t.team_name} (${t.kills}k)`)
                          .join(" · ")}
                        {teams.length > 6 ? " ..." : ""}
                      </div>
                    )}
                  </div>
                </div>

                {/* Resolve controls: target group + new/replace + (replace) which map. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    value={d.groupId}
                    onValueChange={(v) => setDraft(p.id, { groupId: v, matchId: "" })}
                    disabled={!canManage || busy}
                  >
                    <SelectTrigger className="h-8 w-[190px] text-xs">
                      <SelectValue placeholder="Target group" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) =>
                        s.groups.map((g) => (
                          <SelectItem key={g.group_id} value={String(g.group_id)}>
                            {s.stage_name} / {g.group_name}
                          </SelectItem>
                        )),
                      )}
                    </SelectContent>
                  </Select>

                  <Select
                    value={d.mode}
                    onValueChange={(v) => setDraft(p.id, { mode: v as "new" | "replace", matchId: "" })}
                    disabled={!canManage || busy}
                  >
                    <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New map</SelectItem>
                      <SelectItem value="replace">Replace map</SelectItem>
                    </SelectContent>
                  </Select>

                  {d.mode === "replace" && (
                    <Select
                      value={d.matchId}
                      onValueChange={(v) => setDraft(p.id, { matchId: v })}
                      disabled={!canManage || busy || slots.length === 0}
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder="Which map" />
                      </SelectTrigger>
                      <SelectContent>
                        {slots.map((sl, i) => (
                          <SelectItem key={sl.match_id} value={String(sl.match_id)}>
                            {`Map ${i + 1}${sl.map ? ` (${sl.map})` : ""}${sl.scored ? "" : " - empty"}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button size="sm" className="h-8 text-xs" onClick={() => onResolve(p)} disabled={!canManage || busy}>
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => onDiscard(p)}
                    disabled={!canManage || busy}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
          <IconAlertTriangle className="size-3" />
          Resolving runs the same scoring as a normal upload. Discard only when the game is a genuine mis-capture.
        </div>
      </CardContent>
    </Card>
  );
}
