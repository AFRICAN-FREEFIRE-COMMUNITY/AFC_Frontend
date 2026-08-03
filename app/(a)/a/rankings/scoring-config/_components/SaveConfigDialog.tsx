"use client";

/**
 * The Save dialog for the Scoring Config editor: pre-flight check, season scope, and commit.
 *
 * WHY SAVING NEEDS ITS OWN DIALOG
 *   Saving here is not "write a row". It drafts a NEW immutable config version, pins every
 *   other season to the rules it was already scored under, and then RECALCULATES the seasons
 *   in scope. So the admin has to be told, before they commit, exactly which seasons the
 *   change will rewrite. The backend already answers that question:
 *
 *     POST /rankings/scoring-config/validate/   dry run - errors, contradictions, impact
 *     POST /rankings/scoring-config/            the write (afc_rankings/admin_scoring_config.py)
 *
 *   This component runs the dry run whenever the dialog opens or the scope changes, so the
 *   confirmation is accurate rather than a guess.
 *
 * THE THREE RULES IT ENFORCES (owner decisions, encoded in the backend, mirrored here)
 *   1. The CURRENT season is always in scope and recalculates. It is checked and locked, so a
 *      season can never end up half on the old rules and half on the new.
 *   2. Any other season is an explicit opt in.
 *   3. Opting in a season that is CLOSED or whose standings are PUBLISHED rewrites results
 *      people have already seen. That needs a separate acknowledgement, and the backend
 *      independently refuses with 409 if it is missing, so this is a second lock and not the
 *      only one.
 *
 * HOW IT CONNECTS
 *   - Rendered by ../page.tsx, which owns the edited config and passes it down.
 *   - Reads/writes through lib/rankingsAdmin.ts (validateScoringConfig / saveScoringConfig).
 *   - `onSaved` tells the page to re-fetch, which resets the dirty baseline to the server's.
 *
 * i18n: rankings namespace, admin.scoringConfig.save.* (messages/{en,fr,pt}/rankings.json).
 * Backend validation messages are rendered verbatim, like every API error in this app.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  IconAlertTriangle, IconCheck, IconDeviceFloppy, IconLock, IconRefresh, IconWorld,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { IssueList, ScoringBlob, SeasonScope, toIssues } from "./editor-primitives";

const MIN_REASON = 10;

export function SaveConfigDialog({
  open, onOpenChange, config, seasons, currentSeasonId, activeVersion, dirtyCount, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ScoringBlob;
  seasons: SeasonScope[];
  currentSeasonId: number | null;
  activeVersion: string;
  dirtyCount: number;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations("rankings");
  const [reason, setReason] = useState("");
  // Extra seasons the admin has opted in. The CURRENT season is never in here: it is always
  // in scope server-side, so tracking it would let the UI imply it is optional.
  const [extraSeasons, setExtraSeasons] = useState<number[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [recalculate, setRecalculate] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<any>(null);

  const reasonValid = reason.trim().length >= MIN_REASON;

  // Seasons the admin may opt in - everything except the current one, which is locked in.
  const optional = useMemo(
    () => seasons.filter((s) => s.season_id !== currentSeasonId),
    [seasons, currentSeasonId],
  );
  const current = useMemo(
    () => seasons.find((s) => s.season_id === currentSeasonId) ?? null,
    [seasons, currentSeasonId],
  );

  // A chosen season that is closed or already published is the unsafe path. Computed here as
  // well as server-side so the warning appears the moment the box is ticked, rather than after
  // a rejected save.
  const risky = useMemo(
    () => optional.filter(
      (s) => extraSeasons.includes(s.season_id)
        && (s.is_closed || s.rankings_published || s.tiers_published),
    ),
    [optional, extraSeasons],
  );
  const needsAck = risky.length > 0;

  // ── the dry run. Re-runs on open and whenever the scope changes, so the affected-season
  //    list and the problem list always describe what the button would actually do.
  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await rankingsAdminApi.validateScoringConfig({
        config, apply_to_seasons: extraSeasons,
      });
      setCheck(res);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("admin.scoringConfig.save.checkFailed"));
      setCheck(null);
    } finally {
      setChecking(false);
    }
    // `config` is intentionally not a dependency: it cannot change while the dialog is open,
    // and including it would re-run the check on every keystroke behind the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraSeasons, t]);

  useEffect(() => {
    if (!open) return;
    setCheck(null);
    runCheck();
  }, [open, runCheck]);

  // Reset the form each time the dialog opens, so a cancelled save never leaks its reason or
  // its acknowledgement into the next one.
  useEffect(() => {
    if (!open) return;
    setReason("");
    setExtraSeasons([]);
    setAcknowledged(false);
    setRecalculate(true);
  }, [open]);

  const errors = useMemo(() => toIssues(check?.errors, []), [check]);
  const warnings = useMemo(() => toIssues([], check?.contradictions), [check]);
  const blocked = errors.length > 0;

  const toggleSeason = (seasonId: number) => {
    setExtraSeasons((prev) => (prev.includes(seasonId)
      ? prev.filter((id) => id !== seasonId)
      : [...prev, seasonId]));
    setAcknowledged(false);        // a changed scope invalidates the acknowledgement
  };

  const confirm = async () => {
    if (!reasonValid || saving || blocked || (needsAck && !acknowledged)) return;
    setSaving(true);
    try {
      const res = await rankingsAdminApi.saveScoringConfig({
        config,
        reason: reason.trim(),
        apply_to_seasons: extraSeasons,
        acknowledge_published: acknowledged,
        recalculate,
      });
      const recalculated = res?.recalculated ?? {};
      toast.success(t("admin.scoringConfig.save.saved", {
        version: res?.version ?? "?",
        seasons: recalculated.seasons ?? 0,
      }));
      onOpenChange(false);
      await onSaved();
    } catch (err: any) {
      const data = err?.response?.data;
      // 409 = a closed/published season was opted in without the acknowledgement. The body
      // names them, so re-show the impact rather than a generic failure.
      if (err?.response?.status === 409) {
        setCheck((prev: any) => ({ ...(prev ?? {}), impact: data?.impact ?? prev?.impact }));
        setAcknowledged(false);
      }
      if (Array.isArray(data?.errors) && data.errors.length) {
        setCheck((prev: any) => ({ ...(prev ?? {}), errors: data.errors }));
      }
      toast.error(data?.message || t("admin.scoringConfig.save.failed"));
    } finally {
      setSaving(false);
    }
  };

  const seasonFlags = (s: SeasonScope) => {
    const flags: string[] = [];
    if (s.rankings_published) flags.push(t("admin.scoringConfig.save.flagRankingsPublished"));
    if (s.tiers_published) flags.push(t("admin.scoringConfig.save.flagTiersPublished"));
    if (s.is_closed) flags.push(t("admin.scoringConfig.save.flagClosed"));
    if (s.is_frozen) flags.push(t("admin.scoringConfig.save.flagFrozen"));
    return flags;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      {/* max-h + overflow so the whole dialog scrolls inside itself on a phone instead of
          pushing the page, and the footer buttons stay reachable. */}
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconDeviceFloppy className="size-5 text-primary" />
            {t("admin.scoringConfig.save.title")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.scoringConfig.save.description", { version: activeVersion })}
          </DialogDescription>
        </DialogHeader>

        {/* what is about to happen, in numbers */}
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{t("admin.scoringConfig.save.fieldsChanged")}</span>
            <span className="font-semibold tabular-nums text-orange-400">{dirtyCount}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>{t("admin.scoringConfig.save.currentVersion")}</span>
            <span className="font-medium text-foreground">{activeVersion}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>{t("admin.scoringConfig.save.newVersion")}</span>
            <span className="font-medium text-foreground">
              {t("admin.scoringConfig.save.newVersionValue")}
            </span>
          </div>
        </div>

        {/* problems found by the dry run */}
        {checking && (
          <p className="text-xs text-muted-foreground">{t("admin.scoringConfig.save.checking")}</p>
        )}
        {blocked && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-destructive">
              {t("admin.scoringConfig.save.blockedTitle")}
            </p>
            <IssueList issues={errors} />
          </div>
        )}
        {!blocked && warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-orange-300">
              {t("admin.scoringConfig.save.warningsTitle")}
            </p>
            <IssueList issues={warnings} />
          </div>
        )}

        <Separator />

        {/* ── season scope ── */}
        <div className="space-y-2">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">{t("admin.scoringConfig.save.scopeTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("admin.scoringConfig.save.scopeHelp")}
            </p>
          </div>

          {/* the current season: always in, never a choice */}
          {current && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <IconLock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{current.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.scoringConfig.save.currentAlwaysIncluded")}
                </p>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/50 px-2 py-0 text-[10px] text-primary">
                {t("admin.scoringConfig.save.badgeCurrent")}
              </Badge>
            </div>
          )}

          {optional.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("admin.scoringConfig.save.noOtherSeasons")}
            </p>
          ) : (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-1.5">
              {optional.map((s) => {
                const checked = extraSeasons.includes(s.season_id);
                const flags = seasonFlags(s);
                const unsafe = s.is_closed || s.rankings_published || s.tiers_published;
                return (
                  <label
                    key={s.season_id}
                    htmlFor={`scope-${s.season_id}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/50",
                      checked && unsafe && "bg-orange-500/10",
                    )}
                  >
                    <Checkbox
                      id={`scope-${s.season_id}`}
                      checked={checked}
                      onCheckedChange={() => toggleSeason(s.season_id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium">{s.name}</span>
                        {unsafe && <IconWorld className="size-3.5 text-orange-400" />}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {flags.length
                          ? flags.join(" · ")
                          : t("admin.scoringConfig.save.flagNotPublished")}
                        {s.config_version != null && (
                          <> · {t("admin.scoringConfig.save.onVersion", { version: s.config_version })}</>
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* the acknowledgement, only when it is actually needed */}
          {needsAck && (
            <label
              htmlFor="ack-published"
              className="flex cursor-pointer items-start gap-2 rounded-md border border-orange-500/50 bg-orange-500/10 p-2.5"
            >
              <Checkbox
                id="ack-published"
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(Boolean(v))}
                className="mt-0.5"
              />
              <span className="text-[11px] leading-snug text-orange-200">
                <IconAlertTriangle className="mr-1 inline size-3.5" />
                {t("admin.scoringConfig.save.acknowledge", {
                  seasons: risky.map((s) => s.name).join(", "),
                })}
              </span>
            </label>
          )}

          {/* recalculation toggle - on by default, because a change nobody applies is a change
              nobody can see. Off exists for a batch of edits saved one after another. */}
          <label
            htmlFor="recalc-now"
            className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5"
          >
            <Checkbox
              id="recalc-now"
              checked={recalculate}
              onCheckedChange={(v) => setRecalculate(Boolean(v))}
              className="mt-0.5"
            />
            <span className="text-[11px] leading-snug text-muted-foreground">
              <IconRefresh className="mr-1 inline size-3.5" />
              {t("admin.scoringConfig.save.recalculateHelp")}
            </span>
          </label>
        </div>

        <Separator />

        {/* mandatory audit reason */}
        <div className="space-y-2">
          <Label htmlFor="cfg-reason">
            {t("admin.scoringConfig.save.reasonLabel")} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cfg-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("admin.scoringConfig.save.reasonPlaceholder")}
            className="min-h-20"
          />
          <p className="text-[11px] text-muted-foreground">
            {reason.trim().length < MIN_REASON
              ? t("admin.scoringConfig.save.reasonCount", {
                  count: reason.trim().length, min: MIN_REASON,
                })
              : t("admin.scoringConfig.save.reasonLogged")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t("admin.scoringConfig.save.cancel")}
          </Button>
          <Button
            disabled={!reasonValid || saving || blocked || (needsAck && !acknowledged)}
            onClick={confirm}
          >
            <IconCheck className="mr-1.5 size-4" />
            {saving
              ? t("admin.scoringConfig.save.savingBusy")
              : t("admin.scoringConfig.save.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
