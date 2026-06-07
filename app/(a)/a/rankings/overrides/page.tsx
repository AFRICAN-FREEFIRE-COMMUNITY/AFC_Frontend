"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { TIER_LABELS } from "@/lib/rankingsMock";
import {
  rankingsApi,
  Season,
  TeamRow as ApiTeamRow,
  PlayerRow as ApiPlayerRow,
} from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
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
            <IconGavel className="size-5 text-primary" /> Override tier, {team.team_name}
          </DialogTitle>
          <DialogDescription>
            Manually set this team&apos;s tier. The override sticks until you change it
            and is written to the audit log with your reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* what we're overriding (read-only context) */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="space-y-1">
              <p className="text-xs uppercase font-semibold text-muted-foreground">Current tier</p>
              <TierBadge tier={computed} />
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="space-y-1 text-right">
              <p className="text-xs uppercase font-semibold text-muted-foreground">Score</p>
              <p className="text-lg font-bold tabular-nums">{team.total_score}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ovr-tier">New tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger id="ovr-tier" className="w-full">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    Tier {t} · {TIER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!changed && tier !== "" && (
              <p className="text-xs text-muted-foreground">
                Same as the current tier, saving will clear any existing override.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ovr-reason">Reason</Label>
            <Textarea
              id="ovr-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this tier being overridden? (min 10 characters, appears in the audit log)"
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim().length}/{MIN_REASON} characters minimum.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go back</Button>
          <Button
            disabled={!ready}
            onClick={() => onConfirm(Number(tier), reason.trim())}
          >
            <IconGavel className="mr-1.5 size-4" /> Apply override
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
            <IconArrowDown className="size-5 text-orange-400" /> Deduct points, {team.team_name}
          </DialogTitle>
          <DialogDescription>
            Subtract a specific number of points as a partial penalty. Unlike a ban-zero,
            this leaves the team ranked, the deduction is written to the audit log with your reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* live current -> resulting context */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="space-y-1">
              <p className="text-xs uppercase font-semibold text-muted-foreground">Current score</p>
              <p className="text-lg font-bold tabular-nums">{current}</p>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="space-y-1 text-right">
              <p className="text-xs uppercase font-semibold text-muted-foreground">Resulting score</p>
              <p className="text-lg font-bold tabular-nums text-orange-400">{resulting}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ded-amount">Points to deduct</Label>
            <Input
              id="ded-amount"
              type="number"
              min={1}
              max={current}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`1 - ${current}`}
              className="tabular-nums"
            />
            {amount !== "" && !validAmount && (
              <p className="text-xs text-orange-400">
                Enter a whole number between 1 and {current}.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ded-reason">Reason</Label>
            <Textarea
              id="ded-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are points being deducted? (min 10 characters, appears in the audit log)"
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim().length}/{MIN_REASON} characters minimum.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go back</Button>
          <Button disabled={!ready} onClick={() => onConfirm(deduction, reason.trim())}>
            <IconMinus className="mr-1.5 size-4" /> Deduct points
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
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!team) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconArrowBackUp className="size-5 text-primary" /> Reset deductions, {team.team_name}
          </DialogTitle>
          <DialogDescription>
            Removes the team&apos;s partial point penalty and restores its full derived
            score. The reset is written to the audit log with your reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="clr-reason">Reason</Label>
          <Textarea
            id="clr-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are the deductions being cleared? (min 10 characters, appears in the audit log)"
          />
          <p className="text-xs text-muted-foreground">
            {reason.trim().length}/{MIN_REASON} characters minimum.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go back</Button>
          <Button disabled={!ready} onClick={() => onConfirm(reason.trim())}>
            <IconArrowBackUp className="mr-1.5 size-4" /> Clear deductions
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
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!team) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <IconAlertTriangle className="size-5" /> Ban-zero {team.team_name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This sets the team&apos;s score to <span className="font-semibold text-foreground">0</span> for
            the current quarter and forces them to the bottom tier. Use only for confirmed
            cheating or manipulation (§16). The team stays zeroed until you restore it.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ban-reason">Reason</Label>
          <Textarea
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this team being zeroed? (min 10 characters, appears in the audit log)"
          />
          <p className="text-xs text-muted-foreground">
            {reason.trim().length}/{MIN_REASON} characters minimum.
          </p>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => onConfirm(reason.trim())}
          >
            <IconBan className="mr-1.5 size-4" /> Zero for the quarter
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
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!team) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconArrowBackUp className="size-5 text-primary" /> Restore {team.team_name}
          </DialogTitle>
          <DialogDescription>
            Lifts the team&apos;s ban-zero and lets the next recalculation recompute its
            score and tier from scratch. The restore is written to the audit log with your reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rst-reason">Reason</Label>
          <Textarea
            id="rst-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this team being restored? (min 10 characters, appears in the audit log)"
          />
          <p className="text-xs text-muted-foreground">
            {reason.trim().length}/{MIN_REASON} characters minimum.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go back</Button>
          <Button disabled={!ready} onClick={() => onConfirm(reason.trim())}>
            <IconArrowBackUp className="mr-1.5 size-4" /> Restore team
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
  const [reason, setReason] = useState("");
  React.useEffect(() => { if (open) setReason(""); }, [open]);
  if (!player) return null;
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <IconBan className="size-5" /> Ban-zero player, {player.username}
          </DialogTitle>
          <DialogDescription>
            Zeroes this player&apos;s individual score for the current quarter and
            recalculates their team. They stay zeroed until restored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="pban-reason">Reason</Label>
          <Textarea
            id="pban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this player being zeroed? (min 10 characters, appears in the audit log)"
          />
          <p className="text-xs text-muted-foreground">
            {reason.trim().length}/{MIN_REASON} characters minimum.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Go back</Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => onConfirm(reason.trim())}
          >
            <IconBan className="mr-1.5 size-4" /> Zero for the quarter
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
      } catch (err: any) {
        if (!active) return;
        toast.error(err?.response?.data?.message || "Failed to load season");
        setLoading(false);
      }
    })();
    return () => { active = false; };
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
        toast.error(err?.response?.data?.message || "Failed to load overrides");
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

  const filteredTeams = useMemo(
    () => teams.filter((t) => t.team_name.toLowerCase().includes(q.toLowerCase())),
    [teams, q],
  );
  const filteredPlayers = useMemo(
    () => playersView.filter((p) => p.username.toLowerCase().includes(q.toLowerCase())),
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
          ? `Override cleared for ${target.team_name}`
          : `${target.team_name} tier overridden to ${TIER_LABELS[tier]}`,
      );
      setOverrideTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to override tier");
    }
  };

  const deductPoints = async (points: number, reason: string) => {
    const target = deductTeam;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.deductPoints(season.season_id, target.team_id, { points, reason });
      toast.success(`Deducted ${points} pts from ${target.team_name}`);
      setDeductTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to deduct points");
    }
  };

  const resetDeduction = async (reason: string) => {
    const target = clearTeam;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.clearDeduction(season.season_id, target.team_id, { reason });
      toast.success(`Deductions cleared for ${target.team_name}`);
      setClearTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to clear deductions");
    }
  };

  const zeroTeam = async (reason: string) => {
    const target = banTeam;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.zeroTeam(season.season_id, target.team_id, { reason });
      toast.success("Team zeroed for the quarter");
      setBanTeam(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to zero team");
    }
  };

  const restoreTeam = async (reason: string) => {
    const target = restoreTeamRow;
    if (!target || !season || target.team_id == null) return;
    try {
      await rankingsAdminApi.unzeroTeam(season.season_id, target.team_id, { reason });
      toast.success(`${target.team_name} restored`);
      setRestoreTeamRow(null);
      await loadTeams(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to restore team");
    }
  };

  const zeroPlayer = async (reason: string) => {
    if (!banPlayer || !season) return;
    const target = banPlayer;
    try {
      await rankingsAdminApi.zeroPlayer(season.season_id, target.player_id, { reason });
      toast.success("Player zeroed for the quarter");
      setBanPlayer(null);
      // Public player read omits is_zeroed; record it locally so the badge sticks.
      setZeroedPlayerIds((prev) => new Set(prev).add(target.player_id));
      await loadPlayers(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to zero player");
    }
  };

  if (loading && !teams.length && !players.length) {
    return <FullLoader text="Loading overrides & bans" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        title={
          <span className="inline-flex items-center">
            Overrides & Bans
            <InfoTip id="rankings.overrides._page" className="ml-1.5" />
          </span>
        }
        description="Manually correct tier assignments and zero out cheating teams or players. Every action is logged with a reason."
      />

      {/* status strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          icon={<IconGavel className="size-4" />}
          title="Tier overrides" value={overriddenCount}
          sub="Teams on a manual tier"
        />
        <StatCard
          icon={<IconArrowDown className="size-4" />}
          title="Point deductions" value={deductedTeamsCount}
          sub={totalDeducted > 0 ? `${totalDeducted} pts removed this quarter` : "Teams with a partial penalty"}
          tone="text-orange-400"
        />
        <StatCard
          icon={<IconBan className="size-4" />}
          title="Zeroed teams" value={zeroedCount}
          sub="Banned this quarter"
          tone="text-destructive"
        />
        <StatCard
          icon={<IconUser className="size-4" />}
          title="Zeroed players" value={playersView.filter((p) => p.zeroed).length}
          sub="Banned this quarter"
          tone="text-destructive"
        />
      </div>

      {/* tabs + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
          {([
            { key: "teams", label: "Teams", icon: IconUsers },
            { key: "players", label: "Players", icon: IconUser },
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
        <div className="relative w-full sm:w-64">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "teams" ? "Search teams" : "Search players"}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {/* TEAMS */}
      {tab === "teams" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teams</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {q ? `No teams match “${q}”.` : "No evaluated teams for this season."}
                      </TableCell>
                    </TableRow>
                  ) : filteredTeams.map((t, i) => {
                    const effectiveTier = (t.tier ?? 3) as 0 | 1 | 2 | 3;
                    const deducted = t.points_deducted ?? 0;
                    const netScore = t.is_zeroed ? 0 : Math.max(0, t.effective_score ?? t.total_score);
                    return (
                      <TableRow key={t.team_id} className={cn(t.is_zeroed && "bg-destructive/5")}>
                        <TableCell className="font-semibold text-muted-foreground">
                          <span className="inline-flex items-center"><IconHash className="size-3" />{i + 1}</span>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {t.team_name}
                            {t.is_zeroed && (
                              <Badge variant="destructive" className="text-[10px]">
                                <IconBan className="size-3" /> Zeroed
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <TierBadge tier={effectiveTier} />
                            {t.tier_overridden && !t.is_zeroed && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Overridden
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-primary">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {!t.is_zeroed && deducted > 0 && (
                              <Badge
                                variant="outline"
                                className="rounded-full border-orange-500/40 px-2 py-0.5 text-[10px] font-medium text-orange-400 tabular-nums"
                              >
                                −{deducted} pts
                              </Badge>
                            )}
                            <span>{netScore}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {/* Each action ⓘ is a SIBLING of its button - explains what the manual correction does. */}
                            <Button size="sm" variant="outline" onClick={() => setOverrideTeam(t)}>
                              <IconGavel className="mr-1 size-3.5" /> Override tier
                            </Button>
                            <InfoTip id="rankings.overrides.override_tier" />
                            {!t.is_zeroed && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-400"
                                  onClick={() => setDeductTeam(t)}
                                >
                                  <IconMinus className="mr-1 size-3.5" /> Deduct
                                </Button>
                                <InfoTip id="rankings.overrides.deduct_points" />
                              </>
                            )}
                            {!t.is_zeroed && deducted > 0 && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => setClearTeam(t)}
                                >
                                  <IconArrowBackUp className="mr-1 size-3.5" /> Reset
                                </Button>
                                <InfoTip id="rankings.overrides.clear_deduction" />
                              </>
                            )}
                            {t.is_zeroed ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setRestoreTeamRow(t)}>
                                  <IconArrowBackUp className="mr-1 size-3.5" /> Restore
                                </Button>
                                <InfoTip id="rankings.overrides.restore_team" />
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setBanTeam(t)}
                                >
                                  <IconBan className="mr-1 size-3.5" /> Ban-zero
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
              <span className="font-semibold text-foreground">Deduct for partial penalties, ban-zero
              for total ones.</span> A deduction subtracts a set number of points and leaves the team
              ranked, multiple deductions accumulate and can be reset. A ban-zero forces the
              team&apos;s score to 0 and the bottom tier for the whole quarter, it is not lifted by
              recalculation and stays until an admin explicitly restores the team.
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
              <span className="font-semibold text-foreground">Players inherit their team&apos;s tier
              and are not individually overridden.</span> The only manual action available here is a
              ban-zero, which removes a single player&apos;s contribution for the quarter (e.g. confirmed
              individual cheating) and recalculates their team.
            </span>
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Players</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Inherited tier</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                        {q ? `No players match “${q}”.` : "No players for this season."}
                      </TableCell>
                    </TableRow>
                  ) : filteredPlayers.map((p) => (
                    <TableRow key={p.player_id} className={cn(p.zeroed && "bg-destructive/5")}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {p.username}
                          {p.zeroed && (
                            <Badge variant="destructive" className="text-[10px]">
                              <IconBan className="size-3" /> Zeroed
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <TierBadge tier={(p.tier ?? 3) as 0 | 1 | 2 | 3} />
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            <IconShieldCheck className="size-3" /> Inherited
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
                            {p.zeroed ? "Zeroed" : "Ban-zero player"}
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
