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
import { Textarea } from "@/components/ui/textarea";
import {
  IconArrowDown, IconArrowUp, IconClock, IconLoader2, IconPlus, IconRefresh, IconSettings,
  IconTrophy,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  h2hSubmissionApi, headToHeadApi, type BracketFormat, type H2HAgreement, type H2HBracket,
  type H2HMatch, type H2HResultType, type H2HRound, type H2HRosterTeam, type H2HSubmission,
  type H2HTeamRef,
} from "@/lib/headToHead";
// Clash Squad ROOM SETTINGS (owner 2026-08-12): the editor an organizer opens from this card
// (stage-wide, or as a per-match override) and the read-only card players read.
import { CSRoomCard, CSRoomSettingsDialog } from "@/components/cs-room-settings";

// A dynamic translation key, guarded. next-intl THROWS when a key is missing, and every key below
// is built from an API value (result_type, agreement, submission status), so a value this build has
// no string for would take the whole bracket card down. Falls back to the raw value, which is at
// least readable. House rule: t.has() on every dynamic key (owner 2026-07-13).
function dyn(
  t: ReturnType<typeof useTranslations>,
  prefix: string,
  value: string | null | undefined,
): string {
  const key = `${prefix}${value ?? ""}`;
  return value && t.has(key) ? t(key) : String(value ?? "");
}

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
  // Name the last two rounds before the final the way everyone actually refers to them, instead of
  // "Round 3" / "Round 4" (owner 2026-08-12). Only for single elimination: in double elimination
  // the winners bracket's late rounds are already labelled Winners Final / Grand Final above, and
  // calling an upper-bracket round "semi-final" there would be wrong, since losing it is not out.
  if (fmt !== "double_elim") {
    if (index === total - 2) return t("semiFinal");
    if (index === total - 3) return t("quarterFinal");
  }
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

// ── per-player stat draft (result dialog) ─────────────────────────────────────
// What the organizer is typing for one player in the open set. Strings, not numbers, so a blank
// box reads as "nothing entered" rather than a 0 they never typed; blanks are sent as 0.
interface PlayerLineDraft {
  tournament_team_id: number;
  kills: string;
  damage: string;
  assists: string;
}

