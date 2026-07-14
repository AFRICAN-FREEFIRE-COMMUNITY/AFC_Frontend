"use client";

// ── ParticipantsStep (wizard step 2) ──────────────────────────────────────────
// Adds participants to the draft leaderboard. For TEAM format it searches existing teams via
// TeamSearchSelect (-> /team/search-teams/); for SOLO format it searches users via UserSearchSelect
// (-> /auth/search-users/). Either way, "not found?" reveals the GhostCreateInline mini-form to mint a
// ghost (placeholder) entity inline. Every add hits
// POST /leaderboards/standalone/<id>/participants/ via standaloneLeaderboardsApi.addParticipant;
// removes hit DELETE .../participants/<pid>/.
//
// The selected list is the live server state of participants (returned from each add), so a refresh of
// the page would show the same picks. Real vs ghost is badged (green / orange outline).
//
// NOTE on the real-user add: UserSearchSelect emits the USERNAME (its house contract), but the
// participant endpoint needs the numeric user_id. We capture the full PickedUser object from
// onChange's 2nd arg and send user.user_id.
//
// OCR shortcut (Stream P2): an "Upload screenshot" button opens OcrUploadDialog. On apply, the
// dialog returns {match, participants, standings} (the backend created a map + participants +
// results in one call). We hand that to onOcrApplied, which the wizard (../page.tsx) uses to merge
// the new participants and jump straight to the Results step with the created map pre-filled.
//
// i18n: user-facing copy lives under the `ocr` namespace, group `stdSteps` (author English only;
// pnpm i18n:translate fills fr/pt). Generic verbs come from the shared `ocr.common.*` group.
//
// CONSUMED BY: ../page.tsx (the wizard). Reads/writes the shared `participants` list via props.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// AlertDialog gates the destructive server DELETE (B4 #6): removing a participant hits
// DELETE .../participants/<pid>/ and cannot be undone, so the trash button now stages a pending
// target and only AlertDialogAction runs the delete.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconTrash, IconUserPlus, IconScan, IconPencil, IconFileText } from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import {
  TeamSearchSelect,
  type PickedTeam,
  type PickedGhostTeam,
} from "@/components/ui/team-search-select";
import {
  UserSearchSelect,
  type PickedUser,
  type PickedGhostPlayer,
} from "@/components/ui/user-search-select";
import { GhostCreateInline } from "./GhostCreateInline";
// Phase 2.6: the async, multi-image batch reader (replaces the old single-shot OcrUploadDialog, which
// read one screenshot synchronously and timed out on prod). One map per card, 1+ screenshots each.
import { OcrBatchDialog } from "./OcrBatchDialog";
import { ResultFileDialog } from "./ResultFileDialog";
import {
  standaloneLeaderboardsApi,
  type StandaloneParticipant,
  type OcrApplyResponse,
} from "@/lib/standaloneLeaderboards";

