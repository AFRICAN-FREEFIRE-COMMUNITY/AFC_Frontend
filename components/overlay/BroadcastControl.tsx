"use client";

// ─────────────────────────────────────────────────────────────────────────────
// BroadcastControl - "what does the live overlay show?" switch (owner 2026-07-01).
// ----------------------------------------------------------------------------
// PURPOSE
//   Lets an organizer/admin choose ON THE WEBSITE which stage/group the live OBS
//   overlay renders, and combine groups/stages into a CUMULATIVE, WITHOUT touching
//   OBS. There is ONE overlay link (built by CopyOverlayLinkDialog with its "Follow
//   the site's broadcast selection" switch ON, i.e. NO stage/group in the URL); this
//   control is what the organizer clicks to swap what that single link shows live.
//
// HOW IT CONNECTS
//   • Reads/writes the event's broadcast selection via lib/overlay.broadcastApi:
//       GET  events/<eventId>/broadcast/      -> current selection + stage/group tree
//       POST events/<eventId>/broadcast/set/  -> persists the chosen selection
//     (both Bearer + org/event-admin gated). See lib/overlay.ts for the contract.
//   • The overlay feed (events/overlay/feed/) resolves THIS selection whenever its URL
//     omits stage & group, so a "follow broadcast" overlay link tracks whatever is set
//     here and picks the change up within ONE self-poll - no OBS change, no re-copy.
//     (app/overlay/leaderboard/[token]/page.tsx polls fetchOverlayFeed on an interval.)
//
// MOUNTED ON
//   • Admin event leaderboard edit page:  app/(a)/a/leaderboards/[id]/edit/page.tsx
//     (beside the "Copy OBS overlay link" dialog in the header row).
//   • Organizer event leaderboard page:   app/(organizer)/organizer/events/[slug]/leaderboard/page.tsx.
//
// i18n: organizer-facing, keys under the "organizer" namespace (broadcast.*). The admin
// (a)/ mount is i18n-exempt but the shared NextIntl provider still resolves these keys
// there (same as CopyOverlayLinkDialog).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconBroadcast, IconLoader2 } from "@tabler/icons-react";
import {
  broadcastApi,
  type BroadcastScope,
  type BroadcastSelection,
  type BroadcastStage,
} from "@/lib/overlay";

interface BroadcastControlProps {
  // The NUMERIC event id (the broadcast endpoints are event-scoped). Both host pages already
  // have this: the admin page from its [id] route param, the organizer page from its resolved slug.
  eventId: number | string;
  // The owning org (informational only here - the endpoints authorise off the event + the caller's
  // org/event-admin rights server-side, so no per-call scoping is needed). Kept for parity with
  // CopyOverlayLinkDialog and to make the mount sites read the same.
  organizationId?: number | null;
}