// ── MatchBox: one compact match in the elimination tree ───────────────────────
// Clickable for managers when both slots are filled and it is not a bye;
// corrections on completed matches are allowed here and policed by the backend.
function MatchBox({
  match,
  isManager,
  onReport,
  onManage,
  onOpenDetails,
}: {
  match: H2HMatch;
  isManager: boolean;
  onReport: (m: H2HMatch) => void;
  /** Managers only: the gear opens schedule / room override / walkover for this one match. */
  onManage?: (m: H2HMatch) => void;
  /** Everyone else: the box opens a read-only detail sheet (room, time, submit our result). */
  onOpenDetails?: (m: H2HMatch) => void;
}) {
  const t = useTranslations("bracket");
  const clickable = isManager && !match.is_bye && !!match.team_a && !!match.team_b;
  // A non-manager still gets something useful from clicking: the room, the time, and - if they
  // play in it - the "submit our result" form.
  const viewable = !clickable && !match.is_bye && !!onOpenDetails && (!!match.team_a || !!match.team_b);
  const showScores = match.status === "completed" && !match.is_bye;
  // Awarded rather than played: worth a badge, because a 7-0 that nobody turned up for reads very
  // differently from a 7-0 thrashing (owner 2026-08-12).
  const awarded = !!match.result_type && match.result_type !== "normal";

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

  const openMain = clickable
    ? () => onReport(match)
    : viewable
      ? () => onOpenDetails!(match)
      : undefined;

  return (
    <div
      role={openMain ? "button" : undefined}
      tabIndex={openMain ? 0 : undefined}
      title={clickable ? t("enterResult") : viewable ? t("matchDetails") : undefined}
      onClick={openMain}
      onKeyDown={openMain ? (e) => { if (e.key === "Enter") openMain(); } : undefined}
      className={cn(
        "bg-card w-48 rounded-md border text-xs shadow-sm",
        openMain && "hover:border-primary/60 cursor-pointer transition-colors",
      )}
    >
      {/* tiny header: match number, bye badge, status dot, and the manager's gear */}
      <div className="border-b px-2 py-1 flex items-center justify-between">
        {/* position is 0-based in the database (it drives the pairing maths). Humans count from 1,
            and four boxes all reading "Match 0" on one screen was the most confusing thing on the
            bracket (owner 2026-08-12). */}
        <span className="text-muted-foreground text-[10px]">
          {t("matchN", { n: match.position + 1 })}
        </span>
        <div className="flex items-center gap-1.5">
          {match.is_bye && (
            <Badge variant="outline" className="border-blue-500 px-1.5 py-0 text-[10px] text-blue-500">
              {t("bye")}
            </Badge>
          )}
          {awarded && (
            <Badge
              variant="outline"
              className="border-orange-500 px-1.5 py-0 text-[10px] text-orange-500"
              title={match.result_note || undefined}
            >
              {dyn(t, "resultType_", match.result_type)}
            </Badge>
          )}
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[match.status])} />
          {isManager && onManage && !match.is_bye && (
            <button
              type="button"
              aria-label={t("manageMatch")}
              title={t("manageMatch")}
              // stopPropagation: the box itself opens the result dialog, the gear opens the
              // schedule / room / walkover one. Two jobs, one small card.
              onClick={(e) => { e.stopPropagation(); onManage(match); }}
              className="text-muted-foreground hover:text-foreground -mr-1 p-0.5"
            >
              <IconSettings className="size-3" />
            </button>
          )}
        </div>
      </div>
      {teamLine(match.team_a, match.score_a)}
      <div className="border-t" />
      {teamLine(match.team_b, match.score_b)}
      {/* Kick-off time, once an organizer sets one. Rendered as stored (the event's own clock);
          a full timezone-aware render lives on the match detail dialog. */}
      {(match.scheduled_date || match.status === "live") && (
        <div className="text-muted-foreground flex items-center gap-1 border-t px-2 py-1 text-[10px]">
          {match.status === "live" ? (
            <span className="font-medium text-orange-500">{t("liveNow")}</span>
          ) : (
            <>
              <IconClock className="size-3" />
              <span>
                {match.scheduled_date}
                {match.scheduled_time ? ` ${match.scheduled_time.slice(0, 5)}` : ""}
              </span>
            </>
          )}
        </div>
      )}
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
  onManage,
  onOpenDetails,
}: {
  rounds: H2HRound[];
  labelFor: (index: number, total: number) => string;
  isManager: boolean;
  onReport: (m: H2HMatch) => void;
  onManage?: (m: H2HMatch) => void;
  onOpenDetails?: (m: H2HMatch) => void;
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
                <MatchBox
                  key={m.h2h_match_id}
                  match={m}
                  isManager={isManager}
                  onReport={onReport}
                  onManage={onManage}
                  onOpenDetails={onOpenDetails}
                />
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
  onManage,
  onOpenDetails,
  sitOuts,
}: {
  rounds: H2HRound[];
  isManager: boolean;
  onReport: (m: H2HMatch) => void;
  onManage?: (m: H2HMatch) => void;
  onOpenDetails?: (m: H2HMatch) => void;
  /** {round: the team resting} - only present for an odd-sized round robin. */
  sitOuts?: Record<string, H2HTeamRef>;
}) {
  const t = useTranslations("bracket");
  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <div key={round.round}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-foreground text-xs font-semibold">
              {t("matchday", { n: round.round })}
            </span>
            {/* Name the team that is resting. With an odd number of teams exactly one sits out per
                matchday, and the bracket never said who - a team with no row could not tell whether
                it was resting or whether a fixture had been forgotten (owner 2026-08-12). */}
            {sitOuts?.[String(round.round)] && (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                {t("sitsOut", { name: sitOuts[String(round.round)].team_name })}
              </Badge>
            )}
          </div>
          <div className="space-y-1.5">
            {round.matches.map((m) => {
              const clickable = isManager && !m.is_bye && !!m.team_a && !!m.team_b;
              const done = m.status === "completed";
              const aWins = done && !!m.team_a && m.winner_id === m.team_a.tournament_team_id;
              const bWins = done && !!m.team_b && m.winner_id === m.team_b.tournament_team_id;
              // A drawn set has no winner but IS finished; without a marker it read as an
              // unremarkable scoreline nobody could tell apart from a pending one at a glance.
              const drawn = done && !m.is_bye && !m.winner_id;
              const openRow = clickable
                ? () => onReport(m)
                : onOpenDetails && !m.is_bye
                  ? () => onOpenDetails(m)
                  : undefined;
              return (
                <div
                  key={m.h2h_match_id}
                  role={openRow ? "button" : undefined}
                  title={clickable ? t("enterResult") : openRow ? t("matchDetails") : undefined}
                  onClick={openRow}
                  className={cn(
                    "bg-card flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    openRow && "hover:border-primary/60 cursor-pointer transition-colors",
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
                  {drawn && (
                    <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px]">
                      {t("draw")}
                    </Badge>
                  )}
                  {/* Awarded rather than played - the same marker the bracket-tree card shows,
                      because a league row is just as capable of being a walkover. */}
                  {m.result_type && m.result_type !== "normal" && (
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full border-orange-500 px-1.5 py-0 text-[10px] text-orange-500"
                      title={m.result_note || undefined}
                    >
                      {dyn(t, "resultType_", m.result_type)}
                    </Badge>
                  )}
                  <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[m.status])} />
                  {isManager && onManage && !m.is_bye && (
                    <button
                      type="button"
                      aria-label={t("manageMatch")}
                      title={t("manageMatch")}
                      onClick={(e) => { e.stopPropagation(); onManage(m); }}
                      className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                    >
                      <IconSettings className="size-3" />
                    </button>
                  )}
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
  groupId,
  groupName,
  isManager,
  canEdit,
  canUpload,
  registeredTeams,
}: {
  stageId: number;
  stageName: string;
  stageFormat: string;
  /** Which bracket this card shows, when the stage was split into groups (owner item 21,
   *  2026-08-13). Omitted for the ordinary one-bracket stage, where the backend resolves it. */
  groupId?: number | null;
  groupName?: string | null;
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
  // Per-player stat entry for the open set (owner 2026-08-12). rosters holds both sides as the
  // backend returned them; playerLines is the draft the organizer is typing, keyed by player id
  // and held as STRINGS so an empty box stays empty instead of showing a 0 nobody typed.
  const [rosters, setRosters] = useState<H2HRosterTeam[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [playerLines, setPlayerLines] = useState<Record<number, PlayerLineDraft>>({});
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  // A set that nobody played. "normal" means an ordinary scoreline; anything else records WHO
  // advances and WHY, and the score boxes are replaced by a winner picker (owner 2026-08-12).
  const [outcome, setOutcome] = useState<H2HResultType>("normal");
  const [outcomeWinner, setOutcomeWinner] = useState<string>("");
  const [outcomeNote, setOutcomeNote] = useState("");

  // ── room settings ──
  // Which scope the room-settings editor is open on: the whole stage (from the card header) or one
  // match (from that match's gear). Null = closed.
  const [roomEditor, setRoomEditor] = useState<
    { scope: "stage" | "group" | "match"; objectId: number; label: string } | null
  >(null);

  // ── manage-match dialog (schedule + live + room override + walkover) ──
  const [manageFor, setManageFor] = useState<H2HMatch | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");

  // ── match detail sheet (non-managers: room, time, and "submit our result") ──
  const [detailsFor, setDetailsFor] = useState<H2HMatch | null>(null);

  // ── submissions (players propose, organizers approve) ──
  const [submissions, setSubmissions] = useState<H2HSubmission[]>([]);
  const [agreement, setAgreement] = useState<H2HAgreement>("none");
  // Whether the CURRENT viewer may act on this match's submissions. The backend answers both
  // questions in one call: can_review says organizer, and a 403 says "not involved at all".
  const [canReview, setCanReview] = useState(false);
  const [involved, setInvolved] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [mySubA, setMySubA] = useState("");
  const [mySubB, setMySubB] = useState("");
  const [mySubNote, setMySubNote] = useState("");

  // ── load / reload the bracket (GET stages/<id>/bracket/, public) ──
  const refresh = useCallback(async () => {
    try {
      const res = await headToHeadApi.getBracket(stageId, groupId);
      setBracket(res);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [stageId, groupId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Which list the seed picker starts from (owner 2026-08-12). The dialog used to always offer
  // EVERY team registered to the event, which is only right for a one-stage event. Two existing
  // flows already record who belongs in THIS stage as StageCompetitor rows - "Add Teams to Stage",
  // and advancing qualifiers out of a previous stage - and the backend now serves them as
  // bracket.stage_competitors, in the order they entered the stage (placement order, for an
  // advanced stage). So: use the stage's own pool when it has one, otherwise fall back to the
  // event's registrations exactly as before.
  // seedsFromStagePool drives the "where did this list come from" line in the dialog. It is set
  // when the dialog opens, from the FRESH payload fetched there (see openGenerate) rather than
  // from the card's loaded state: "Add Teams to Stage" lives on the page outside this card and
  // does not refresh it, so the card's copy of the pool can be one action out of date.
  const [seedsFromStagePool, setSeedsFromStagePool] = useState(false);
  // Play a bronze match between the two semifinal losers, so 3rd and 4th are decided instead of
  // shared (owner 2026-08-12). Single elimination only: double elimination already separates them,
  // and a league is ranked by its table. Reset on every open so it is never silently carried over.
  const [thirdPlace, setThirdPlace] = useState(false);

  // ── generate dialog plumbing ──
  const openGenerate = async () => {
    // Re-read the bracket first so the seed list reflects any team just added to the stage.
    let pool = bracket?.stage_competitors ?? [];
    try {
      const fresh = await headToHeadApi.getBracket(stageId, groupId);
      setBracket(fresh);
      pool = fresh.stage_competitors ?? [];
    } catch {
      // Offline or a failed read: fall back to whatever the card already has rather than
      // blocking the dialog. The backend re-validates every id on generate anyway.
    }
    // Prefer the stage's own competitor pool (teams added to this stage, or advanced into it from
    // a previous stage, in qualification order). Fall back to the event's registrations for a
    // one-stage event where nobody curated a pool. Everything starts selected; reorder with the
    // arrows, untick to exclude.
    const source = pool.length > 0 ? pool : registeredTeams;
    setSeedsFromStagePool(pool.length > 0);
    setSeeds(source.map((t) => ({ ...t, included: true })));
    // Default to the mode this bracket ACTUALLY runs. For a group that is its own
    // bracket_format, which the payload reports as `fmt` (owner item 21, 2026-08-13); the
    // stage_format fallback only applies to a legacy stage that still carries its mode.
    setFmt(bracket?.fmt ?? defaultFmtForStageFormat(stageFormat));
    setThirdPlace(false);
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
  // The bronze match only makes sense in single elimination, and only once there are semifinals
  // to lose - with fewer than 3 teams the bracket is a single final. The backend applies the same
  // rule and simply ignores the flag otherwise; this just keeps the option off screen when it
  // cannot apply.
  const canOfferThirdPlace = fmt === "single_elim" && includedCount >= 3;

  const handleGenerate = async () => {
    // Seed order = list order, excluded teams skipped. Backend pairs 1v(n),
    // 2v(n-1)... and auto-completes byes.
    const teamIds = seeds.filter((s) => s.included).map((s) => s.tournament_team_id);
    if (teamIds.length < minTeams) return;
    setBusy(true);
    try {
      const res = await headToHeadApi.generateBracket(
        stageId,
        teamIds,
        fmt,
        canOfferThirdPlace && thirdPlace,
        groupId,
      );
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
  const openReport = async (m: H2HMatch) => {
    setReportFor(m);
    // Prefill existing scores when correcting a completed match.
    setScoreA(m.score_a !== null && m.status === "completed" ? String(m.score_a) : "");
    setScoreB(m.score_b !== null && m.status === "completed" ? String(m.score_b) : "");
    // Every open starts on "played". A forfeit is a deliberate choice, never something carried
    // over from the last match somebody happened to award.
    setOutcome("normal");
    setOutcomeWinner("");
    setOutcomeNote("");
    // Load whatever the two teams sent in, so an organizer entering a result can see (and accept)
    // what the teams already claimed instead of retyping it.
    loadSubmissions(m);

    // Per-player lines (owner 2026-08-12). Load both rosters so the organizer can enter a line
    // per player the way Battle Royale entry does, and pre-fill from whatever was entered before
    // so a correction starts where they left off rather than blank. Roster loading is best
    // effort: if it fails, the dialog still records the set score on its own.
    setRosters([]);
    setPlayerLines({});
    setRosterLoading(true);
    try {
      const teams = await headToHeadApi.getMatchRosters(m.h2h_match_id);
      setRosters(teams);
      const existing = new Map((m.player_stats ?? []).map((p) => [p.player_id, p]));
      const seeded: Record<number, PlayerLineDraft> = {};
      teams.forEach((team) =>
        team.players.forEach((p) => {
          const prev = existing.get(p.player_id);
          seeded[p.player_id] = {
            tournament_team_id: team.tournament_team_id,
            kills: prev ? String(prev.kills) : "",
            damage: prev ? String(prev.damage) : "",
            assists: prev ? String(prev.assists) : "",
          };
        }),
      );
      setPlayerLines(seeded);
    } catch {
      setRosters([]);
    } finally {
      setRosterLoading(false);
    }
  };

  // ── submissions plumbing ──
  // One call answers three questions: what has been sent, whether the two sides agree, and what
  // this viewer may do about it. A 403 means "not involved", which is the normal case for a
  // spectator and is not an error worth toasting.
  const loadSubmissions = useCallback(async (m: H2HMatch) => {
    setSubLoading(true);
    setSubmissions([]);
    setAgreement("none");
    setCanReview(false);
    setInvolved(false);
    try {
      const res = await h2hSubmissionApi.list(m.h2h_match_id);
      setSubmissions(res.submissions);
      setAgreement(res.agreement);
      setCanReview(res.can_review);
      setInvolved(true);
    } catch {
      setInvolved(false);
    } finally {
      setSubLoading(false);
    }
  }, []);

  const openDetails = (m: H2HMatch) => {
    setDetailsFor(m);
    setMySubA("");
    setMySubB("");
    setMySubNote("");
    loadSubmissions(m);
  };

  const openManage = (m: H2HMatch) => {
    setManageFor(m);
    setSchedDate(m.scheduled_date ?? "");
    setSchedTime(m.scheduled_time ? m.scheduled_time.slice(0, 5) : "");
  };

  const handleSaveSchedule = async () => {
    if (!manageFor) return;
    setBusy(true);
    try {
      await headToHeadApi.updateMatch(manageFor.h2h_match_id, {
        scheduled_date: schedDate || null,
        scheduled_time: schedTime || null,
      });
      toast.success(t("toastScheduleSaved"));
      setManageFor(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toastSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleGoLive = async () => {
    if (!manageFor) return;
    setBusy(true);
    try {
      await headToHeadApi.updateMatch(manageFor.h2h_match_id, { status: "live" });
      toast.success(t("toastMarkedLive"));
      setManageFor(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toastSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitOwnResult = async () => {
    if (!detailsFor) return;
    const a = parseInt(mySubA, 10);
    const b = parseInt(mySubB, 10);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      toast.error(t("toastEnterScores"));
      return;
    }
    setBusy(true);
    try {
      const res = await h2hSubmissionApi.submit(detailsFor.h2h_match_id, a, b, [], mySubNote);
      toast.success(res.message || t("toastSubmitted"));
      loadSubmissions(detailsFor);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toastSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleApproveSubmission = async (sub: H2HSubmission) => {
    setBusy(true);
    try {
      const res = await h2hSubmissionApi.approve(sub.submission_id);
      toast.success(res.message || t("toastResultSaved"));
      if (res.bracket_complete) toast.success(t("toastComplete"));
      setReportFor(null);
      setDetailsFor(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toastSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRejectSubmission = async (sub: H2HSubmission) => {
    // A rejection needs a reason: without one the team just submits the same thing again. The
    // backend enforces it too, so an empty prompt is refused rather than silently sent.
    const reason = window.prompt(t("rejectReasonPrompt")) ?? "";
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await h2hSubmissionApi.reject(sub.submission_id, reason.trim());
      toast.success(t("toastRejected"));
      if (reportFor) loadSubmissions(reportFor);
      else if (detailsFor) loadSubmissions(detailsFor);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toastSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveResult = async () => {
    if (!reportFor) return;
    // A set nobody played: record the winner and HOW, not an invented scoreline.
    if (outcome !== "normal") {
      const winnerId = parseInt(outcomeWinner, 10);
      if (Number.isNaN(winnerId)) {
        toast.error(t("pickWinner"));
        return;
      }
      setBusy(true);
      try {
        const res = await headToHeadApi.awardOutcome(
          reportFor.h2h_match_id, outcome, winnerId, outcomeNote);
        toast.success(res.message || t("toastResultSaved"));
        if (res.bracket_complete) toast.success(t("toastComplete"));
        setReportFor(null);
        refresh();
      } catch (err: any) {
        toast.error(err?.response?.data?.message || t("toastSaveFailed"));
      } finally {
        setBusy(false);
      }
      return;
    }

    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      toast.error(t("toastEnterScores"));
      return;
    }
    // Build the per-player lines from the draft. Only sent when rosters actually loaded; a blank
    // box counts as 0, and every rostered player is included so the set records who played rather
    // than only who scored. Omitting the key entirely (rosters failed to load) leaves any
    // previously entered lines untouched on the backend.
    const playerStats = rosters.length
      ? rosters.flatMap((team) =>
          team.players.map((p) => {
            const draft = playerLines[p.player_id];
            const n = (v?: string) => {
              const parsed = parseInt(v ?? "", 10);
              return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
            };
            return {
              player_id: p.player_id,
              tournament_team_id: team.tournament_team_id,
              kills: n(draft?.kills),
              damage: n(draft?.damage),
              assists: n(draft?.assists),
              played: true,
            };
          }),
        )
      : undefined;

    setBusy(true);
    try {
      const res = await headToHeadApi.reportResult(reportFor.h2h_match_id, a, b, playerStats);
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
            {/* The stage's human format label, not the raw database string: the subtitle used to
                read "Stage 1 (cs - knockout)", which is a column value, not a sentence
                (owner 2026-08-12, finding #18). */}
            <CardDescription className="mt-1">
              {/* Name the GROUP when the stage was split, so stacked cards are tellable
                  apart at a glance (owner item 21). */}
              {groupName ? `${stageName} - ${groupName}` : stageName}
              {" ("}
              {bracket ? fmtLabel(bracket.fmt, t) : fmtLabel(defaultFmtForStageFormat(stageFormat), t)}
              {")"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Room settings for the WHOLE stage: what every match inherits unless it has its own
                override. Gated on mayEdit, the same permission as editing the event. */}
            {mayEdit && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  setRoomEditor(
                    groupId
                      ? { scope: "group", objectId: groupId, label: groupName || stageName }
                      : { scope: "stage", objectId: stageId, label: stageName },
                  )
                }
              >
                <IconSettings className="size-4" /> {t("roomSettings")}
              </Button>
            )}
            {/* Regenerate reuses the same seed dialog; the backend refuses once a
                real (non-bye) match has completed and we surface that message.
                Gated on mayEdit (can_edit_events), not upload. */}
            {mayEdit && generated && (
              <Button variant="outline" size="sm" onClick={openGenerate} disabled={busy}>
                <IconRefresh className="size-4" /> {t("regenerate")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── the room settings players need before they play ──────────────────────────────
            OUTSIDE the "has a bracket" branch on purpose: an organizer can configure the room
            while creating the event, long before any team has registered or any bracket exists,
            and that is exactly when players want to read it. Stage-level, resolved stage -> event
            by the backend; a match that overrides it shows its own copy in its detail dialog. */}
        {!loading && bracket?.room?.summary && (
          <CSRoomCard
            summary={bracket.room.summary}
            roomId={bracket.room.room_id}
            roomPassword={bracket.room.room_password}
            notes={bracket.room.notes}
            isPublished={bracket.room.is_published}
            sourceScope={bracket.room.source_scope}
            hasCredentials={bracket.room.has_room_credentials}
          />
        )}

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
              <LeagueRounds
                rounds={bracket.rounds.league}
                isManager={mayUpload}
                onReport={openReport}
                onManage={mayEdit ? openManage : undefined}
                onOpenDetails={openDetails}
                sitOuts={bracket.sit_outs}
              />
            ) : (
              <>
                <BracketTree
                  rounds={bracket.rounds.winners}
                  labelFor={(i, total) => winnersRoundLabel(i, total, bracket.fmt, t)}
                  isManager={mayUpload}
                  onReport={openReport}
                  onManage={mayEdit ? openManage : undefined}
                  onOpenDetails={openDetails}
                />
                {/* Third-place match (single elimination, opt-in at generation). Drawn as its own
                    small block under the tree rather than as another winners column: it is not a
                    round anyone advances out of, its two teams are the semifinal LOSERS, and its
                    winner takes 3rd while the loser takes 4th. */}
                {(bracket.rounds.third?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-primary mb-2 text-sm font-semibold">{t("thirdPlace")}</div>
                    <div className="flex flex-wrap gap-3">
                      {(bracket.rounds.third ?? []).flatMap((r) => r.matches).map((m) => (
                        <MatchBox
                          key={m.h2h_match_id}
                          match={m}
                          isManager={mayUpload}
                          onReport={openReport}
                          onManage={mayEdit ? openManage : undefined}
                          onOpenDetails={openDetails}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* losers bracket: double elim only, its own heading below */}
                {bracket.fmt === "double_elim" && bracket.rounds.losers.length > 0 && (
                  <div>
                    <div className="text-primary mb-2 text-sm font-semibold">{t("losersBracket")}</div>
                    <BracketTree
                      rounds={bracket.rounds.losers}
                      labelFor={(i, total) => losersRoundLabel(i, total, t)}
                      isManager={mayUpload}
                      onReport={openReport}
                      onManage={mayEdit ? openManage : undefined}
                      onOpenDetails={openDetails}
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
                      {/* Points + W-D-L are league-only: an elimination bracket cannot tie, so a
                          draw column there would be a permanent zero (owner 2026-08-12). */}
                      {league && (
                        <TableHead className="text-foreground h-10 p-2 text-center text-xs">
                          {t("colPoints")}
                        </TableHead>
                      )}
                      <TableHead className="text-foreground h-10 p-2 text-center text-xs">
                        {league ? t("colWDL") : t("colWL")}
                      </TableHead>
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
                          {league && (
                            <TableCell className="p-2 text-center text-xs font-semibold tabular-nums">
                              {row.points ?? 0}
                            </TableCell>
                          )}
                          <TableCell className="p-2 text-center text-xs tabular-nums">
                            {league
                              ? `${row.wins}-${row.draws ?? 0}-${row.losses}`
                              : `${row.wins}-${row.losses}`}
                          </TableCell>
                          <TableCell className="p-2 text-center text-xs tabular-nums">
                            {row.rounds_won}-{row.rounds_lost} ({diff > 0 ? `+${diff}` : diff})
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {bracket.standings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={league ? 5 : 4} className="text-muted-foreground p-2 text-center text-xs">
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

            {/* Bronze match opt-in. Single elimination only - see canOfferThirdPlace. */}
            {canOfferThirdPlace && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
                <Checkbox
                  checked={thirdPlace}
                  onCheckedChange={(v) => setThirdPlace(v === true)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block text-xs font-medium">{t("thirdPlaceOption")}</span>
                  <span className="text-muted-foreground block text-xs">
                    {t("thirdPlaceHint")}
                  </span>
                </span>
              </label>
            )}

            {/* seed-ordered team list */}
            <div className="space-y-1.5">
              <Label>{t("seedsSelected", { n: includedCount })}</Label>
              {/* Say WHERE this list came from, so an organizer knows whether they are looking at
                  the teams that qualified into this stage or at the whole event's registrations
                  (owner 2026-08-12). See seedSource above. */}
              <p className="text-muted-foreground text-xs">
                {seedsFromStagePool
                  ? groupId
                    ? t("seedsFromGroup")
                    : t("seedsFromStage")
                  : t("seedsFromRegistrations")}
              </p>
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

      {/* ── result entry dialog: the set score, then a line per player ── */}
      <Dialog open={!!reportFor} onOpenChange={(open) => { if (!open) setReportFor(null); }}>
        {/* Wider than the old score-only dialog and scrollable, because both rosters now sit
            under the two score boxes on a phone as well as a desktop. */}
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("enterResult")}</DialogTitle>
            <DialogDescription>
              {/* Team names are trimmed before they are interpolated: a stored name with a
                  trailing space rendered as "Elite gamers esport . Ties are allowed", which reads
                  as a typo in OUR copy rather than as dirty data (owner 2026-08-12, finding #19).
                  Every other place a team name lands in a sentence should do the same. */}
              {t("vsPair", {
                a: reportFor?.team_a?.team_name?.trim() || t("tbd"),
                b: reportFor?.team_b?.team_name?.trim() || t("tbd"),
              })}{" "}
              {bracket && !isLeagueFmt(bracket.fmt)
                ? t("tiesNotAllowed")
                : t("tiesAllowed")}
            </DialogDescription>
          </DialogHeader>

          {/* ── what happened: a played set, or one nobody played (owner 2026-08-12) ──
              Recording a walkover as an invented scoreline fed the round-difference tiebreak as
              if a real set had been played, and left no trace of why a team advanced. */}
          <div className="space-y-1.5">
            <Label>{t("outcome")}</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as H2HResultType)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["normal", "forfeit", "walkover", "dq"] as H2HResultType[]).map((value) => (
                  <SelectItem key={value} value={value}>{dyn(t, "resultType_", value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {outcome === "normal" ? (
            <>
              {/* The room's best-of, when one is configured: the backend refuses a score above it,
                  so saying it here saves a round trip and an unexplained error. */}
              {reportFor?.room?.summary && (
                <p className="text-muted-foreground text-xs">
                  {t("bestOfHint", {
                    rounds: reportFor.room.summary.rounds,
                    n: reportFor.room.summary.wins_needed,
                  })}
                </p>
              )}
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
            </>
          ) : (
            /* A walkover needs a winner and a reason, not a scoreline: the backend fills the
               minimum score the format needs and marks HOW it was decided. */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("outcomeWinner")}</Label>
                <Select value={outcomeWinner} onValueChange={setOutcomeWinner}>
                  <SelectTrigger size="sm">
                    <SelectValue placeholder={t("pickWinner")} />
                  </SelectTrigger>
                  <SelectContent>
                    {[reportFor?.team_a, reportFor?.team_b]
                      .filter((team): team is H2HTeamRef => !!team)
                      .map((team) => (
                        <SelectItem
                          key={team.tournament_team_id}
                          value={String(team.tournament_team_id)}
                        >
                          {team.team_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("outcomeNote")}</Label>
                <Input
                  value={outcomeNote}
                  onChange={(e) => setOutcomeNote(e.target.value)}
                  placeholder={t("outcomeNotePlaceholder")}
                />
              </div>
            </div>
          )}

          {/* ── what the two teams sent in ────────────────────────────────────────────────
              An organizer entering a result should see what the teams already claimed rather
              than retyping it, and whether the two of them agree - which is most of what a
              dispute comes down to. */}
          {submissions.some((s) => s.status === "pending") && (
            <div className="space-y-2 rounded-md border p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-primary text-sm font-semibold">{t("teamSubmissions")}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    agreement === "agree" && "border-green-500 text-green-500",
                    agreement === "disagree" && "border-destructive text-destructive",
                  )}
                >
                  {dyn(t, "agreement_", agreement)}
                </Badge>
              </div>
              {submissions
                .filter((s) => s.status === "pending")
                .map((sub) => (
                  <div key={sub.submission_id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex-1 truncate">
                      <span className="font-medium">{sub.team_name}</span>
                      {": "}
                      <span className="tabular-nums">{sub.score_a} : {sub.score_b}</span>
                      {sub.note && <span className="text-muted-foreground"> - {sub.note}</span>}
                    </span>
                    <Button
                      size="sm" variant="outline" className="h-7"
                      disabled={busy}
                      onClick={() => handleApproveSubmission(sub)}
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7"
                      disabled={busy}
                      onClick={() => handleRejectSubmission(sub)}
                    >
                      {t("reject")}
                    </Button>
                  </div>
                ))}
            </div>
          )}

          {/* ── per-player stat lines (owner 2026-08-12) ──────────────────────────────────
              One row per rostered player on each side: kills, damage, assists, the same three
              numbers Battle Royale entry collects. Blank means 0. The backend sums these across
              the stage into each player's single stats row, which is what player profiles, the
              kill tables and the ranking ladders read. Optional: saving with everything blank
              records the set score exactly as before. */}
          {outcome !== "normal" ? null : rosterLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <IconLoader2 className="size-3.5 animate-spin" />
              {t("loadingRosters")}
            </p>
          ) : rosters.length > 0 ? (
            <div className="space-y-3">
              <div>
                <p className="text-primary text-sm font-semibold">{t("playerStats")}</p>
                <p className="text-muted-foreground text-xs">{t("playerStatsHint")}</p>
              </div>

              {rosters.map((team) => (
                <div key={team.tournament_team_id} className="space-y-1.5">
                  <p className="truncate text-xs font-medium">{team.team_name}</p>
                  {team.players.length === 0 ? (
                    <p className="text-muted-foreground text-xs italic">{t("noRoster")}</p>
                  ) : (
                    <div className="space-y-1">
                      {/* column headings, once per team */}
                      <div className="text-muted-foreground grid grid-cols-[1fr_3.5rem_4.5rem_3.5rem] gap-1.5 px-1 text-[10px] uppercase">
                        <span>{t("colPlayer")}</span>
                        <span className="text-center">{t("colKills")}</span>
                        <span className="text-center">{t("colDamage")}</span>
                        <span className="text-center">{t("colAssists")}</span>
                      </div>
                      {team.players.map((p) => {
                        const draft = playerLines[p.player_id];
                        const setField = (field: "kills" | "damage" | "assists", value: string) =>
                          setPlayerLines((prev) => ({
                            ...prev,
                            [p.player_id]: {
                              tournament_team_id: team.tournament_team_id,
                              kills: prev[p.player_id]?.kills ?? "",
                              damage: prev[p.player_id]?.damage ?? "",
                              assists: prev[p.player_id]?.assists ?? "",
                              [field]: value,
                            },
                          }));
                        return (
                          <div
                            key={p.player_id}
                            className="grid grid-cols-[1fr_3.5rem_4.5rem_3.5rem] items-center gap-1.5"
                          >
                            <span className="truncate text-xs" title={p.username}>
                              {p.in_game_name || p.username}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              className="h-8 text-center text-xs"
                              value={draft?.kills ?? ""}
                              onChange={(e) => setField("kills", e.target.value)}
                              placeholder="0"
                            />
                            <Input
                              type="number"
                              min={0}
                              className="h-8 text-center text-xs"
                              value={draft?.damage ?? ""}
                              onChange={(e) => setField("damage", e.target.value)}
                              placeholder="0"
                            />
                            <Input
                              type="number"
                              min={0}
                              className="h-8 text-center text-xs"
                              value={draft?.assists ?? ""}
                              onChange={(e) => setField("assists", e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportFor(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveResult}
              disabled={
                busy ||
                (outcome === "normal"
                  ? scoreA === "" || scoreB === ""
                  : outcomeWinner === "")
              }
            >
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              {t("saveResult")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── manage one match: kick-off time, live marker, its own room settings ────────────
          Separate from the result dialog on purpose: scheduling is event editing
          (can_edit_events) while entering a result is can_upload_results, and an organizer
          with only one of the two must not see controls that will 403. */}
      <Dialog open={!!manageFor} onOpenChange={(open) => { if (!open) setManageFor(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("manageMatch")}</DialogTitle>
            <DialogDescription>
              {t("vsPair", {
                a: manageFor?.team_a?.team_name?.trim() || t("tbd"),
                b: manageFor?.team_b?.team_name?.trim() || t("tbd"),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("schedDate")}</Label>
                <Input
                  type="date" value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("schedTime")}</Label>
                <Input
                  type="time" value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">{t("schedHint")}</p>

            {/* Going live is its own action: it tells both teams to join the room now. */}
            {manageFor?.status !== "completed" && (
              <Button
                variant="outline" size="sm" className="w-full"
                disabled={busy || manageFor?.status === "live"}
                onClick={handleGoLive}
              >
                {manageFor?.status === "live" ? t("alreadyLive") : t("markLive")}
              </Button>
            )}

            {/* Room settings for THIS match only: the exception an organizer reaches for on a
                grand final. Everything else keeps inheriting the stage. */}
            <Button
              variant="outline" size="sm" className="w-full"
              disabled={busy}
              onClick={() => {
                if (!manageFor) return;
                setRoomEditor({
                  scope: "match",
                  objectId: manageFor.h2h_match_id,
                  label: `${manageFor.team_a?.team_name ?? t("tbd")} vs ${manageFor.team_b?.team_name ?? t("tbd")}`,
                });
                setManageFor(null);
              }}
            >
              <IconSettings className="size-4" /> {t("roomSettingsThisMatch")}
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageFor(null)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveSchedule} disabled={busy}>
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              {t("saveSchedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── match details for everyone else: room, time, and "submit our result" ───────────
          A player could previously read nothing about their own match on this page. */}
      <Dialog open={!!detailsFor} onOpenChange={(open) => { if (!open) setDetailsFor(null); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("matchDetails")}</DialogTitle>
            <DialogDescription>
              {t("vsPair", {
                a: detailsFor?.team_a?.team_name?.trim() || t("tbd"),
                b: detailsFor?.team_b?.team_name?.trim() || t("tbd"),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {detailsFor?.scheduled_date && (
              <p className="text-xs">
                <span className="text-muted-foreground">{t("kickOff")}: </span>
                {detailsFor.scheduled_date}
                {detailsFor.scheduled_time ? ` ${detailsFor.scheduled_time.slice(0, 5)}` : ""}
              </p>
            )}
            {detailsFor?.status === "completed" && (
              <p className="text-xs">
                <span className="text-muted-foreground">{t("result")}: </span>
                <span className="tabular-nums">{detailsFor.score_a} : {detailsFor.score_b}</span>
                {detailsFor.result_type && detailsFor.result_type !== "normal" && (
                  <span className="text-muted-foreground">
                    {" "}({dyn(t, "resultType_", detailsFor.result_type)}
                    {detailsFor.result_note ? `: ${detailsFor.result_note}` : ""})
                  </span>
                )}
              </p>
            )}

            {detailsFor?.room?.summary && (
              <CSRoomCard
                summary={detailsFor.room.summary}
                roomId={detailsFor.room.room_id}
                roomPassword={detailsFor.room.room_password}
                notes={detailsFor.room.notes}
                isPublished={detailsFor.room.is_published}
                sourceScope={detailsFor.room.source_scope}
                hasCredentials={detailsFor.room.has_room_credentials}
              />
            )}

            {/* Submit our result: only for somebody who actually plays in this match (the
                backend 403s otherwise, which is what `involved` records), and only while the
                organizer has not entered one. */}
            {subLoading ? (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <IconLoader2 className="size-3.5 animate-spin" /> {t("loading")}
              </p>
            ) : involved && !canReview && detailsFor?.status !== "completed" ? (
              <div className="space-y-2 rounded-md border p-2.5">
                <div>
                  <p className="text-primary text-sm font-semibold">{t("submitOurResult")}</p>
                  <p className="text-muted-foreground text-xs">{t("submitOurResultHint")}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="truncate text-xs">
                      {detailsFor?.team_a?.team_name ?? t("teamA")}
                    </Label>
                    <Input
                      type="number" min={0} className="h-8 text-xs"
                      value={mySubA} onChange={(e) => setMySubA(e.target.value)} placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="truncate text-xs">
                      {detailsFor?.team_b?.team_name ?? t("teamB")}
                    </Label>
                    <Input
                      type="number" min={0} className="h-8 text-xs"
                      value={mySubB} onChange={(e) => setMySubB(e.target.value)} placeholder="0"
                    />
                  </div>
                </div>
                <Textarea
                  rows={2} className="text-xs" value={mySubNote}
                  onChange={(e) => setMySubNote(e.target.value)}
                  placeholder={t("submitNotePlaceholder")}
                />
                <Button
                  size="sm" className="w-full"
                  disabled={busy || mySubA === "" || mySubB === ""}
                  onClick={handleSubmitOwnResult}
                >
                  {busy && <IconLoader2 className="size-4 animate-spin" />}
                  {t("submitResult")}
                </Button>
              </div>
            ) : null}

            {/* What has already been sent in, so a team can see whether its opponent agreed. */}
            {involved && submissions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-primary text-sm font-semibold">{t("teamSubmissions")}</p>
                {submissions.map((sub) => (
                  <div key={sub.submission_id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex-1 truncate">
                      <span className="font-medium">{sub.team_name}</span>{": "}
                      <span className="tabular-nums">{sub.score_a} : {sub.score_b}</span>
                    </span>
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                      {dyn(t, "subStatus_", sub.status)}
                    </Badge>
                    {sub.review_note && (
                      <span className="text-muted-foreground w-full">{sub.review_note}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsFor(null)}>{t("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── the room-settings editor, mounted once for whichever scope is open ── */}
      {roomEditor && (
        <CSRoomSettingsDialog
          open
          onOpenChange={(open) => { if (!open) setRoomEditor(null); }}
          scope={roomEditor.scope}
          objectId={roomEditor.objectId}
          scopeLabel={roomEditor.label}
          onSaved={refresh}
        />
      )}
    </Card>
  );
}

// ── H2HStageBrackets ──────────────────────────────────────────────────────────
// Every bracket in one stage, stacked (owner backlog item 21, 2026-08-13).
//
// A Clash Squad stage usually holds ONE bracket and this renders exactly one card, identical to
// what was there before. A stage the organizer split into groups renders one card per group -
// "Stage 1 - Group A", "Stage 1 - Group B" - each reading, generating and scoring independently.
//
// It costs ONE extra request: the bracket read already returns `stage_brackets`, a row per group,
// so this asks once without a group and then lets each card fetch its own tree.
//
// HOW IT CONNECTS: mounted by the admin event page (app/(a)/a/events/[slug]) and the public
// tournament page (EventDetailsWrapper) in place of a bare H2HBracketCard.
export function H2HStageBrackets(
  props: React.ComponentProps<typeof H2HBracketCard>,
) {
  const [brackets, setBrackets] = useState<
    Array<{ group_id: number; group_name: string }> | null
  >(null);

  useEffect(() => {
    let alive = true;
    headToHeadApi
      .getBracket(props.stageId)
      .then((res) => {
        if (alive) setBrackets(res.stage_brackets ?? []);
      })
      // A failed read is not worth a message here: the single card below renders anyway and
      // shows its own error state.
      .catch(() => { if (alive) setBrackets([]); });
    return () => { alive = false; };
  }, [props.stageId]);

  // Until we know, and whenever the stage is not split, behave exactly as before: one card, no
  // group, backend resolves which bracket that is.
  if (!brackets || brackets.length <= 1) {
    return <H2HBracketCard {...props} />;
  }

  return (
    <div className="space-y-4">
      {brackets.map((b) => (
        <H2HBracketCard
          key={b.group_id}
          {...props}
          groupId={b.group_id}
          groupName={b.group_name}
        />
      ))}
    </div>
  );
}