export function ParticipantsStep({
  leaderboardId,
  format,
  participants,
  onParticipantsChange,
  onOcrApplied,
  ocrScoring,
  onBack,
  onNext,
}: {
  leaderboardId: number;
  format: "team" | "solo";
  participants: StandaloneParticipant[];
  onParticipantsChange: (next: StandaloneParticipant[]) => void;
  // Fired after the OCR dialog applies a screenshot. The wizard merges the returned participants and
  // advances to the Results step carrying the created match (see ../page.tsx::handleOcrApplied).
  onOcrApplied: (result: OcrApplyResponse) => void;
  // The leaderboard's scoring config (from the wizard's created header), forwarded into the OCR
  // dialog so each reviewed row previews the points this map would award.
  ocrScoring?: { placementPoints: Record<string, number>; killPoint: number };
  onBack: () => void;
  onNext: () => void;
}) {
  // `ocr` namespace, `stdSteps` group; `t("common.*")` reaches the shared generic verbs.
  const t = useTranslations("ocr");
  const [showGhost, setShowGhost] = useState(false);
  const [adding, setAdding] = useState(false);
  // Whether the OCR upload dialog is open.
  const [ocrOpen, setOcrOpen] = useState(false);
  // Whether the result-FILE upload dialog is open (team format only - the file is team-shaped).
  const [fileOpen, setFileOpen] = useState(false);
  // Pending remove-participant target: non-null opens the confirm dialog; only AlertDialogAction
  // actually calls remove() (B4 #6, server DELETE gate).
  const [removeTarget, setRemoveTarget] = useState<StandaloneParticipant | null>(null);

  // ── Add a participant (real or ghost) and append the returned row to the list. ──
  const add = async (body: Record<string, any>) => {
    setAdding(true);
    try {
      const res = await standaloneLeaderboardsApi.addParticipant(leaderboardId, body);
      onParticipantsChange([...participants, res.participant]);
      toast.success(t("stdSteps.toast.added", { name: res.participant.name }));
      setShowGhost(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("stdSteps.toast.failedAdd"),
      );
    } finally {
      setAdding(false);
    }
  };

  // Real TEAM pick: TeamSearchSelect emits team_id directly.
  const handleTeamPick = (teamId: number | null, team?: PickedTeam) => {
    if (teamId == null) return;
    if (participants.some((p) => p.team_id === teamId)) {
      toast.info(
        t("stdSteps.toast.alreadyAdded", { name: team?.team_name ?? t("stdSteps.thatTeam") }),
      );
      return;
    }
    add({ kind: "real", team_id: teamId });
  };

  // Real SOLO pick: UserSearchSelect emits a username, but we need the numeric user_id
  // (captured from the 2nd onChange arg).
  const handleUserPick = (_username: string | null, user?: PickedUser) => {
    if (!user) return;
    if (participants.some((p) => p.user_id === user.user_id)) {
      toast.info(t("stdSteps.toast.alreadyAdded", { name: user.username }));
      return;
    }
    add({ kind: "real", user_id: user.user_id });
  };

  // ── Existing-ghost picks (owner 2026-06-12: "let ghost teams and players be searchable") ──
  // The search selects also surface ghosts (includeGhosts); a pick is added through the SAME
  // kind=ghost_existing contract the OCR review uses, so an existing ghost is reused, never duplicated.
  const handleGhostTeamPick = (g: PickedGhostTeam) => {
    if (participants.some((p) => p.ghost_team_id === g.ghost_team_id)) {
      toast.info(t("stdSteps.toast.alreadyAdded", { name: g.team_name }));
      return;
    }
    add({ kind: "ghost_existing", ghost_team_id: g.ghost_team_id });
  };

  const handleGhostPlayerPick = (g: PickedGhostPlayer) => {
    if (participants.some((p) => p.ghost_player_id === g.ghost_player_id)) {
      toast.info(t("stdSteps.toast.alreadyAdded", { name: g.ign }));
      return;
    }
    add({ kind: "ghost_existing", ghost_player_id: g.ghost_player_id });
  };

  // Server DELETE .../participants/<pid>/. Only reached from the confirm dialog's action.
  const remove = async (p: StandaloneParticipant) => {
    try {
      await standaloneLeaderboardsApi.removeParticipant(leaderboardId, p.id);
      onParticipantsChange(participants.filter((x) => x.id !== p.id));
      toast.success(t("stdSteps.toast.removed", { name: p.name }));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || t("stdSteps.toast.failedRemove"),
      );
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center">
          {t("stdSteps.participants.title")}
          <InfoTip
            text={t("stdSteps.participants.infoTip")}
            className="ml-1.5"
          />
        </CardTitle>
        <CardDescription>
          {format === "team"
            ? t("stdSteps.participants.descTeam")
            : t("stdSteps.participants.descSolo")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Search picker (team or solo). Single mode: each pick triggers an add. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>
              {format === "team"
                ? t("stdSteps.participants.findTeam")
                : t("stdSteps.participants.findPlayer")}
            </Label>
            {/* ── Results-entry options (owner 2026-06-12: ALL entry methods visible side by side) ──
                1. Manual entry lives on the Results step - this button jumps straight there.
                2. "Upload screenshots" opens OcrBatchDialog (multi-map background OCR).
                3. "Upload result file" (team only) opens ResultFileDialog (the game's match-log
                   export, parsed synchronously, players matched exactly by UID). */}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onNext}>
                <IconPencil size={14} className="mr-1" />
                {t("stdSteps.participants.enterManually")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOcrOpen(true)}
              >
                <IconScan size={14} className="mr-1" />
                {t("stdSteps.participants.uploadScreenshots")}
              </Button>
              {format === "team" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setFileOpen(true)}
                >
                  <IconFileText size={14} className="mr-1" />
                  {t("stdSteps.participants.uploadResultFile")}
                </Button>
              )}
            </div>
          </div>
          {format === "team" ? (
            <TeamSearchSelect
              value={null}
              onChange={handleTeamPick}
              disabled={adding}
              placeholder={t("stdSteps.searchTeamPlaceholder")}
              // Also surfaces existing GHOST teams so they are reused, not recreated.
              includeGhosts
              onPickGhost={handleGhostTeamPick}
            />
          ) : (
            <UserSearchSelect
              value={null}
              onChange={handleUserPick}
              disabled={adding}
              placeholder={t("stdSteps.searchPlayerPlaceholder")}
              includeGhosts
              onPickGhost={handleGhostPlayerPick}
            />
          )}
        </div>

        {/* OCR batch upload + review dialog (Phase 2.6). Mounted here so its trigger sits with the search. */}
        <OcrBatchDialog
          open={ocrOpen}
          onOpenChange={setOcrOpen}
          leaderboardId={leaderboardId}
          format={format}
          scoring={ocrScoring}
          onApplied={onOcrApplied}
        />

        {/* Result-file upload + review (team format; mirrors the OCR dialog's apply/merge contract). */}
        {format === "team" && (
          <ResultFileDialog
            open={fileOpen}
            onOpenChange={setFileOpen}
            leaderboardId={leaderboardId}
            scoring={ocrScoring}
            onApplied={onOcrApplied}
          />
        )}

        {/* Inline ghost create toggle + form. */}
        {showGhost ? (
          <GhostCreateInline
            format={format}
            submitting={adding}
            onCreate={add}
            onCancel={() => setShowGhost(false)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowGhost(true)}
          >
            <IconUserPlus size={14} className="mr-1" />
            {t("stdSteps.createAsGhost")}
          </Button>
        )}

        {/* Selected participants list with real/ghost badges + remove. */}
        <div className="space-y-2">
          <Label>{t("stdSteps.participants.added", { count: participants.length })}</Label>
          {participants.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              {t("stdSteps.participants.empty")}
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.is_ghost ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                      >
                        {t("stdSteps.badge.ghost")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                      >
                        {t("stdSteps.badge.real")}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoveTarget(p)}
                    aria-label={t("stdSteps.removeAria", { name: p.name })}
                  >
                    <IconTrash size={15} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            {t("common.back")}
          </Button>
          <Button onClick={onNext} disabled={participants.length === 0}>
            {t("stdSteps.participants.continueToResults")}
          </Button>
        </div>
      </CardContent>

      {/* ── Confirm before the server DELETE (B4 #6) ── the trash button only stages `removeTarget`;
          the delete runs solely from AlertDialogAction. onOpenChange clears the target on dismiss. */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("stdSteps.confirmRemoveParticipant.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? t("stdSteps.confirmRemoveParticipant.desc", { name: removeTarget.name })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (removeTarget) remove(removeTarget);
                setRemoveTarget(null);
              }}
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
