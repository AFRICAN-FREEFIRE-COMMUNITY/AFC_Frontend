"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
// Name-search pickers so the admin looks a team/player up BY NAME instead of typing a raw
// numeric id (owner 2026-06-29: "we dont know IDs... no way to view the data"). Same pickers
// used on the standalone-leaderboard + organizer-blacklist + overrides flows. TeamSearchSelect
// emits the team_id; UserSearchSelect emits the username + the full PickedUser (we read user_id,
// which is what playerRaw() keys off - player_id == User PK, per afc_rankings.admin_audit).
import { TeamSearchSelect } from "@/components/ui/team-search-select";
import { UserSearchSelect } from "@/components/ui/user-search-select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FullLoader } from "@/components/Loader";
// changed_at is a UTC DateTimeField (afc_rankings.AuditLog), i.e. an instant, so it renders
// through LocalTime: the VIEWER's timezone + the active UI language, hydration-safe.
import { LocalTime } from "@/components/LocalTime";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { Season } from "@/lib/rankings";
import { matchesSearch } from "@/lib/search";
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
// Only the RAW enum values live here: they are sent back to the API as the ?object_type=
// filter. The friendly label of each one is translated copy and lives in the message
// catalog under rankings.admin.audit.objectTypes.<value>.
const OBJECT_TYPES = [
  "tournament_result",
  "scrim_result",
  "prize_money",
  "social_media",
  "roster",
  "ghost_claim",
  "tier_override",
  "ban_zeroing",
  "transfer_window",
  "season",
  "evaluation",
] as const;

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

// The raw-breakdown component keys, in display order. The human label of each one is
// translated copy: rankings.admin.audit.raw.components.<key> in the message catalog.
const RAW_COMPONENT_KEYS: (keyof RawBreakdown)[] = [
  "tournament_pts",
  "scrim_pts",
  "kill_pts",
  "placement_pts",
  "mvp_pts",
  "finals_pts",
  "team_win_pts",
  "participation_pts",
  "scrim_kill_pts",
  "scrim_win_pts",
  "prize_money_pts",
  "social_media_pts",
];

// Tiebreaker / count keys shown as a compact footer chip row, not as score rows.
// Labels: rankings.admin.audit.raw.counts.<key>.
const RAW_COUNT_KEYS: (keyof RawBreakdown)[] = [
  "wins",
  "kills",
  "mvps",
  "finals_appearances",
  "tournaments_played",
];

