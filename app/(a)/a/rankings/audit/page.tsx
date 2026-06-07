"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FullLoader } from "@/components/Loader";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { Season } from "@/lib/rankings";
import {
  IconHistory, IconSearch, IconDatabase, IconShieldLock, IconUser,
  IconCalendarStats, IconFilter, IconAlertTriangle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

// One entry per object_type the backend audit logger emits (admin_audit; spec §16, every
// write is logged). Every reason-gated action across the sibling rankings admin pages -
// results / overrides / ghost-teams / social / prize / seasons - lands here as one of these.
const OBJECT_TYPES = [
  { value: "tournament_result", label: "Tournament result" },
  { value: "scrim_result", label: "Scrim result" },
  { value: "prize_money", label: "Prize money" },
  { value: "social_media", label: "Social media" },
  { value: "roster", label: "Roster" },
  { value: "ghost_claim", label: "Ghost claim" },
  { value: "tier_override", label: "Tier override" },
  { value: "ban_zeroing", label: "Ban / zeroing" },
  { value: "transfer_window", label: "Transfer window" },
  { value: "season", label: "Season" },
  { value: "evaluation", label: "Evaluation" },
] as const;

const TYPE_LABEL: Record<string, string> =
  Object.fromEntries(OBJECT_TYPES.map((t) => [t.value, t.label]));

// Per-type badge colour so the table scans fast. Destructive things read red/orange.
const TYPE_TONE: Record<string, string> = {
  tournament_result: "text-green-400 border-green-600/50",
  scrim_result: "text-emerald-400 border-emerald-600/50",
  prize_money: "text-amber-400 border-amber-500/50",
  social_media: "text-sky-400 border-sky-600/50",
  roster: "text-blue-400 border-blue-600/50",
  ghost_claim: "text-violet-400 border-violet-600/50",
  tier_override: "text-orange-400 border-orange-600/50",
  ban_zeroing: "text-red-400 border-red-600/50",
  transfer_window: "text-cyan-400 border-cyan-600/50",
  season: "text-muted-foreground border-border",
  evaluation: "text-primary border-primary/50",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// One audit row as returned by GET /rankings/admin/audit-log/ (admin_audit.serialize_audit).
interface AuditRow {
  audit_id: number;
  object_type: string;
  object_ref: string | null;
  action: string;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  season_id: number | null;
  before_snapshot: unknown;
  after_snapshot: unknown;
}

// Component breakdown returned by GET /rankings/admin/teams/<id>/raw/ and .../players/<id>/raw/.
// Team and player share many keys; the union covers both serialize_*_raw shapes.
interface RawBreakdown {
  total: number;
  tournament_pts?: number;
  scrim_pts?: number;
  prize_money_pts?: number;
  social_media_pts?: number;
  kill_pts?: number;
  placement_pts?: number;
  mvp_pts?: number;
  finals_pts?: number;
  team_win_pts?: number;
  participation_pts?: number;
  scrim_kill_pts?: number;
  scrim_win_pts?: number;
  wins?: number;
  kills?: number;
  mvps?: number;
  finals_appearances?: number;
  tournaments_played?: number;
}

interface RawResponse {
  team_id?: number;
  player_id?: number;
  team_name?: string;
  username?: string;
  season: Season | null;
  raw: RawBreakdown;
}

// Human labels for the raw-breakdown component keys, in display order.
const RAW_LABELS: { key: keyof RawBreakdown; label: string }[] = [
  { key: "tournament_pts", label: "Tournament points" },
  { key: "scrim_pts", label: "Scrim points" },
  { key: "kill_pts", label: "Kill points" },
  { key: "placement_pts", label: "Placement points" },
  { key: "mvp_pts", label: "MVP points" },
  { key: "finals_pts", label: "Finals points" },
  { key: "team_win_pts", label: "Team-win points" },
  { key: "participation_pts", label: "Participation points" },
  { key: "scrim_kill_pts", label: "Scrim kill points" },
  { key: "scrim_win_pts", label: "Scrim win points" },
  { key: "prize_money_pts", label: "Prize-money points" },
  { key: "social_media_pts", label: "Social-media points" },
];

// Tiebreaker / count keys shown as a compact footer chip row, not as score rows.
const RAW_COUNTS: { key: keyof RawBreakdown; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "kills", label: "Kills" },
  { key: "mvps", label: "MVPs" },
  { key: "finals_appearances", label: "Finals" },
  { key: "tournaments_played", label: "Tournaments" },
];

export default function AuditLogPage() {
  // ── audit log state ──────────────────────────────────────────────────────
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Server-side filters (object_type / date range) drive the fetch; the reason
  // search `q` stays client-side over the fetched page (the backend has no
  // free-text reason param), preserving the original instant-filter UX.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const params: Record<string, any> = { limit: 100 };
    if (type !== "all") params.object_type = type;
    if (from) params.date_from = from;
    if (to) params.date_to = to;
    rankingsAdminApi
      .auditLog(params)
      .then((r) => {
        if (!active) return;
        setRows(r.results ?? []);
      })
      .catch((err: any) => {
        if (!active) return;
        toast.error(err?.response?.data?.message || "Failed to load audit log");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type, from, to]);

  // Reason free-text narrowing happens on the already-fetched rows.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => (r.reason ?? "").toLowerCase().includes(needle));
  }, [rows, q]);

  const clearFilters = () => { setType("all"); setQ(""); setFrom(""); setTo(""); };
  const filtersActive = type !== "all" || q.trim() !== "" || from !== "" || to !== "";

  // ── raw data viewer state ────────────────────────────────────────────────
  const [rawOpen, setRawOpen] = useState(false);
  const [rawKind, setRawKind] = useState<"team" | "player">("team");
  const [rawId, setRawId] = useState("");
  const [rawLoading, setRawLoading] = useState(false);
  const [raw, setRaw] = useState<RawResponse | null>(null);

  const loadRaw = () => {
    const id = Number(rawId);
    if (!id) { toast.error("Enter a numeric ID."); return; }
    setRawLoading(true);
    setRaw(null);
    const req = rawKind === "team"
      ? rankingsAdminApi.teamRaw(id)
      : rankingsAdminApi.playerRaw(id);
    req
      .then((r: RawResponse) => setRaw(r))
      .catch((err: any) =>
        toast.error(err?.response?.data?.message || "Failed to load raw data"))
      .finally(() => setRawLoading(false));
  };

  // Reset the viewer's loaded data when it closes so a re-open starts clean.
  const onRawOpenChange = (open: boolean) => {
    setRawOpen(open);
    if (!open) { setRaw(null); setRawId(""); }
  };

  // Only the component rows the current breakdown actually carries.
  const rawScoreRows = raw
    ? RAW_LABELS.filter(({ key }) => raw.raw[key] != null)
    : [];
  const rawCountChips = raw
    ? RAW_COUNTS.filter(({ key }) => raw.raw[key] != null)
    : [];
  const rawSubjectName = raw?.team_name ?? raw?.username ?? "";

  if (loading && rows.length === 0) return <FullLoader text="Loading audit log" />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        title={
          <span className="inline-flex items-center">
            Audit Log
            <InfoTip id="rankings.audit._page" className="ml-1.5" />
          </span>
        }
        description="Every ranking edit, override, and recalculation, who, what, when, and why. Plus the admins-only raw scoring data."
        action={
          // ⓘ sits beside the raw-data button (sibling, not nested).
          <div className="flex items-center gap-1">
            <Button variant="outline" onClick={() => setRawOpen(true)}>
              <IconDatabase className="mr-1.5 size-4" /> Raw data viewer
            </Button>
            <InfoTip id="rankings.audit.raw_viewer" />
          </div>
        }
      />

      {/* admins-only notice */}
      <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <IconShieldLock className="size-4 shrink-0 text-primary" />
        Audit entries and uncompressed raw data are visible to Head Admin and Metrics Admin only. All values below are read-only.
      </div>

      {/* filter row */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconFilter className="size-4 text-muted-foreground" /> Filters
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filtered.length} of {rows.length} entries
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Object type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All object types</SelectItem>
                {OBJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search reason"
                className="h-9 pl-8"
              />
            </div>

            <div className="relative">
              <IconCalendarStats className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 pl-8"
                aria-label="From date"
              />
            </div>

            <div className="relative">
              <IconCalendarStats className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 pl-8"
                aria-label="To date"
              />
            </div>
          </div>
          {filtersActive && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* audit table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconHistory className="size-4 text-muted-foreground" /> Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-28">Ref</TableHead>
                <TableHead className="w-28">Action</TableHead>
                <TableHead className="w-32">By</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No audit entries match these filters.
                  </TableCell>
                </TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.audit_id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {fmtTime(r.changed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-full text-xs", TYPE_TONE[r.object_type])}>
                      {TYPE_LABEL[r.object_type] ?? r.object_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.object_ref ?? "-"}</TableCell>
                  <TableCell className="text-xs font-medium capitalize">{r.action}</TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      <IconUser className="size-3 text-muted-foreground" />{r.changed_by ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-md text-xs text-muted-foreground">{r.reason ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* raw data viewer dialog */}
      <Dialog open={rawOpen} onOpenChange={onRawOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconDatabase className="size-5 text-primary" />
              Raw Scoring Data{rawSubjectName ? `, ${rawSubjectName}` : ""}
            </DialogTitle>
            <DialogDescription>
              Recomputed component breakdown behind a team or player&apos;s current-quarter score, before
              it was rolled up to a single total. Use this to audit exactly how a published score was built.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-md border border-orange-600/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-400">
            <IconShieldLock className="size-4 shrink-0" />
            Admins-only raw data. These uncompressed values are never exposed publicly (spec §17).
          </div>

          {/* subject picker - drives teamRaw(id) / playerRaw(id) */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
            <Select value={rawKind} onValueChange={(v) => { setRawKind(v as "team" | "player"); setRaw(null); }}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="player">Player</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={rawId}
              onChange={(e) => setRawId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadRaw(); }}
              placeholder={rawKind === "team" ? "Team ID" : "Player ID"}
              inputMode="numeric"
              className="h-9"
              aria-label={rawKind === "team" ? "Team ID" : "Player ID"}
            />
            <Button onClick={loadRaw} disabled={rawLoading || !rawId.trim()}>
              {rawLoading ? "Loading…" : "Load"}
            </Button>
          </div>

          {raw ? (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawScoreRows.map(({ key, label }) => (
                      <TableRow key={key}>
                        <TableCell className="text-xs font-medium">{label}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {Number(raw.raw[key]).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="text-right text-xs font-semibold">
                        Total score
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold tabular-nums text-primary">
                        {Number(raw.raw.total).toFixed(0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {rawCountChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rawCountChips.map(({ key, label }) => (
                    <Badge key={key} variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                      {label}: <span className="ml-1 tabular-nums text-foreground">{raw.raw[key]}</span>
                    </Badge>
                  ))}
                  {raw.season && (
                    <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                      Season: <span className="ml-1 text-foreground">{raw.season.name}</span>
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                Component points are recomputed from source results (not re-read from the stored row), so this
                breakdown is the exact derivation behind the current-quarter total. The count chips above are the
                tiebreaker tallies that feed ranking, not score inputs.
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
              {rawLoading
                ? "Loading raw scoring data…"
                : `Enter a ${rawKind} ID and load to see its uncompressed component breakdown.`}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onRawOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
