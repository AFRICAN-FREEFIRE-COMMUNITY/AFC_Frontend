"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FullLoader } from "@/components/Loader";
import { TierBadge } from "@/components/rankings/TierBadge";
import {
  rankingsApi,
  Season,
  TeamRow as ApiTeamRow,
  PlayerRow as ApiPlayerRow,
} from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { matchesSearch } from "@/lib/search";
import {
  IconGavel, IconBan, IconArrowBackUp, IconSearch, IconHash, IconAlertTriangle,
  IconInfoCircle, IconUsers, IconUser, IconShieldCheck, IconMinus, IconArrowDown,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

const TIERS = [0, 1, 2, 3] as const;
const MIN_REASON = 10;

// Live row shapes: the public quarterly read carries the manual-override state directly
// (tier_overridden / is_zeroed / points_deducted / effective_score for teams). The base
// ApiTeamRow type in lib/rankings.ts doesn't declare these admin-only keys, so widen the
// row locally to read them off the same payload. Players inherit their team tier; only a
// ban-zero is possible. The public player read does not expose is_zeroed / team_name, so
// a freshly-zeroed player is tracked locally by id.
type TeamRow = ApiTeamRow & {
  tier_overridden?: boolean;
  is_zeroed?: boolean;
  points_deducted?: number;
  effective_score?: number;
};
type PlayerRow = ApiPlayerRow & { zeroed?: boolean };

/* ---------------------------------------------------------------- Tier override (Teams) */
function TierOverrideDialog({
  team, open, onOpenChange, onConfirm,
}: {
  team: TeamRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (tier: number, reason: string) => void;
}) {
  const t = useTranslations("rankings.admin.overrides");
  // The tier label ("Tier 1" ... "Tier 4") lives in the SHARED rankings namespace, the same key
  // TierBadge renders, so the dropdown option and the badge beside it can never drift apart.
  const tTier = useTranslations("rankings");
  const [tier, setTier] = useState<string>("");
  const [reason, setReason] = useState("");

  React.useEffect(() => {
    if (open && team) {
      setTier(String(team.tier ?? 3));
      setReason("");
    }
  }, [open, team]);

  if (!team) return null;
  const ready = tier !== "" && reason.trim().length >= MIN_REASON;
  const computed = (team.tier ?? 3) as 0 | 1 | 2 | 3;
  const changed = Number(tier) !== computed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconGavel className="size-5 text-primary" /> {t("tierDialog.title", { name: team.team_name })}
          </DialogTitle>
          <DialogDescription>
            {t("tierDialog.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* what we're overriding (read-only context) */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="space-y-1">
              <p className="text-xs uppercase font-semibold text-muted-foreground">{t("tierDialog.currentTier")}</p>
              <TierBadge tier={computed} />
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="space-y-1 text-right">
              <p className="text-xs uppercase font-semibold text-muted-foreground">{t("common.score")}</p>
              <p className="text-lg font-bold tabular-nums">{team.total_score}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ovr-tier">{t("tierDialog.newTier")}</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger id="ovr-tier" className="w-full">
                <SelectValue placeholder={t("tierDialog.selectTier")} />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((x) => (
                  <SelectItem key={x} value={String(x)}>
                    {tTier("tier", { tier: x + 1 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!changed && tier !== "" && (
              <p className="text-xs text-muted-foreground">
                {t("tierDialog.sameAsCurrent")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ovr-reason">{t("common.reason")}</Label>
            <Textarea
              id="ovr-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("tierDialog.reasonPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("common.charMin", { count: reason.trim().length, min: MIN_REASON })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.goBack")}</Button>
          <Button
            disabled={!ready}
            onClick={() => onConfirm(Number(tier), reason.trim())}
          >
            <IconGavel className="mr-1.5 size-4" /> {t("tierDialog.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Deduct points (Teams), partial penalty */
function DeductPointsDialog({
  team, open, onOpenChange, onConfirm,
}: {
  team: TeamRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (points: number, reason: string) => void;
}) {
  const t = useTranslations("rankings.admin.overrides");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  React.useEffect(() => {
    if (open) {
      setAmount("");
      setReason("");
    }
  }, [open]);

  if (!team) return null;

  // current = team's effective score net of any prior deductions (zeroed teams sit at 0).
  const current = team.is_zeroed ? 0 : Math.max(0, team.effective_score ?? team.total_score);
  const deduction = Number(amount);
  const validAmount =
    amount !== "" && Number.isFinite(deduction) && deduction >= 1 && deduction <= current;
  const resulting = validAmount ? Math.max(0, current - deduction) : current;
  const ready = validAmount && reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconArrowDown className="size-5 text-orange-400" /> {t("deductDialog.title", { name: team.team_name })}
          </DialogTitle>
          <DialogDescription>
            {t("deductDialog.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* live current -> resulting context */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="space-y-1">
              <p className="text-xs uppercase font-semibold text-muted-foreground">{t("deductDialog.currentScore")}</p>
              <p className="text-lg font-bold tabular-nums">{current}</p>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="space-y-1 text-right">
              <p className="text-xs uppercase font-semibold text-muted-foreground">{t("deductDialog.resultingScore")}</p>
              <p className="text-lg font-bold tabular-nums text-orange-400">{resulting}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ded-amount">{t("deductDialog.amountLabel")}</Label>
            <Input
              id="ded-amount"
              type="number"
              min={1}
              max={current}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("deductDialog.amountPlaceholder", { max: current })}
              className="tabular-nums"
            />
            {amount !== "" && !validAmount && (
              <p className="text-xs text-orange-400">
                {t("deductDialog.amountInvalid", { max: current })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ded-reason">{t("common.reason")}</Label>
            <Textarea
              id="ded-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("deductDialog.reasonPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("common.charMin", { count: reason.trim().length, min: MIN_REASON })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.goBack")}</Button>
          <Button disabled={!ready} onClick={() => onConfirm(deduction, reason.trim())}>
            <IconMinus className="mr-1.5 size-4" /> {t("deductDialog.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Clear deduction (Teams), reason dialog */
function ClearDeductionDialog({
  team, open, onOpenChange, onConfirm,
}: {
  team: TeamRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("rankings.admin.overrides");
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!team) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconArrowBackUp className="size-5 text-primary" /> {t("clearDialog.title", { name: team.team_name })}
          </DialogTitle>
          <DialogDescription>
            {t("clearDialog.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="clr-reason">{t("common.reason")}</Label>
          <Textarea
            id="clr-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("clearDialog.reasonPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">
            {t("common.charMin", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.goBack")}</Button>
          <Button disabled={!ready} onClick={() => onConfirm(reason.trim())}>
            <IconArrowBackUp className="mr-1.5 size-4" /> {t("clearDialog.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Ban-zero (Teams), destructive */
function BanZeroTeamDialog({
  team, open, onOpenChange, onConfirm,
}: {
  team: TeamRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("rankings.admin.overrides");
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!team) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <IconAlertTriangle className="size-5" /> {t("banTeamDialog.title", { name: team.team_name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {/* t.rich keeps the emphasised "0" inline, so each language can place it in its own
                word order instead of the sentence being split into two glued fragments. */}
            {t.rich("banTeamDialog.desc", {
              b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ban-reason">{t("common.reason")}</Label>
          <Textarea
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("banTeamDialog.reasonPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">
            {t("common.charMin", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => onConfirm(reason.trim())}
          >
            <IconBan className="mr-1.5 size-4" /> {t("common.zeroForQuarter")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------------------------------------------------------------- Restore (Teams), reason dialog */
function RestoreTeamDialog({
  team, open, onOpenChange, onConfirm,
}: {
  team: TeamRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("rankings.admin.overrides");
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!team) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconArrowBackUp className="size-5 text-primary" /> {t("restoreDialog.title", { name: team.team_name })}
          </DialogTitle>
          <DialogDescription>
            {t("restoreDialog.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rst-reason">{t("common.reason")}</Label>
          <Textarea
            id="rst-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("restoreDialog.reasonPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">
            {t("common.charMin", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.goBack")}</Button>
          <Button disabled={!ready} onClick={() => onConfirm(reason.trim())}>
            <IconArrowBackUp className="mr-1.5 size-4" /> {t("restoreDialog.cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Ban-zero (Players), reason dialog */
function BanZeroPlayerDialog({
  player, open, onOpenChange, onConfirm,
}: {
  player: PlayerRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations("rankings.admin.overrides");
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!player) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <IconBan className="size-5" /> {t("banPlayerDialog.title", { name: player.username })}
          </DialogTitle>
          <DialogDescription>
            {t("banPlayerDialog.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="pban-reason">{t("common.reason")}</Label>
          <Textarea
            id="pban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("banPlayerDialog.reasonPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">
            {t("common.charMin", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.goBack")}</Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => onConfirm(reason.trim())}
          >
            <IconBan className="mr-1.5 size-4" /> {t("common.zeroForQuarter")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Stat card (shared summary tile) */
// Same signature as results/page.tsx - keep the rankings admin summary tiles identical.
function StatCard({ icon, title, value, sub, tone }: {
  icon: React.ReactNode; title: string; value: React.ReactNode; sub?: string; tone?: string;
}) {
  return (
    <Card className="gap-1 transition-shadow hover:shadow-lg">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cn("text-muted-foreground", tone)}>{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- Page */
export default function OverridesAndBansPage() {
  const t = useTranslations("rankings.admin.overrides");
  // Shared rankings namespace, used only for the "Tier N" label in the override toast so it
  // matches the TierBadge pills rendered in the same table.
  const tTier = useTranslations("rankings");
  const [tab, setTab] = useState<"teams" | "players">("teams");
  const [q, setQ] = useState("");

  const [season, setSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Public player read carries no is_zeroed; keep freshly-zeroed player ids client-side.
  const [zeroedPlayerIds, setZeroedPlayerIds] = useState<Set<number>>(new Set());

  // dialog state
  const [overrideTeam, setOverrideTeam] = useState<TeamRow | null>(null);
  const [deductTeam, setDeductTeam] = useState<TeamRow | null>(null);
  const [clearTeam, setClearTeam] = useState<TeamRow | null>(null);
  const [banTeam, setBanTeam] = useState<TeamRow | null>(null);
  const [restoreTeamRow, setRestoreTeamRow] = useState<TeamRow | null>(null);
  const [banPlayer, setBanPlayer] = useState<PlayerRow | null>(null);

  // Resolve the active season once, then load both lists.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let s = await rankingsApi.currentSeason();
        if (!s) {
          const r = await rankingsApi.seasons();
          s = r.results.find((x) => x.is_active) ?? r.results[0] ?? null;
        }
        if (!active) return;
        setSeason(s);
        // No season exists (or none active): the per-season load effect below early-returns,
        // so clear loading here ourselves, otherwise the page hangs on FullLoader forever.
        if (!s) setLoading(false);
      } catch (err: any) {
        if (!active) return;
        toast.error(err?.response?.data?.message || t("toasts.loadSeasonFailed"));
        setLoading(false);
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin surface: MUST read the ungated draft endpoints (adminTeamsQuarterly /
  // adminPlayersQuarterly) so unpublished seasons still list teams/players to override.
  // The public teams/players/quarterly reads return nothing until the season is published
  // from the overview Publish card - the draft endpoints return the same {results, season,
  // pagination} shape with the per-row override state (tier_overridden / is_zeroed /
  // points_deducted / effective_score) intact.
  const loadTeams = async (seasonId: number) => {
    const r = await rankingsAdminApi.adminTeamsQuarterly(seasonId);
    setTeams(r.results);
  };
  const loadPlayers = async (seasonId: number) => {
    const r = await rankingsAdminApi.adminPlayersQuarterly(seasonId);
    setPlayers(r.results);
  };

  useEffect(() => {
    if (!season) return;
    let active = true;
    setLoading(true);
    Promise.all([loadTeams(season.season_id), loadPlayers(season.season_id)])
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || t("toasts.loadFailed"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // Merge the client-side zeroed flag onto the read rows (public read omits is_zeroed).
  const playersView = useMemo(
    () => players.map((p) => ({ ...p, zeroed: p.zeroed || zeroedPlayerIds.has(p.player_id) })),
    [players, zeroedPlayerIds],
  );

  // Use the shared matchesSearch helper so the team-name search box is punctuation/space/accent-
  // insensitive and folds stylized "fancy font" names (e.g. typing "ve" finds a team named "V-E").
  const filteredTeams = useMemo(
    () => teams.filter((t) => matchesSearch(t.team_name, q)),
    [teams, q],
  );
  // Same shared matcher for the player search box, so a query finds stylized/punctuated usernames too.
  const filteredPlayers = useMemo(
    () => playersView.filter((p) => matchesSearch(p.username, q)),
    [playersView, q],
  );

  const zeroedCount = teams.filter((t) => t.is_zeroed).length;
  const overriddenCount = teams.filter((t) => t.tier_overridden).length;
  const deductedTeamsCount = teams.filter((t) => (t.points_deducted ?? 0) > 0).length;
  const totalDeducted = teams.reduce((sum, t) => sum + (t.points_deducted ?? 0), 0);

  /* live writes (all season-scoped; re-fetch after each so badges/score update) */
  const applyOverride = async (tier: number, reason: string) => {
    const target = overrideTeam;
    if (!target || !season || target.team_id == null) return;
    const same = tier === (target.tier ?? 3);
    try {
      await rankingsAdminApi.overrideTier(season.season_id, target.team_id, { tier, reason });
      toast.success(
        same
          ? t("toasts.overrideCleared", { name: target.team_name })
          // The tier name is resolved from the shared rankings namespace, not glued in English.
          : t("toasts.tierOverridden", {
              name: target.team_name,
              tier: tTier("tier", { tier: tier + 1 }),
            }),
      );
      setOverrideTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.overrideFailed"));
    }
  };

  const deductPoints = async (points: number, reason: string) => {
    const target = deductTeam;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.deductPoints(season.season_id, target.team_id, { points, reason });
      toast.success(t("toasts.deducted", { count: points, name: target.team_name }));
      setDeductTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.deductFailed"));
    }
  };

  const resetDeduction = async (reason: string) => {
    const target = clearTeam;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.clearDeduction(season.season_id, target.team_id, { reason });
      toast.success(t("toasts.deductionsCleared", { name: target.team_name }));
      setClearTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.clearFailed"));
    }
  };

  const zeroTeam = async (reason: string) => {
    const target = banTeam;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.zeroTeam(season.season_id, target.team_id, { reason });
      toast.success(t("toasts.teamZeroed"));
      setBanTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.zeroTeamFailed"));
    }
  };

  const restoreTeam = async (reason: string) => {
    const target = restoreTeamRow;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.unzeroTeam(season.season_id, target.team_id, { reason });
      toast.success(t("toasts.teamRestored", { name: target.team_name }));
      setRestoreTeamRow(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.restoreFailed"));
    }
  };

  const zeroPlayer = async (reason: string) => {
    if (!banPlayer || !season) return;
    const target = banPlayer;
    try {
      await rankingsAdminApi.zeroPlayer(season.season_id, target.player_id, { reason });
      toast.success(t("toasts.playerZeroed"));
      setBanPlayer(null);
      // Public player read omits is_zeroed; record it locally so the badge sticks.
      setZeroedPlayerIds((prev) => new Set(prev).add(target.player_id));
      await loadPlayers(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.zeroPlayerFailed"));
    }
  };

  if (loading && !teams.length && !players.length) {
    return <FullLoader text={t("loading")} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: overrides tour "Manual tier and score overrides" step.
        title={
          <span data-tour="overrides-title" className="inline-flex flex-wrap items-center">
            {t("title")}
            <InfoTip id="rankings.overrides._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
      />

      {/* status strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          icon={<IconGavel className="size-4" />}
          title={t("stats.tierOverrides")} value={overriddenCount}
          sub={t("stats.tierOverridesSub")}
        />
        <StatCard
          icon={<IconArrowDown className="size-4" />}
          title={t("stats.deductions")} value={deductedTeamsCount}
          sub={totalDeducted > 0 ? t("stats.deductionsRemoved", { count: totalDeducted }) : t("stats.deductionsSub")}
          tone="text-orange-400"
        />
        <StatCard
          icon={<IconBan className="size-4" />}
          title={t("stats.zeroedTeams")} value={zeroedCount}
          sub={t("stats.bannedThisQuarter")}
          tone="text-destructive"
        />
        <StatCard
          icon={<IconUser className="size-4" />}
          title={t("stats.zeroedPlayers")} value={playersView.filter((p) => p.zeroed).length}
          sub={t("stats.bannedThisQuarter")}
          tone="text-destructive"
        />
      </div>

      {/* tabs + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
          {([
            { key: "teams", label: t("tabs.teams"), icon: IconUsers },
            { key: "players", label: t("tabs.players"), icon: IconUser },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex h-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>
        {/* data-tour anchor: overrides tour "Find team or player" step. */}
        <div data-tour="overrides-search" className="relative w-full sm:w-64">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "teams" ? t("searchTeams") : t("searchPlayers")}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {/* TEAMS */}
      {tab === "teams" && (
        <>
          {/* data-tour anchor: overrides tour "Teams and players table" step. Teams is the
              default tab, so this Card is the stable target for the entity list step. */}
          <Card data-tour="overrides-list">
            <CardHeader>
              <CardTitle className="text-base">{t("teams.cardTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* "#" is the rank symbol, identical in every language, so it stays literal. */}
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{t("teams.colTeam")}</TableHead>
                    <TableHead>{t("teams.colTier")}</TableHead>
                    <TableHead className="text-right">{t("teams.colScore")}</TableHead>
                    <TableHead className="text-right">{t("teams.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {q ? t("teams.noMatch", { q }) : t("teams.empty")}
                      </TableCell>
                    </TableRow>
                  ) : filteredTeams.map((t2, i) => {
                    const effectiveTier = (t2.tier ?? 3) as 0 | 1 | 2 | 3;
                    const deducted = t2.points_deducted ?? 0;
                    const netScore = t2.is_zeroed ? 0 : Math.max(0, t2.effective_score ?? t2.total_score);
                    return (
                      <TableRow key={t2.team_id} className={cn(t2.is_zeroed && "bg-destructive/5")}>
                        <TableCell className="font-semibold text-muted-foreground">
                          <span className="inline-flex flex-wrap items-center"><IconHash className="size-3" />{i + 1}</span>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {t2.team_name}
                            {t2.is_zeroed && (
                              <Badge variant="destructive" className="text-[10px]">
                                <IconBan className="size-3" /> {t("teams.zeroed")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <TierBadge tier={effectiveTier} />
                            {t2.tier_overridden && !t2.is_zeroed && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                {t("teams.overridden")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-primary">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {!t2.is_zeroed && deducted > 0 && (
                              <Badge
                                variant="outline"
                                className="rounded-full border-orange-500/40 px-2 py-0.5 text-[10px] font-medium text-orange-400 tabular-nums"
                              >
                                {t("teams.deducted", { count: deducted })}
                              </Badge>
                            )}
                            <span>{netScore}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {/* Each action ⓘ is a SIBLING of its button - explains what the manual correction does. */}
                            {/* data-tour anchor: overrides tour "Override tier" step. Anchored on
                                the first row's (always-rendered) override button as the
                                representative target for the per-row tier override action. */}
                            <Button data-tour={i === 0 ? "overrides-tier" : undefined} size="sm" variant="outline" onClick={() => setOverrideTeam(t2)}>
                              <IconGavel className="mr-1 size-3.5" /> {t("teams.overrideTier")}
                            </Button>
                            <InfoTip id="rankings.overrides.override_tier" />
                            {!t2.is_zeroed && (
                              <>
                                {/* data-tour anchor: overrides tour "Deduct points" step
                                    (representative first non-zeroed row's deduct button). */}
                                <Button
                                  data-tour={i === 0 ? "overrides-deduct" : undefined}
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-400"
                                  onClick={() => setDeductTeam(t2)}
                                >
                                  <IconMinus className="mr-1 size-3.5" /> {t("teams.deduct")}
                                </Button>
                                <InfoTip id="rankings.overrides.deduct_points" />
                              </>
                            )}
                            {!t2.is_zeroed && deducted > 0 && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => setClearTeam(t2)}
                                >
                                  <IconArrowBackUp className="mr-1 size-3.5" /> {t("teams.reset")}
                                </Button>
                                <InfoTip id="rankings.overrides.clear_deduction" />
                              </>
                            )}
                            {t2.is_zeroed ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setRestoreTeamRow(t2)}>
                                  <IconArrowBackUp className="mr-1 size-3.5" /> {t("teams.restore")}
                                </Button>
                                <InfoTip id="rankings.overrides.restore_team" />
                              </>
                            ) : (
                              <>
                                {/* data-tour anchor: overrides tour "Ban or zero out" step
                                    (representative first non-zeroed row's ban-zero button). */}
                                <Button
                                  data-tour={i === 0 ? "overrides-ban" : undefined}
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setBanTeam(t2)}
                                >
                                  <IconBan className="mr-1 size-3.5" /> {t("teams.banZero")}
                                </Button>
                                <InfoTip id="rankings.overrides.ban_zero_team" />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="flex items-start gap-2 rounded-md border border-orange-500/20 bg-orange-500/5 p-3 text-xs text-muted-foreground">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-500" />
            <span>
              {/* One message with an inline <b> lead sentence, so the emphasis can move with the
                  sentence order instead of being two glued fragments. */}
              {t.rich("teams.note", {
                b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
              })}
            </span>
          </p>
        </>
      )}

      {/* PLAYERS */}
      {tab === "players" && (
        <>
          <p className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {t.rich("players.note", {
                b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
              })}
            </span>
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("players.cardTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("players.colPlayer")}</TableHead>
                    <TableHead>{t("players.colTeam")}</TableHead>
                    <TableHead>{t("players.colInheritedTier")}</TableHead>
                    <TableHead className="text-right">{t("players.colAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                        {q ? t("players.noMatch", { q }) : t("players.empty")}
                      </TableCell>
                    </TableRow>
                  ) : filteredPlayers.map((p) => (
                    <TableRow key={p.player_id} className={cn(p.zeroed && "bg-destructive/5")}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {p.username}
                          {p.zeroed && (
                            <Badge variant="destructive" className="text-[10px]">
                              <IconBan className="size-3" /> {t("players.zeroed")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <TierBadge tier={(p.tier ?? 3) as 0 | 1 | 2 | 3} />
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            <IconShieldCheck className="size-3" /> {t("players.inherited")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={p.zeroed}
                            className={cn(
                              !p.zeroed &&
                                "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
                            )}
                            onClick={() => setBanPlayer(p)}
                          >
                            <IconBan className="mr-1 size-3.5" />
                            {p.zeroed ? t("players.zeroed") : t("players.banCta")}
                          </Button>
                          {/* ⓘ explains zeroing one player's contribution (sibling of the button). */}
                          <InfoTip id="rankings.overrides.ban_zero_player" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* dialogs */}
      <TierOverrideDialog
        team={overrideTeam}
        open={!!overrideTeam}
        onOpenChange={(v) => !v && setOverrideTeam(null)}
        onConfirm={applyOverride}
      />
      <DeductPointsDialog
        team={deductTeam}
        open={!!deductTeam}
        onOpenChange={(v) => !v && setDeductTeam(null)}
        onConfirm={deductPoints}
      />
      <ClearDeductionDialog
        team={clearTeam}
        open={!!clearTeam}
        onOpenChange={(v) => !v && setClearTeam(null)}
        onConfirm={resetDeduction}
      />
      <BanZeroTeamDialog
        team={banTeam}
        open={!!banTeam}
        onOpenChange={(v) => !v && setBanTeam(null)}
        onConfirm={zeroTeam}
      />
      <RestoreTeamDialog
        team={restoreTeamRow}
        open={!!restoreTeamRow}
        onOpenChange={(v) => !v && setRestoreTeamRow(null)}
        onConfirm={restoreTeam}
      />
      <BanZeroPlayerDialog
        player={banPlayer}
        open={!!banPlayer}
        onOpenChange={(v) => !v && setBanPlayer(null)}
        onConfirm={zeroPlayer}
      />
    </div>
  );
}
