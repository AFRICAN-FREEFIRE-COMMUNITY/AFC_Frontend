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

// Human labels for the format select + the header badge.
const FMT_LABELS: Record<BracketFormat, string> = {
  single_elim: "Single elimination",
  double_elim: "Double elimination",
  league: "League",
  round_robin_h2h: "Round robin",
};

const FMT_OPTIONS = Object.entries(FMT_LABELS) as Array<[BracketFormat, string]>;

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
function winnersRoundLabel(index: number, total: number, fmt: BracketFormat): string {
  if (index === total - 1) return fmt === "double_elim" ? "Grand Final" : "Final";
  if (fmt === "double_elim" && index === total - 2) return "Winners Final";
  return `Round ${index + 1}`;
}

function losersRoundLabel(index: number, total: number): string {
  return index === total - 1 ? "Losers Final" : `Losers Round ${index + 1}`;
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
          {slot ? slot.team_name : "TBD"}
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
      title={clickable ? "Enter result" : undefined}
      onClick={clickable ? () => onReport(match) : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter") onReport(match); } : undefined}
      className={cn(
        "bg-card w-48 rounded-md border text-xs shadow-sm",
        clickable && "hover:border-primary/60 cursor-pointer transition-colors",
      )}
    >
      {/* tiny header: match number, bye badge, status dot */}
      <div className="border-b px-2 py-1 flex items-center justify-between">
        <span className="text-muted-foreground text-[10px]">Match {match.position}</span>
        <div className="flex items-center gap-1.5">
          {match.is_bye && (
            <Badge variant="outline" className="border-blue-500 px-1.5 py-0 text-[10px] text-blue-500">
              Bye
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
  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <div key={round.round}>
          <div className="text-foreground mb-2 text-xs font-semibold">Matchday {round.round}</div>
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
                  title={clickable ? "Enter result" : undefined}
                  onClick={clickable ? () => onReport(m) : undefined}
                  className={cn(
                    "bg-card flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    clickable && "hover:border-primary/60 cursor-pointer transition-colors",
                  )}
                >
                  {/* team A (right aligned into the center scoreline) */}
                  <span className={cn("flex-1 truncate text-right", aWins && "font-bold text-green-500", !m.team_a && "text-muted-foreground italic")}>
                    {m.team_a?.team_name ?? "TBD"}
                  </span>
                  {/* center scoreline (a tie stays unbolded; ties are legal in league) */}
                  <span className="text-muted-foreground w-14 shrink-0 text-center tabular-nums">
                    {done ? `${m.score_a ?? 0} : ${m.score_b ?? 0}` : "vs"}
                  </span>
                  {/* team B */}
                  <span className={cn("flex-1 truncate", bWins && "font-bold text-green-500", !m.team_b && "text-muted-foreground italic")}>
                    {m.team_b?.team_name ?? "TBD"}
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
  registeredTeams,
}: {
  stageId: number;
  stageName: string;
  stageFormat: string;
  // True for admins/organizers: unlocks Generate/Regenerate + result entry.
  isManager: boolean;
  // The event's registered teams (from the page's already-loaded event details)
  // for the seed picker. We never refetch event details here.
  registeredTeams: Array<{ tournament_team_id: number; team_name: string }>;
}) {
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

  const handleGenerate = async () => {
    // Seed order = list order, excluded teams skipped. Backend pairs 1v(n),
    // 2v(n-1)... and auto-completes byes.
    const teamIds = seeds.filter((s) => s.included).map((s) => s.tournament_team_id);
    if (teamIds.length < 2) return;
    setBusy(true);
    try {
      const res = await headToHeadApi.generateBracket(stageId, teamIds, fmt);
      toast.success(res.message || "Bracket generated.");
      setGenOpen(false);
      refresh();
    } catch (err: any) {
      // Regeneration after a completed match (etc.) 400s; show it verbatim.
      toast.error(err?.response?.data?.message || "Failed to generate the bracket.");
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
      toast.error("Enter both scores (0 or more).");
      return;
    }
    setBusy(true);
    try {
      const res = await headToHeadApi.reportResult(reportFor.h2h_match_id, a, b);
      toast.success(res.message || "Result saved.");
      // The final match finishing writes placements to the stage leaderboard.
      if (res.bracket_complete) {
        toast.success("Bracket complete. Placements written to the leaderboard.");
      }
      setReportFor(null);
      refresh();
    } catch (err: any) {
      // Ties in elimination, locked downstream, etc: backend message verbatim.
      toast.error(err?.response?.data?.message || "Failed to save the result.");
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
              Bracket
              {generated && bracket && (
                <Badge variant="outline" className="border-primary text-primary">
                  {FMT_LABELS[bracket.fmt]}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {stageName} ({stageFormat})
            </CardDescription>
          </div>
          {/* Regenerate reuses the same seed dialog; the backend refuses once a
              real (non-bye) match has completed and we surface that message. */}
          {isManager && generated && (
            <Button variant="outline" size="sm" onClick={openGenerate} disabled={busy}>
              <IconRefresh className="size-4" /> Regenerate
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── loading / failed / empty states ── */}
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <IconLoader2 className="size-4 animate-spin" /> Loading bracket...
          </div>
        ) : loadFailed ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground text-sm">Could not load the bracket.</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); refresh(); }}>
              Retry
            </Button>
          </div>
        ) : !generated ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground text-sm">No bracket has been generated for this stage yet.</p>
            {isManager && (
              <Button size="sm" onClick={openGenerate}>
                <IconPlus className="size-4" /> Generate bracket
              </Button>
            )}
          </div>
        ) : bracket ? (
          <>
            {/* ── the bracket itself ── */}
            {league ? (
              <LeagueRounds rounds={bracket.rounds.league} isManager={isManager} onReport={openReport} />
            ) : (
              <>
                <BracketTree
                  rounds={bracket.rounds.winners}
                  labelFor={(i, total) => winnersRoundLabel(i, total, bracket.fmt)}
                  isManager={isManager}
                  onReport={openReport}
                />
                {/* losers bracket: double elim only, its own heading below */}
                {bracket.fmt === "double_elim" && bracket.rounds.losers.length > 0 && (
                  <div>
                    <div className="text-primary mb-2 text-sm font-semibold">Losers Bracket</div>
                    <BracketTree
                      rounds={bracket.rounds.losers}
                      labelFor={losersRoundLabel}
                      isManager={isManager}
                      onReport={openReport}
                    />
                  </div>
                )}
              </>
            )}

            {/* ── standings: placement once final, W-L, rounds won/lost ── */}
            <div>
              <div className="text-primary mb-2 text-sm font-semibold">Standings</div>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground h-10 w-12 p-2 text-xs">#</TableHead>
                      <TableHead className="text-foreground h-10 p-2 text-xs">Team</TableHead>
                      <TableHead className="text-foreground h-10 p-2 text-center text-xs">W-L</TableHead>
                      <TableHead className="text-foreground h-10 p-2 text-center text-xs">Rounds +/-</TableHead>
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
                          No standings yet.
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
            <DialogTitle>{generated ? "Regenerate bracket" : "Generate bracket"}</DialogTitle>
            <DialogDescription>
              Order teams by seed (top = seed 1). Untick a team to leave it out.
              {generated && " Regenerating wipes the current bracket; it is only allowed while no real match has been completed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* format select (default mirrors the stage format) */}
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={fmt} onValueChange={(v) => setFmt(v as BracketFormat)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FMT_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* seed-ordered team list */}
            <div className="space-y-1.5">
              <Label>Seeds ({includedCount} selected)</Label>
              {seeds.length === 0 ? (
                <p className="text-muted-foreground text-xs">No registered teams yet.</p>
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
                          className="size-6"
                          disabled={i === 0}
                          onClick={() => moveSeed(i, -1)}
                          aria-label={`Move ${s.team_name} up`}
                        >
                          <IconArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={i === seeds.length - 1}
                          onClick={() => moveSeed(i, 1)}
                          aria-label={`Move ${s.team_name} down`}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={busy || includedCount < 2}>
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              {generated ? "Regenerate" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── result entry dialog: two scores, backend validates ── */}
      <Dialog open={!!reportFor} onOpenChange={(open) => { if (!open) setReportFor(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter result</DialogTitle>
            <DialogDescription>
              {reportFor?.team_a?.team_name ?? "TBD"} vs {reportFor?.team_b?.team_name ?? "TBD"}.
              {bracket && !isLeagueFmt(bracket.fmt)
                ? " Ties are not allowed in elimination brackets."
                : " Ties are allowed in league play."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="truncate">{reportFor?.team_a?.team_name ?? "Team A"}</Label>
              <Input
                type="number"
                min={0}
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="truncate">{reportFor?.team_b?.team_name ?? "Team B"}</Label>
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
              Cancel
            </Button>
            <Button onClick={handleSaveResult} disabled={busy || scoreA === "" || scoreB === ""}>
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              Save result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
