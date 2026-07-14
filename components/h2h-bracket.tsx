"use client";

// ── H2HBracketCard ────────────────────────────────────────────────────────────
// The CLASH SQUAD head-to-head BRACKET card. Renders the full bracket for one
// stage: a horizontal round-by-round tree for elimination formats (winners on
// top; losers bracket below with its own heading for double elim; the grand
// final labeled "Grand Final"), or "Matchday N" groups for league / round robin
// formats. Underneath the tree sits the live standings table (placement, W-L,
// rounds won/lost). Managers get the full write surface: a seed-ordered
// "Generate bracket" dialog (reorder with arrows, exclude with checkboxes,
// format select) and per-match result entry (click a match -> score dialog;
// corrections allowed until downstream matches complete - the backend
// enforces, we surface its message verbatim).
//
// HOW IT CONNECTS: lib/headToHead.ts -> afc_tournament_and_scrims/
// head_to_head_views.py (GET stages/<id>/bracket/, POST .../bracket/generate/,
// POST h2h-matches/<id>/result/). Mounted by the admin event page
// (app/(a)/a/events/[slug]) which passes the stage + the already-loaded
// registered team list as props - this component never refetches event
// details itself. When the final match completes the backend writes
// placements to the stage leaderboard and we toast that to the manager.
//
// Design: house admin idioms (Card rounded-md, compact text-xs tables with
// p-2 cells and text-foreground headers, outline rounded-full badges, dialogs).

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
// i18n: this card is mounted on the PUBLIC tournament page (spectator-facing) as well as the admin
// event page, so every string is translated (bracket.json, en/fr/pt). useTranslations works in this
// Client Component; each sub-component below calls it directly rather than prop-drilling `t`.
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  IconArrowDown, IconArrowUp, IconLoader2, IconPlus, IconRefresh, IconTrophy,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  headToHeadApi, type BracketFormat, type H2HBracket, type H2HMatch, type H2HRound,
  type H2HTeamRef,
} from "@/lib/headToHead";

// ── format helpers ────────────────────────────────────────────────────────────

// The bracket-namespace key for each format's human label (resolved via useTranslations at render).
const FMT_KEY: Record<BracketFormat, string> = {
  single_elim: "fmtSingleElim",
  double_elim: "fmtDoubleElim",
  league: "fmtLeague",
  round_robin_h2h: "fmtRoundRobin",
};

// Fixed format order for the generate-dialog select (labels come from FMT_KEY via t()).
const FMT_ORDER: BracketFormat[] = [
  "single_elim",
  "double_elim",
  "league",
  "round_robin_h2h",
];

// Localised label for a format. `t` is the bracket-namespace translator.
function fmtLabel(fmt: BracketFormat, t: (key: string) => string): string {
  return t(FMT_KEY[fmt]);
}

// Mirror the backend's stage_format -> fmt defaulting so the generate dialog
// preselects the same format the backend would pick if fmt were omitted:
// 'cs - knockout' -> single_elim, 'cs - double elimination' -> double_elim,
// 'cs - league' -> league, 'cs - round robin' -> round_robin_h2h,
// 'cs - normal' (and anything else) -> single_elim.
function defaultFmtForStageFormat(stageFormat: string): BracketFormat {
  const f = (stageFormat || "").toLowerCase();
  if (f.includes("double")) return "double_elim";
  if (f.includes("league")) return "league";
  if (f.includes("round robin")) return "round_robin_h2h";
  return "single_elim";
}

// League-family formats render as matchday lists instead of a tree.
function isLeagueFmt(fmt: BracketFormat): boolean {
  return fmt === "league" || fmt === "round_robin_h2h";
}

// Column heading for a winners-bracket round. Double elim's grand final lives
// in winners at round R+1, so its last column gets the "Grand Final" label.
// `t` is the bracket-namespace translator (interpolates {n} for the numbered rounds).
type BracketT = (key: string, values?: Record<string, string | number>) => string;

function winnersRoundLabel(
  index: number,
  total: number,
  fmt: BracketFormat,
  t: BracketT,
): string {
  if (index === total - 1) return fmt === "double_elim" ? t("grandFinal") : t("final");
  if (fmt === "double_elim" && index === total - 2) return t("winnersFinal");
  return t("round", { n: index + 1 });
}

function losersRoundLabel(index: number, total: number, t: BracketT): string {
  return index === total - 1 ? t("losersFinal") : t("losersRound", { n: index + 1 });
}

