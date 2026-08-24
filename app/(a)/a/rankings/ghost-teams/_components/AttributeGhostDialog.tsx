"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AttributeGhostDialog - an ADMIN says "this ghost team IS this real AFC profile".
//
// WHY THIS EXISTS (owner 2026-08-24): the only route from a ghost to a real team used to be
// request-claim -> approve-claim, and the request half is explicitly NOT an admin action (the
// backend 403s unless the caller is owner/captain/manager of the target team). An admin could
// therefore only ever APPROVE a claim somebody else had filed. Importing FFWS Africa 2026 Fall
// created roughly 150 ghosts in one afternoon, most of them clubs that already have an AFC
// profile, and waiting for 150 captains to each notice and file a claim is not a process.
//
// THE HISTORY QUESTION IS ASKED PER TEAM, and the admin can then apply that answer to the rest
// (owner 2026-08-24). Attributing does not always mean the same thing:
//   Move history  -> points, rank and tier move onto the real profile, through the very same
//                    claims.reattribute_ghost_team path an approved claim uses, conflict guard and
//                    all. This is the right answer when the ghost genuinely IS that club.
//   Link only     -> the two are linked, the ghost keeps its own rows, the ladder still shows it
//                    separately. The honest answer for a same-named side, or when the admin only
//                    wants the profiles associated.
//
// CONNECTS TO:
//   - rankingsAdminApi.attributeGhost      -> POST rankings/ghost-teams/<uuid>/attribute/
//   - rankingsAdminApi.attributeGhostsBulk -> POST rankings/ghost-teams/attribute-bulk/
//     (both in afc_rankings.admin_ghost; head_admin | metrics_admin, >=10 char audit reason)
//   - <TeamSearchSelect/> for picking the real profile (GET /team/search-teams/)
//   - the parent page app/(a)/a/rankings/ghost-teams/page.tsx, which owns the row list and
//     re-fetches after onDone.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconAlertTriangle, IconArrowRight, IconLink } from "@tabler/icons-react";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { TeamSearchSelect, type PickedTeam } from "@/components/ui/team-search-select";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { cn } from "@/lib/utils";

/** Matches the backend's >=10 character audit-reason gate on every admin write. */
const MIN_REASON = 10;

export type AttributableGhost = {
  id: string;          // ghost_team_id (uuid)
  team_name: string;
};

/**
 * One of the two things attributing can mean. Rendered as filled cards rather than a radio ring:
 * the house design bans hierarchy built out of hairline strokes, so the selected option is a
 * stronger FILL plus a colour change, never an outline.
 */