export function BroadcastControl({ eventId }: BroadcastControlProps) {
  const t = useTranslations("organizer");

  // ── Server state ──────────────────────────────────────────────────────────
  // `saved` is the selection currently LIVE on the overlay (from the last GET / successful Set);
  // it drives the "Live: ..." status line. `stages` is the event's stage/group tree for the pickers.
  const [stages, setStages] = useState<BroadcastStage[]>([]);
  const [saved, setSaved] = useState<BroadcastSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Form state (what the user is about to Set) ─────────────────────────────
  const [scope, setScope] = useState<BroadcastScope>("group");
  const [selStage, setSelStage] = useState<string>("");
  const [selGroup, setSelGroup] = useState<string>("");
  const [customGroupIds, setCustomGroupIds] = useState<number[]>([]);

  // ── Load the current selection + structure on mount / event change. ────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await broadcastApi.get(eventId);
      setStages(data.stages ?? []);
      setSaved(data);
      // Seed the form from whatever is currently live so the control opens showing reality.
      setScope(data.scope ?? "group");
      setSelStage(
        data.stage_id != null
          ? String(data.stage_id)
          : String(data.stages?.[0]?.stage_id ?? ""),
      );
      setSelGroup(data.group_id != null ? String(data.group_id) : "");
      setCustomGroupIds(data.group_ids ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("broadcast.loadError"));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Groups of the currently-selected stage (drives the Group <Select> for scope="group").
  const stageGroups = useMemo(
    () => stages.find((s) => String(s.stage_id) === selStage)?.groups ?? [],
    [stages, selStage],
  );

  // Every group in the event, flattened + labelled "Stage / Group" (drives the custom checkbox list).
  const allGroups = useMemo(
    () =>
      stages.flatMap((s) =>
        s.groups.map((g) => ({
          group_id: g.group_id,
          label: `${s.stage_name} / ${g.group_name}`,
        })),
      ),
    [stages],
  );

  // When the stage changes under scope="group", default the group to the stage's first group so the
  // Set button is immediately valid (mirrors the export/overlay dialogs resetting group on stage change).
  const onStageChange = (v: string) => {
    setSelStage(v);
    const first = stages.find((s) => String(s.stage_id) === v)?.groups?.[0];
    setSelGroup(first ? String(first.group_id) : "");
  };

  const toggleCustomGroup = (groupId: number, on: boolean) =>
    setCustomGroupIds((prev) =>
      on ? [...new Set([...prev, groupId])] : prev.filter((id) => id !== groupId),
    );

  // ── Human-readable description of a selection (for the "Live: ..." status line). ──
  // Uses the same scope labels the Select shows, then appends the stage/group name(s) so the organizer
  // can read exactly what is on air. No em/en dashes (AFC copy rule) - names are joined with " / ".
  const describe = useCallback(
    (sel: BroadcastSelection | null): string => {
      if (!sel) return "";
      const scopeLabel = t(`broadcast.scope.${sel.scope}`);
      const stage = stages.find((s) => s.stage_id === sel.stage_id);
      if (sel.scope === "group") {
        const group = stage?.groups.find((g) => g.group_id === sel.group_id);
        const name = [stage?.stage_name, group?.group_name]
          .filter(Boolean)
          .join(" / ");
        return name ? `${scopeLabel}: ${name}` : scopeLabel;
      }
      if (sel.scope === "stage") {
        return stage?.stage_name ? `${scopeLabel}: ${stage.stage_name}` : scopeLabel;
      }
      if (sel.scope === "custom") {
        return `${scopeLabel} (${t("broadcast.groupCount", {
          count: sel.group_ids?.length ?? 0,
        })})`;
      }
      return scopeLabel; // event-wide cumulative needs no extra qualifier
    },
    [stages, t],
  );

  // Is the current form a valid, submittable selection for its scope?
  const canSet = useMemo(() => {
    if (scope === "group") return !!selStage && !!selGroup;
    if (scope === "stage") return !!selStage;
    if (scope === "custom") return customGroupIds.length > 0;
    return true; // event-wide always valid
  }, [scope, selStage, selGroup, customGroupIds]);

  // When Set-live is disabled, say EXACTLY what's still needed (owner 2026-07-02: "are there
  // conditions set for it... it should say"). Empty string once the selection is ready.
  const setLiveHint = useMemo(() => {
    if (canSet) return "";
    if (scope === "group") return t("broadcast.needStageGroup");
    if (scope === "stage") return t("broadcast.needStage");
    if (scope === "custom") return t("broadcast.needCustomGroups");
    return "";
  }, [canSet, scope, t]);

  // ── Persist the chosen selection, then reflect it as the new live status. ──
  const onSetLive = async () => {
    if (!canSet) return;
    setSaving(true);
    try {
      // Send only the fields the chosen scope needs (the backend ignores the rest per the contract).
      const body =
        scope === "group"
          ? { scope, stage_id: Number(selStage), group_id: Number(selGroup) }
          : scope === "stage"
            ? { scope, stage_id: Number(selStage) }
            : scope === "custom"
              ? { scope, group_ids: customGroupIds }
              : { scope };
      const res = await broadcastApi.set(eventId, body);
      // Prefer the server's echoed selection; fall back to what we sent (merged onto the known stages)
      // so the status line updates even if the POST response omits the stage tree.
      setSaved(
        res && res.scope
          ? { ...res, stages: res.stages ?? stages }
          : {
              scope,
              stage_id: scope === "group" || scope === "stage" ? Number(selStage) : null,
              group_id: scope === "group" ? Number(selGroup) : null,
              group_ids: scope === "custom" ? customGroupIds : [],
              stages,
            },
      );
      toast.success(t("broadcast.setSuccess"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("broadcast.setError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    // AFC card idiom: bg-card rounded-md border, compact text, green-accented heading.
    <div className="rounded-md border bg-card p-4 shadow-sm">
      {/* Heading + one-line explainer of what this control does. */}
      <div className="mb-3 flex items-center gap-2">
        <IconBroadcast className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-primary">
          {t("broadcast.title")}
        </h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {t("broadcast.description")}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" />
          {t("broadcast.loading")}
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Scope ── what the overlay shows: one group, a stage cumulative, the whole event, or a
              custom set of groups. Kept as a Select to match the AFC picker idiom on these pages. */}
          <div className="space-y-2">
            <Label className="text-sm">{t("broadcast.scopeLabel")}</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as BroadcastScope)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">{t("broadcast.scope.group")}</SelectItem>
                <SelectItem value="stage">{t("broadcast.scope.stage")}</SelectItem>
                <SelectItem value="event">{t("broadcast.scope.event")}</SelectItem>
                <SelectItem value="custom">{t("broadcast.scope.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Stage ── shown for the single-group and stage-cumulative scopes. ── */}
          {(scope === "group" || scope === "stage") && stages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">{t("broadcast.stage")}</Label>
              <Select value={selStage} onValueChange={onStageChange}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={t("broadcast.selectStage")} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                      {s.stage_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Group ── shown only for the single-group scope (the chosen stage's groups). ── */}
          {scope === "group" && stageGroups.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">{t("broadcast.group")}</Label>
              <Select value={selGroup} onValueChange={setSelGroup}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder={t("broadcast.selectGroup")} />
                </SelectTrigger>
                <SelectContent>
                  {stageGroups.map((g) => (
                    <SelectItem key={g.group_id} value={String(g.group_id)}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Custom groups ── a checkbox list of every group in the event; the picked groups are
              combined into one cumulative. Same checkbox idiom as CopyOverlayLinkDialog's column list. */}
          {scope === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm">{t("broadcast.customGroups")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("broadcast.customGroupsHint")}
              </p>
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border p-3">
                {allGroups.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t("broadcast.noGroups")}
                  </span>
                ) : (
                  allGroups.map((g) => (
                    <label
                      key={g.group_id}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <Checkbox
                        checked={customGroupIds.includes(g.group_id)}
                        onCheckedChange={(v) =>
                          toggleCustomGroup(g.group_id, v === true)
                        }
                      />
                      {g.label}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Set live + current live status ──
              "Set live" persists the selection; the overlay picks it up within one poll (no OBS change).
              The status line always shows what is CURRENTLY on air (from the last GET / successful Set). */}
          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {saved ? (
                <span className="font-medium text-foreground">
                  {t("broadcast.live", { selection: describe(saved) })}
                </span>
              ) : setLiveHint ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {setLiveHint}
                </span>
              ) : (
                t("broadcast.noneLive")
              )}
            </p>
            <Button
              size="sm"
              onClick={onSetLive}
              disabled={saving || !canSet}
              className="shrink-0"
            >
              {saving ? (
                <IconLoader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <IconBroadcast className="mr-1 size-4" />
              )}
              {t("broadcast.setLive")}
            </Button>
          </div>
          {/* Reassure the operator this needs no OBS interaction, matching the "follow broadcast" link. */}
          <p className="text-xs text-muted-foreground">
            {t("broadcast.followHint")}
          </p>
        </div>
      )}
    </div>
  );
}