export default function AuditLogPage() {
  const t = useTranslations("rankings.admin.audit");
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
        toast.error(err?.response?.data?.message || t("loadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // `t` is only read inside the error toast; re-fetching on a language change is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, from, to]);

  // Reason free-text narrowing happens on the already-fetched rows.
  // Uses the shared matchesSearch helper (lib/search.ts) so reason search is
  // punctuation, accent, and fancy-font insensitive like every other "Search" box on the site.
  // matchesSearch returns true for an empty query, so the `q`-empty case is handled inside it.
  const filtered = useMemo(() => {
    return rows.filter((r) => matchesSearch([r.reason], q));
  }, [rows, q]);

  const clearFilters = () => { setType("all"); setQ(""); setFrom(""); setTo(""); };
  const filtersActive = type !== "all" || q.trim() !== "" || from !== "" || to !== "";

  // Friendly label for an object_type enum. A value the frontend does not know about (the
  // backend can add new choices) falls back to the RAW enum, which is API data, not UI copy.
  const typeLabel = (value: string) =>
    (OBJECT_TYPES as readonly string[]).includes(value)
      ? t(`objectTypes.${value}` as never)
      : value;

  // ── raw data viewer state ────────────────────────────────────────────────
  const [rawOpen, setRawOpen] = useState(false);
  const [rawKind, setRawKind] = useState<"team" | "player">("team");
  // The picked subject. Team branch holds the team_id (TeamSearchSelect emits it directly);
  // player branch holds the controlled username (UserSearchSelect's value) + the resolved
  // user_id (playerRaw keys off the User PK, so we load by user_id, not username).
  const [rawTeamId, setRawTeamId] = useState<number | null>(null);
  const [rawUsername, setRawUsername] = useState<string | null>(null);
  const [rawUserId, setRawUserId] = useState<number | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [raw, setRaw] = useState<RawResponse | null>(null);

  // The numeric id we'd load for the current kind (team_id or user_id); null until a pick.
  const rawSubjectId = rawKind === "team" ? rawTeamId : rawUserId;
  // Clear any picked subject (on close, or when flipping Team<->Player so a stale pick can't carry).
  const clearRawSubject = () => { setRawTeamId(null); setRawUsername(null); setRawUserId(null); };

  const loadRaw = () => {
    if (!rawSubjectId) {
      // Separate keys per kind: "a team" / "a player" take a different article and gender
      // in French and Portuguese, so this cannot be one sentence plus a noun.
      toast.error(rawKind === "team" ? t("raw.pickTeam") : t("raw.pickPlayer"));
      return;
    }
    setRawLoading(true);
    setRaw(null);
    const req = rawKind === "team"
      ? rankingsAdminApi.teamRaw(rawSubjectId)
      : rankingsAdminApi.playerRaw(rawSubjectId);
    req
      .then((r: RawResponse) => setRaw(r))
      .catch((err: any) =>
        toast.error(err?.response?.data?.message || t("raw.loadFailed")))
      .finally(() => setRawLoading(false));
  };

  // Reset the viewer's loaded data + picked subject when it closes so a re-open starts clean.
  const onRawOpenChange = (open: boolean) => {
    setRawOpen(open);
    if (!open) { setRaw(null); clearRawSubject(); }
  };

  // Only the component rows the current breakdown actually carries.
  const rawScoreRows = raw
    ? RAW_COMPONENT_KEYS.filter((key) => raw.raw[key] != null)
    : [];
  const rawCountChips = raw
    ? RAW_COUNT_KEYS.filter((key) => raw.raw[key] != null)
    : [];
  const rawSubjectName = raw?.team_name ?? raw?.username ?? "";

  if (loading && rows.length === 0) return <FullLoader text={t("loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: audit tour "Audit log" step.
        title={
          <span data-tour="audit-title" className="inline-flex flex-wrap items-center">
            {t("title")}
            <InfoTip id="rankings.audit._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        action={
          // ⓘ sits beside the raw-data button (sibling, not nested).
          <div className="flex items-center gap-1">
            {/* data-tour anchor: audit tour "Raw data breakdown" step. */}
            <Button data-tour="audit-raw" variant="outline" onClick={() => setRawOpen(true)}>
              <IconDatabase className="mr-1.5 size-4" /> {t("rawViewerCta")}
            </Button>
            <InfoTip id="rankings.audit.raw_viewer" />
          </div>
        }
      />

      {/* admins-only notice */}
      <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <IconShieldLock className="size-4 shrink-0 text-primary" />
        {t("adminsOnly")}
      </div>

      {/* filter row
          data-tour anchor: audit tour "Filter by type and date" step. */}
      <Card data-tour="audit-filters">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconFilter className="size-4 text-muted-foreground" /> {t("filters.title")}
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {/* One ICU sentence, so "entry / entries" pluralizes per language instead of
                gluing a hardcoded "s" onto a translated noun. */}
            {t("filters.count", { shown: filtered.length, total: rows.length })}
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={t("filters.objectTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allObjectTypes")}</SelectItem>
                {/* The option VALUE stays the raw enum (it is the API filter argument);
                    only the label is translated. */}
                {OBJECT_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>{typeLabel(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* data-tour anchor: audit tour "Search by reason" step. */}
            <div data-tour="audit-search" className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("filters.searchReason")}
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
                aria-label={t("filters.fromDate")}
              />
            </div>

            <div className="relative">
              <IconCalendarStats className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 pl-8"
                aria-label={t("filters.toDate")}
              />
            </div>
          </div>
          {filtersActive && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                {t("filters.clear")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* audit table
          data-tour anchor: audit tour "Audit entries" step. */}
      <Card data-tour="audit-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconHistory className="size-4 text-muted-foreground" /> {t("table.title")}
          </CardTitle>
        </CardHeader>
        {/* data-tour anchor: audit tour "Before and after" step. The table body is the stable
            target where each entry's change detail (before / after snapshots) is read; there is
            no separate snapshot dialog element to anchor, so the entries region stands in. */}
        <CardContent data-tour="audit-details" className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">{t("table.colTime")}</TableHead>
                <TableHead>{t("table.colType")}</TableHead>
                <TableHead className="w-28">{t("table.colRef")}</TableHead>
                <TableHead className="w-28">{t("table.colAction")}</TableHead>
                <TableHead className="w-32">{t("table.colBy")}</TableHead>
                <TableHead>{t("table.colReason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {t("table.empty")}
                  </TableCell>
                </TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.audit_id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {/* changed_at is a UTC instant, so it renders in the viewer's timezone
                        and the active UI language, not the browser's own locale. */}
                    <LocalTime value={r.changed_at} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("rounded-full text-xs", TYPE_TONE[r.object_type])}>
                      {typeLabel(r.object_type)}
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
              {/* Whole sentence per case rather than a title plus a glued-on ", name". */}
              {rawSubjectName ? t("raw.titleWithSubject", { name: rawSubjectName }) : t("raw.title")}
            </DialogTitle>
            <DialogDescription>
              {t("raw.desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-md border border-orange-600/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-400">
            <IconShieldLock className="size-4 shrink-0" />
            {t("raw.adminsOnly")}
          </div>

          {/* subject picker - drives teamRaw(id) / playerRaw(id) */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
            <Select value={rawKind} onValueChange={(v) => { setRawKind(v as "team" | "player"); setRaw(null); clearRawSubject(); }}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Values stay "team" / "player": they pick the teamRaw / playerRaw endpoint. */}
                <SelectItem value="team">{t("raw.team")}</SelectItem>
                <SelectItem value="player">{t("raw.player")}</SelectItem>
              </SelectContent>
            </Select>
            {/* Search by NAME (owner 2026-06-29) instead of a raw id box: pick a team -> we use its
                team_id; pick a player -> we use the picked user's user_id (playerRaw keys off User PK). */}
            {rawKind === "team" ? (
              <TeamSearchSelect
                value={rawTeamId}
                onChange={(teamId) => setRawTeamId(teamId)}
                placeholder={t("raw.searchTeam")}
              />
            ) : (
              <UserSearchSelect
                value={rawUsername}
                onChange={(username, user) => { setRawUsername(username); setRawUserId(user?.user_id ?? null); }}
                placeholder={t("raw.searchPlayer")}
              />
            )}
            <Button onClick={loadRaw} disabled={rawLoading || !rawSubjectId}>
              {rawLoading ? t("raw.loading") : t("raw.load")}
            </Button>
          </div>

          {raw ? (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("raw.colComponent")}</TableHead>
                      <TableHead className="text-right">{t("raw.colPoints")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawScoreRows.map((key) => (
                      <TableRow key={key}>
                        <TableCell className="text-xs font-medium">{t(`raw.components.${key}` as never)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {Number(raw.raw[key]).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="text-right text-xs font-semibold">
                        {t("raw.total")}
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
                  {/* chipLabel carries the colon so French can keep its space before it
                      ("Victoires :"); the value itself stays in its own styled span. */}
                  {rawCountChips.map((key) => (
                    <Badge key={key} variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                      {t("raw.chipLabel", { label: t(`raw.counts.${key}` as never) })}
                      <span className="ml-1 tabular-nums text-foreground">{raw.raw[key]}</span>
                    </Badge>
                  ))}
                  {raw.season && (
                    <Badge variant="outline" className="rounded-full text-[11px] text-muted-foreground">
                      {t("raw.chipLabel", { label: t("raw.season") })}
                      {/* The season NAME is API data, so it is never translated. */}
                      <span className="ml-1 text-foreground">{raw.season.name}</span>
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {t("raw.note")}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
              {/* One full sentence per kind instead of interpolating the noun: "a team" and
                  "a player" carry different articles and genders in French and Portuguese. */}
              {rawLoading
                ? t("raw.loadingData")
                : rawKind === "team" ? t("raw.emptyTeam") : t("raw.emptyPlayer")}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onRawOpenChange(false)}>{t("raw.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