function HistoryChoice({
  value, onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTranslations("rankings.admin.ghostTeams.attributeDialog");
  const options: { key: boolean; icon: React.ReactNode; title: string; desc: string }[] = [
    { key: true, icon: <IconArrowRight className="size-4" />, title: t("moveTitle"), desc: t("moveDesc") },
    { key: false, icon: <IconLink className="size-4" />, title: t("linkTitle"), desc: t("linkDesc") },
  ];
  return (
    <div className="space-y-2">
      <Label>{t("historyLabel")}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.key;
          return (
            <button
              key={String(o.key)}
              type="button"
              onClick={() => onChange(o.key)}
              aria-pressed={selected}
              className={cn(
                "rounded-md p-3 text-left transition-colors",
                // Surface + space, not strokes. Selected reads as a stronger fill.
                selected
                  ? "bg-primary/15 text-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-sm font-semibold",
                selected ? "text-primary" : "text-foreground")}>
                {o.icon}
                {o.title}
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed">{o.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AttributeGhostDialog({
  ghost, remainingCount, open, onOpenChange, onDone, stickyHistory, onStickyHistory,
}: {
  /** The ghost being attributed. null closes the dialog. */
  ghost: AttributableGhost | null;
  /**
   * How many OTHER unclaimed ghosts are on screen. Drives the "apply to all" affordance: with
   * nothing else to apply it to, offering the choice would be noise, so it is hidden at 0.
   */
  remainingCount: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after a successful write so the parent re-fetches. */
  onDone: () => void;
  /**
   * The history answer the admin chose to reuse, or null while they still want to be asked.
   * Owned by the PAGE, not this dialog, so it survives the dialog unmounting between rows.
   */
  stickyHistory: boolean | null;
  /** Raised when the admin ticks "use this answer for the rest" (or leaves it unticked). */
  onStickyHistory: (v: boolean | null) => void;
}) {
  const t = useTranslations("rankings.admin.ghostTeams");
  const td = useTranslations("rankings.admin.ghostTeams.attributeDialog");

  const [teamId, setTeamId] = useState<number | null>(null);
  const [picked, setPicked] = useState<PickedTeam | undefined>(undefined);
  // Seeded from the saved answer when there is one, so ticking "apply to all" really does stop
  // the question being re-asked rather than merely remembering it somewhere invisible.
  const [moveHistory, setMoveHistory] = useState(stickyHistory ?? true);
  const [applyToAll, setApplyToAll] = useState(stickyHistory !== null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valid = teamId != null && reason.trim().length >= MIN_REASON;

  function reset() {
    setTeamId(null);
    setPicked(undefined);
    // Back to the SAVED answer, not to the hardcoded default: closing one row must not silently
    // undo "use this for the rest".
    setMoveHistory(stickyHistory ?? true);
    setApplyToAll(stickyHistory !== null);
    setReason("");
    setSubmitting(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function submit() {
    if (!ghost || teamId == null) return;
    setSubmitting(true);
    try {
      await rankingsAdminApi.attributeGhost(ghost.id, {
        team_id: teamId,
        reason: reason.trim(),
        move_history: moveHistory,
      });
      // Persist (or clear) the reusable answer BEFORE closing, so the next row opens with it.
      onStickyHistory(applyToAll ? moveHistory : null);
      toast.success(td("success", { ghost: ghost.team_name, team: picked?.team_name ?? "" }));
      handleOpenChange(false);
      onDone();
    } catch (err: any) {
      // The backend writes an admin-readable message (a ClaimConflict names the colliding
      // leaderboard or event), so surface IT rather than a generic failure.
      toast.error(err?.response?.data?.message || td("failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{td("title", { name: ghost?.team_name ?? "" })}</DialogTitle>
          <DialogDescription>{td("desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>{td("teamLabel")}</Label>
          <TeamSearchSelect
            value={teamId}
            onChange={(id, team) => { setTeamId(id); setPicked(team); }}
            placeholder={td("teamPlaceholder")}
          />
          <p className="text-[11px] text-muted-foreground">{td("teamHint")}</p>
        </div>

        <HistoryChoice value={moveHistory} onChange={setMoveHistory} />

        {moveHistory && (
          <div className="flex items-start gap-2 rounded-md bg-orange-500/10 p-3 text-xs text-orange-300">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{td("moveWarning")}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="attribute-reason">
            {t("common.reasonLabel")}{" "}
            <span className="text-orange-400">{t("common.reasonRequired")}</span>
          </Label>
          <Textarea
            id="attribute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("common.reasonPlaceholder")}
            className="min-h-20"
          />
          <p className="text-[11px] text-muted-foreground">
            {t("common.minChars", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        {/* THE "APPLY TO ALL" (owner 2026-08-24). The owner asked to be asked per team AND to be
            able to stop being asked, so this makes the HISTORY answer sticky rather than
            auto-pairing anything: the ghost-to-team decision is always a human one and is never
            batched, but "move the points" vs "link only" is usually the same answer 150 times in a
            row. Hidden when there is nothing else it could apply to. */}
        {remainingCount > 0 && (
          <label
            htmlFor="attribute-apply-all"
            className="flex cursor-pointer items-start gap-2.5 rounded-md bg-muted/50 p-3"
          >
            <Checkbox
              id="attribute-apply-all"
              checked={applyToAll}
              onCheckedChange={(v) => setApplyToAll(v === true)}
              className="mt-0.5"
            />
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              {td("applyToAllLabel", { count: remainingCount })}
            </span>
          </label>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.goBack")}
          </Button>
          <Button disabled={!valid || submitting} onClick={submit}>
            {td("cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