// Status dot color: gray = pending, orange (pulsing) = live, green = completed.
const STATUS_DOT: Record<H2HMatch["status"], string> = {
  pending: "bg-muted-foreground/50",
  live: "bg-orange-500 animate-pulse",
  completed: "bg-green-500",
};

// ── seed picker row (generate dialog) ─────────────────────────────────────────

interface SeedRow extends H2HTeamRef {
  included: boolean; // unchecked teams stay visible (reorderable) but are not sent
}

// ── MatchBox: one compact match in the elimination tree ───────────────────────
// Clickable for managers when both slots are filled and it is not a bye;
// corrections on completed matches are allowed here and policed by the backend.
function MatchBox({
  match,
  isManager,
  onReport,
}: {
  match: H2HMatch;
  isManager: boolean;
  onReport: (m: H2HMatch) => void;
}) {
  const t = useTranslations("bracket");
  const clickable = isManager && !match.is_bye && !!match.team_a && !!match.team_b;
  const showScores = match.status === "completed" && !match.is_bye;

  // One team line: name (TBD muted when the slot is unfilled), score, winner
  // bolded green.
  const teamLine = (slot: H2HTeamRef | null, score: number | null) => {
    const isWinner =
      match.status === "completed" && !!slot && match.winner_id === slot.tournament_team_id;
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span
          className={cn(
            "truncate",
            !slot && "text-muted-foreground italic",
            isWinner && "font-bold text-green-500",
          )}
        >
          {slot ? slot.team_name : t("tbd")}
        </span>
        <span className={cn("tabular-nums", isWinner ? "font-bold text-green-500" : "text-muted-foreground")}>
          {showScores && score !== null ? score : "-"}
        </span>
      </div>
    );
  };

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={clickable ? t("enterResult") : undefined}
      onClick={clickable ? () => onReport(match) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter") onReport(match); } : undefined}
      className={cn(
        "bg-card w-48 rounded-md border text-xs shadow-sm",
        clickable && "hover:border-primary/60 cursor-pointer transition-colors",
      )}
    >
      {/* tiny header: match number, bye badge, status dot */}
      <div className="border-b px-2 py-1 flex items-center justify-between">
        <span className="text-muted-foreground text-[10px]">{t("matchN", { n: match.position })}</span>
        <div className="flex items-center gap-1.5">
          {match.is_bye && (
            <Badge variant="outline" className="border-blue-500 px-1.5 py-0 text-[10px] text-blue-500">
              {t("bye")}
            </Badge>
          )}
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[match.status])} />
        </div>
      </div>
      {teamLine(match.team_a, match.score_a)}
      <div className="border-t" />
      {teamLine(match.team_b, match.score_b)}
    </div>
  );
}

// ── BracketTree: horizontal columns of MatchBoxes for one bracket side ────────
// justify-around staggers later (smaller) rounds vertically so the columns
// read as a tree without needing SVG connector lines.
function BracketTree({
  rounds,
  labelFor,
  isManager,
  onReport,
}: {
  rounds: H2HRound[];
  labelFor: (index: number, total: number) => string;
  isManager: boolean;
  onReport: (m: H2HMatch) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-6">
        {rounds.map((round, i) => (
          <div key={round.round} className="flex flex-col">
            <div className="text-foreground mb-2 text-xs font-semibold">
              {labelFor(i, rounds.length)}
            </div>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {round.matches.map((m) => (
                <MatchBox key={m.h2h_match_id} match={m} isManager={isManager} onReport={onReport} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LeagueRounds: "Matchday N" groups with one row per match ──────────────────
function LeagueRounds({
  rounds,
  isManager,
  onReport,
}: {
  rounds: H2HRound[];
  isManager: boolean;
  onReport: (m: H2HMatch) => void;
}) {
  const t = useTranslations("bracket");
  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <div key={round.round}>
          <div className="text-foreground mb-2 text-xs font-semibold">{t("matchday", { n: round.round })}</div>
          <div className="space-y-1.5">
            {round.matches.map((m) => {
              const clickable = isManager && !m.is_bye && !!m.team_a && !!m.team_b;
              const done = m.status === "completed";
              const aWins = done && !!m.team_a && m.winner_id === m.team_a.tournament_team_id;
              const bWins = done && !!m.team_b && m.winner_id === m.team_b.tournament_team_id;
              return (
                <div
                  key={m.h2h_match_id}
                  role={clickable ? "button" : undefined}
                  title={clickable ? t("enterResult") : undefined}
                  onClick={clickable ? () => onReport(m) : undefined}
                  className={cn(
                    "bg-card flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    clickable && "hover:border-primary/60 cursor-pointer transition-colors",
                  )}
                >
                  {/* team A (right aligned into the center scoreline) */}
                  <span className={cn("flex-1 truncate text-right", aWins && "font-bold text-green-500", !m.team_a && "text-muted-foreground italic")}>
                    {m.team_a?.team_name ?? t("tbd")}
                  </span>
                  {/* center scoreline (a tie stays unbolded; ties are legal in league) */}
                  <span className="text-muted-foreground w-14 shrink-0 text-center tabular-nums">
                    {done ? `${m.score_a ?? 0} : ${m.score_b ?? 0}` : t("vs")}
                  </span>
                  {/* team B */}
                  <span className={cn("flex-1 truncate", bWins && "font-bold text-green-500", !m.team_b && "text-muted-foreground italic")}>
                    {m.team_b?.team_name ?? t("tbd")}
                  </span>
                  <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[m.status])} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── the card ──────────────────────────────────────────────────────────────────

export function H2HBracketCard({
  stageId,
  stageName,
  stageFormat,
  isManager,
  canEdit,
  canUpload,
  registeredTeams,
}: {
  stageId: number;
  stageName: string;
  stageFormat: string;
  // True for admins/organizers: unlocks Generate/Regenerate + result entry. Kept as the simple
  // "full manager" switch (admin passes this). For organizers with only ONE of the two event
  // permissions, pass canEdit / canUpload instead so they only see the controls they can actually
  // use (P2, owner 2026-07-13: an organizer with only can_upload used to see a Generate button that
  // 403s, and vice-versa). When the granular props are omitted they fall back to isManager.
  isManager: boolean;
  // can_edit_events -> Generate / Regenerate the bracket. Defaults to isManager.
  canEdit?: boolean;
  // can_upload_results -> enter a match result. Defaults to isManager.
  canUpload?: boolean;
  // The event's registered teams (from the page's already-loaded event details)
  // for the seed picker. We never refetch event details here.
  registeredTeams: Array<{ tournament_team_id: number; team_name: string }>;
}) {
  const t = useTranslations("bracket");
  // Resolve the two capabilities: explicit granular prop wins, else fall back to isManager.
  const mayEdit = canEdit ?? isManager;
  const mayUpload = canUpload ?? isManager;
  const [bracket, setBracket] = useState<H2HBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Generate dialog state: the seed-ordered team list + the chosen format.
  const [genOpen, setGenOpen] = useState(false);
  const [seeds, setSeeds] = useState<SeedRow[]>([]);
  const [fmt, setFmt] = useState<BracketFormat>(defaultFmtForStageFormat(stageFormat));

  // Result dialog state: which match is being scored + the two inputs.
  const [reportFor, setReportFor] = useState<H2HMatch | null>(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");

  // ── load / reload the bracket (GET stages/<id>/bracket/, public) ──
  const refresh = useCallback(async () => {
    try {
      const res = await headToHeadApi.getBracket(stageId);
      setBracket(res);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [stageId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── generate dialog plumbing ──
  const openGenerate = () => {
    // Fresh seed list every open: all registered teams, registration order,
    // everything selected. Reorder with the arrows, untick to exclude.
    setSeeds(registeredTeams.map((t) => ({ ...t, included: true })));
    setFmt(defaultFmtForStageFormat(stageFormat));
    setGenOpen(true);
  };

  const moveSeed = (index: number, dir: -1 | 1) => {
    setSeeds((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleSeed = (index: number, included: boolean) => {
    setSeeds((prev) => prev.map((s, i) => (i === index ? { ...s, included } : s)));
  };

  const includedCount = useMemo(() => seeds.filter((s) => s.included).length, [seeds]);
  // Minimum teams for the chosen format (P2, owner 2026-07-13): double elimination needs at least 3
  // (2 teams can't fill a losers bracket - the backend 400s), every other format needs 2. Mirrors
  // the backend guard in head_to_head_views.generate_h2h_bracket so the button disables instead of
  // firing a request that fails.
  const minTeams = fmt === "double_elim" ? 3 : 2;

  const handleGenerate = async () => {
    // Seed order = list order, excluded teams skipped. Backend pairs 1v(n),
    // 2v(n-1)... and auto-completes byes.
    const teamIds = seeds.filter((s) => s.included).map((s) => s.tournament_team_id);
    if (teamIds.length < minTeams) return;
    setBusy(true);
    try {
      const res = await headToHeadApi.generateBracket(stageId, teamIds, fmt);
      toast.success(res.message || t("toastGenerated"));
      setGenOpen(false);
      refresh();
    } catch (err: any) {
      // Regeneration after a completed match (etc.) 400s; show it verbatim.
      toast.error(err?.response?.data?.message || t("toastGenerateFailed"));
    } finally {
      setBusy(false);
    }
  };

  // ── result dialog plumbing ──
  const openReport = (m: H2HMatch) => {
    setReportFor(m);
    // Prefill existing scores when correcting a completed match.
    setScoreA(m.score_a !== null && m.status === "completed" ? String(m.score_a) : "");
    setScoreB(m.score_b !== null && m.status === "completed" ? String(m.score_b) : "");
  };

  const handleSaveResult = async () => {
    if (!reportFor) return;
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      toast.error(t("toastEnterScores"));
      return;
    }
    setBusy(true);
    try {
      const res = await headToHeadApi.reportResult(reportFor.h2h_match_id, a, b);
      toast.success(res.message || t("toastResultSaved"));
      // The final match finishing writes placements to the stage leaderboard.
      if (res.bracket_complete) {
        toast.success(t("toastComplete"));
      }
      setReportFor(null);
      refresh();
    } catch (err: any) {
      // Ties in elimination, locked downstream, etc: backend message verbatim.
      toast.error(err?.response?.data?.message || t("toastSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const generated = !!bracket?.generated;
  const league = bracket ? isLeagueFmt(bracket.fmt) : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconTrophy className="text-primary size-4" />
              {t("title")}
              {generated && bracket && (
                <Badge variant="outline" className="border-primary text-primary">
                  {fmtLabel(bracket.fmt, t)}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {stageName} ({stageFormat})
            </CardDescription>
          </div>
          {/* Regenerate reuses the same seed dialog; the backend refuses once a
              real (non-bye) match has completed and we surface that message.
              Gated on mayEdit (can_edit_events), not upload. */}
          {mayEdit && generated && (
            <Button variant="outline" size="sm" onClick={openGenerate} disabled={busy}>
              <IconRefresh className="size-4" /> {t("regenerate")}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── loading / failed / empty states ── */}
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <IconLoader2 className="size-4 animate-spin" /> {t("loading")}
          </div>
        ) : loadFailed ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground text-sm">{t("loadFailed")}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); refresh(); }}>
              {t("retry")}
            </Button>
          </div>
        ) : !generated ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground text-sm">{t("noneYet")}</p>
            {mayEdit && (
              <Button size="sm" onClick={openGenerate}>
                <IconPlus className="size-4" /> {t("generateBracket")}
              </Button>
            )}
          </div>
        ) : bracket ? (
          <>
            {/* ── the bracket itself ── */}
            {/* Result-entry clickability is gated on mayUpload (can_upload_results), NOT edit. */}
            {league ? (
              <LeagueRounds rounds={bracket.rounds.league} isManager={mayUpload} onReport={openReport} />
            ) : (
              <>
                <BracketTree
                  rounds={bracket.rounds.winners}
                  labelFor={(i, total) => winnersRoundLabel(i, total, bracket.fmt, t)}
                  isManager={mayUpload}
                  onReport={openReport}
                />
                {/* losers bracket: double elim only, its own heading below */}
                {bracket.fmt === "double_elim" && bracket.rounds.losers.length > 0 && (
                  <div>
                    <div className="text-primary mb-2 text-sm font-semibold">{t("losersBracket")}</div>
                    <BracketTree
                      rounds={bracket.rounds.losers}
                      labelFor={(i, total) => losersRoundLabel(i, total, t)}
                      isManager={mayUpload}
                      onReport={openReport}
                    />
                  </div>
                )}
              </>
            )}

            {/* ── standings: placement once final, W-L, rounds won/lost ── */}
            <div>
              <div className="text-primary mb-2 text-sm font-semibold">{t("standings")}</div>
              {/* overflow-x-auto (P2): on a narrow phone the W-L / rounds columns must scroll inside
                  the card, not clip or push the page wide (overflow-hidden truncated them). */}
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground h-10 w-12 p-2 text-xs">{t("colRank")}</TableHead>
                      <TableHead className="text-foreground h-10 p-2 text-xs">{t("colTeam")}</TableHead>
                      <TableHead className="text-foreground h-10 p-2 text-center text-xs">{t("colWL")}</TableHead>
                      <TableHead className="text-foreground h-10 p-2 text-center text-xs">{t("colRounds")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bracket.standings.map((row) => {
                      const diff = row.rounds_won - row.rounds_lost;
                      return (
                        <TableRow key={row.tournament_team_id}>
                          <TableCell className="p-2 text-xs">
                            {row.placement !== null ? `#${row.placement}` : "-"}
                          </TableCell>
                          <TableCell className="p-2 text-xs font-medium">{row.team_name}</TableCell>
                          <TableCell className="p-2 text-center text-xs tabular-nums">
                            {row.wins}-{row.losses}
                          </TableCell>
                          <TableCell className="p-2 text-center text-xs tabular-nums">
                            {row.rounds_won}-{row.rounds_lost} ({diff > 0 ? `+${diff}` : diff})
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {bracket.standings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground p-2 text-center text-xs">
                          {t("noStandings")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>

      {/* ── Generate / Regenerate dialog: seed order + format ── */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{generated ? t("regenerateBracket") : t("generateBracket")}</DialogTitle>
            <DialogDescription>
              {t("generateDesc")}
              {generated && ` ${t("regenerateWarn")}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* format select (default mirrors the stage format) */}
            <div className="space-y-1.5">
              <Label>{t("format")}</Label>
              <Select value={fmt} onValueChange={(v) => setFmt(v as BracketFormat)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FMT_ORDER.map((value) => (
                    <SelectItem key={value} value={value}>
                      {fmtLabel(value, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* seed-ordered team list */}
            <div className="space-y-1.5">
              <Label>{t("seedsSelected", { n: includedCount })}</Label>
              {seeds.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("noTeamsYet")}</p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1.5">
                  {seeds.map((s, i) => {
                    // Seed number = position among the INCLUDED teams only.
                    const seedNo = s.included
                      ? seeds.slice(0, i).filter((x) => x.included).length + 1
                      : null;
                    return (
                      <div
                        key={s.tournament_team_id}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-1.5 py-1 text-xs",
                          !s.included && "opacity-50",
                        )}
                      >
                        <Checkbox
                          checked={s.included}
                          onCheckedChange={(v) => toggleSeed(i, v === true)}
                        />
                        <span className="text-muted-foreground w-8 shrink-0 tabular-nums">
                          {seedNo !== null ? `#${seedNo}` : "-"}
                        </span>
                        <span className="flex-1 truncate font-medium">{s.team_name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={i === 0}
                          onClick={() => moveSeed(i, -1)}
                          aria-label={t("moveUp", { name: s.team_name })}
                        >
                          <IconArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={i === seeds.length - 1}
                          onClick={() => moveSeed(i, 1)}
                          aria-label={t("moveDown", { name: s.team_name })}
                        >
                          <IconArrowDown className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Requirement hint (P2): double elimination needs 3+ teams. Shown when short. */}
          {includedCount < minTeams && (
            <p className="text-xs text-destructive">
              {fmt === "double_elim" ? t("needThree") : t("needTwo")}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={handleGenerate} disabled={busy || includedCount < minTeams}>
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              {generated ? t("regenerate") : t("generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── result entry dialog: two scores, backend validates ── */}
      <Dialog open={!!reportFor} onOpenChange={(open) => { if (!open) setReportFor(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("enterResult")}</DialogTitle>
            <DialogDescription>
              {t("vsPair", {
                a: reportFor?.team_a?.team_name ?? t("tbd"),
                b: reportFor?.team_b?.team_name ?? t("tbd"),
              })}{" "}
              {bracket && !isLeagueFmt(bracket.fmt)
                ? t("tiesNotAllowed")
                : t("tiesAllowed")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="truncate">{reportFor?.team_a?.team_name ?? t("teamA")}</Label>
              <Input
                type="number"
                min={0}
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="truncate">{reportFor?.team_b?.team_name ?? t("teamB")}</Label>
              <Input
                type="number"
                min={0}
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportFor(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveResult} disabled={busy || scoreA === "" || scoreB === ""}>
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              {t("saveResult")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
