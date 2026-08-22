"use client";

import React, { useState, useEffect, use } from "react";
// One rule for "is this Clash Squad?" - the plain "cs" format the picker
// writes since 2026-08-13 does not match the old "cs - " literals.
import { isClashSquadFormat } from "@/lib/eventFormats";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
// MVPs tab (owner 2026-07-02): criteria-arranged event MVP. See _components/MvpTab.tsx.
import MvpTab from "@/app/(a)/a/leaderboards/_components/MvpTab";
// Top Killers tab (owner 2026-07-05, complaint H): players ranked by summed kills. Sibling of MvpTab;
// shares the scope/combine + through-a-design Download bar. See _components/TopKillersTab.tsx.
import TopKillersTab from "@/app/(a)/a/leaderboards/_components/TopKillersTab";
// Combined standings (owner 2026-07-06): the SAME self-contained combine-across-stages/groups view
// used on the public tournament page, mounted here as a team-only "Combined" tab so admins/organizers
// can merge results from any stages/groups and see one aggregate team leaderboard. It fetches
// POST /events/get-event-combined-standings/ itself (authed bypass lets staff see pre-publish).
import { CombinedStandings } from "@/app/(user)/tournaments/[slug]/_components/CombinedStandings";
// Debugger-log backfill (owner 2026-07-02): fills 3D-room rich stats post-hoc. See the panel file.
import DebuggerBackfillPanel from "@/app/(a)/a/leaderboards/_components/DebuggerBackfillPanel";
// Tie-breakers (owner 2026-07-02): arranged equal-points ordering, apply-to-all|stage|group.
import TieBreakersPanel from "@/app/(a)/a/leaderboards/_components/TieBreakersPanel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconAlertCircle,
  IconTrophy,
  IconSettings,
  IconMap,
  IconUsers,
  IconPlus,
  IconX,
  IconUpload,
  IconFlag,
  IconBroadcast,
  IconLayersSubtract,
} from "@tabler/icons-react";
// Redo map, per-team player expand/collapse, and the roster "Add player" control now live inside
// the shared <MatchResultsGrid> (components/leaderboards/MatchResultsGrid.tsx), so the AlertDialog
// primitives + IconChevron*/IconRefresh/IconUserPlus/Checkbox they used are imported there, not here.
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
// Add-player dialog (Roster Rules, owner 2026-06-15): per-team picker in the Player
// Stats section that adds a PLAYING-role member to this event roster.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { env } from "@/lib/env";
// Team country flag beside team names in the per-map placement editor, per-team player groups, and
// the Total Leaderboard (owner 2026-07-03). team_country rides on each stat / overall row
// (get_all_leaderboard_details_for_event) and is threaded onto EditRow / TeamPlayerGroup below.
// Solo/blank -> CountryFlag renders nothing.
import { CountryFlag } from "@/lib/countryFlag";
// Absent-vs-zero for the manual score boxes (owner bug 2026-08-06). scoreOrZero collapses a blank
// COUNT box to 0 for the API; placement is deliberately NOT collapsed so a blank one reaches the
// backend as null and gets rejected instead of scoring 0. See lib/scoreInput.ts.
import {
  rowsMissingPlacement,
  scoreOrZero,
  type ScoreValue,
} from "@/lib/scoreInput";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { EventStageExportGraphicDialog } from "@/app/(organizer)/organizer/events/[slug]/leaderboard/_components/EventStageExportGraphicDialog";
import Link from "next/link";
// Live Overlays STUDIO link (owner 2026-07-05, complaint C): the legacy per-selection "Copy OBS
// overlay link" dialog was removed - every OBS link now lives in the studio (/a/overlays/<eventId>)
// as ONE stable per-overlay link the streamer pastes once, so a stage/group change never changes it.
// Broadcast control also lives in the studio (moved 2026-07-02).
import { toast } from "sonner";
// Shared advisory-watchlist badge + client (components/WatchTag.tsx, lib/watchlist.ts). One bulk
// watchlistApi.tags call (recomputed when the standings reload) marks which standings team_ids /
// player_ids are watched; <WatchTag> then renders next to those flagged names in the standings.
import { WatchTag } from "@/components/WatchTag";
import { watchlistApi } from "@/lib/watchlist";
import { ManualMatchResultStep } from "../../_components/ManualMatchResultStep";
import { MatchMethodSelectionStep } from "../../_components/MatchMethodSelectionStep";
import { FileUploadStep } from "../../_components/FileUploadStep";
// "Upload all maps (.log)" - multi-map match-log upload (per-file map pick + review + apply),
// mirroring the leaderboard view page so the edit page offers it too (owner 2026-06-29).
import { MultiMapLogUpload } from "../../_components/MultiMapLogUpload";
import { GroupBulkUploadPanel } from "../../_components/GroupBulkUploadPanel";
// Flagged-kills control (owner 2026-06-30): the "Count flagged players' kills" toggle + the per-player
// list. Previously only on the leaderboard VIEW page; the admin uploads results HERE on the edit page,
// so it must be reachable here too. Same component the view page mounts.
import { FlaggedKillsPanel } from "@/components/leaderboards/FlaggedKillsPanel";
// Pending capture bucket (complaint D): "decide later" uploads from the desktop capture client, resolved
// here as a new/replacement map or discarded. Renders nothing when there are none.
import { PendingCapturesPanel } from "@/components/leaderboards/PendingCapturesPanel";
// OCR review flow (Phase 1): pick a map + drop a screenshot (MapSelectionStep), then review +
// correct the auto-extracted rows (OCRReviewTable) and commit. Mounted in the Upload drawer below,
// in place of the old read-only ImageUploadStep preview. DraftRow types come from lib/api/ocr.ts.
import { MapSelectionStep } from "../../_components/MapSelectionStep";
import { OCRReviewTable } from "../../_components/OCRReviewTable";
import type { DraftRow } from "@/lib/api/ocr";
// Scoring Config editor (owner 2026-07-04 organizer parity): the per-match kill/assist/damage +
// placement-ladder editor and its "Apply to..." fan-out, extracted from this page into a shared
// component so the organizer leaderboard page can mount the SAME tool on their events. Behaviour
// here is unchanged: it stays controlled by this page's shared selectedMatchId and re-saves the
// map's results via handleSaveMatch after a scoring save (so points recompute).
import { ScoringConfigPanel } from "../../_components/ScoringConfigPanel";
// Match Results grid (owner 2026-07-04 organizer parity): the always-editable per-map grid
// (placement/kills/bonus/penalty/played + per-player expandable rows + live Match Leaderboard
// preview + Save this map / Save all maps / Redo this map), extracted VERBATIM from this tab into
// a shared component so the organizer leaderboard page can mount the SAME grid. This page stays
// the source of truth for the editing state (editRows/playerGroups/selectedMatchId are shared with
// the Total Leaderboard + Scoring tabs), so the grid is fully controlled: it receives that state +
// the handlers below and renders identically. No `labels` are passed here, so it renders the exact
// English the tab always shipped (admin surface is i18n-exempt). Zero behaviour change.
import { MatchResultsGrid } from "@/components/leaderboards/MatchResultsGrid";
import { MatchEvidencePanel } from "@/components/leaderboards/MatchEvidencePanel";
import { readJson } from "@/lib/readJson";

type Params = { id: string };

// ── Types ──────────────────────────────────────────────────────────────────────

interface RawPlayer {
  player_id: number;
  username: string;
  kills: number;
  damage: number;
  assists: number;
}

interface RawStat {
  competitor_id?: number;
  tournament_team_id?: number;
  username?: string;
  team_name?: string;
  // The team's auto-derived country (team rows); drives the flag beside the name.
  team_country?: string | null;
  placement: number;
  kills: number;
  placement_points: number;
  kill_points: number;
  bonus_points: number;
  penalty_points: number;
  total_points: number;
  effective_total: number;
  players?: RawPlayer[];
}

interface MatchScoringSettings {
  kill_point: number;
  placement_points: Record<string, number>;
  points_per_assist: number;
  points_per_1000_damage: number;
}

interface MatchData {
  match_id: number;
  match_number: number;
  match_map: string;
  stats: RawStat[];
  scoring_settings?: MatchScoringSettings;
}

interface OverallEntry {
  competitor_id?: number;
  tournament_team_id?: number;
  competitor__user__username?: string;
  team_name?: string;
  // The team's auto-derived country (team rows); drives the flag beside the name.
  team_country?: string | null;
  total_kills: number;
  total_booyah: number;
  // Aggregated point breakdown the backend already returns per row in overall_leaderboard
  // (Sum of each map's placement_points / kill_points). Surfaced as their own columns so the
  // standings always show where the points came from, not just the total. (owner 2026-06-15)
  placement_sum?: number;
  kill_sum?: number;
  total_points: number;
  effective_total: number;
}

// Numeric cells are ScoreValue (number | null): null means "this box is empty", which is a
// DIFFERENT thing from 0 and must survive all the way to buildMatchSaveRequest. See
// lib/scoreInput.ts for why (owner bug 2026-08-06: a blanked placement used to post as 0 and
// save silently at zero placement points).
interface EditRow {
  id: number;
  name: string;
  // Team country for the flag (undefined for solo rows -> no flag).
  teamCountry?: string | null;
  placement: ScoreValue;
  kills: ScoreValue;
  bonus_points: ScoreValue;
  penalty_points: ScoreValue;
  played: boolean;
}

interface PlayerEditRow {
  player_id: number;
  username: string;
  kills: ScoreValue;
  damage: ScoreValue;
  assists: ScoreValue;
  played: boolean;
}

interface TeamPlayerGroup {
  teamId: number;
  teamName: string;
  // Team country for the flag beside the group's team name.
  teamCountry?: string | null;
  players: PlayerEditRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statToEditRow(stat: RawStat): EditRow {
  return {
    id: stat.competitor_id ?? stat.tournament_team_id ?? 0,
    name: stat.username ?? stat.team_name ?? "-",
    teamCountry: stat.team_country,
    placement: stat.placement,
    kills: stat.kills,
    bonus_points: stat.bonus_points ?? 0,
    penalty_points: stat.penalty_points ?? 0,
    played: true,
  };
}

function statToTeamPlayerGroup(stat: RawStat): TeamPlayerGroup {
  return {
    teamId: stat.tournament_team_id ?? 0,
    teamName: stat.team_name ?? "-",
    teamCountry: stat.team_country,
    players: (stat.players ?? []).map((p) => ({
      player_id: p.player_id,
      username: p.username,
      kills: p.kills ?? 0,
      damage: p.damage ?? 0,
      assists: p.assists ?? 0,
      played: true,
    })),
  };
}

function getEntityId(e: OverallEntry) {
  return e.competitor_id ?? e.tournament_team_id ?? 0;
}

function getEntityName(e: OverallEntry) {
  return e.competitor__user__username ?? e.team_name ?? "-";
}

// ── Roster Rules (Feature B, owner 2026-06-15) ──────────────────────────────────
// Only PLAYING-role members (team_captain/vice_captain/member) may be added to an event
// roster; STAFF (coach/manager/analyst) are rejected by the backend. The team's roles
// come from team/get-team-details/ -> team.members[].management_role (the event roster
// members carry no role). These match afc_team/views.py PLAYER_ROLES.
const PLAYER_ROLES = ["team_captain", "vice_captain", "member"];

// A selectable candidate for the inline add-player dialog: a PLAYING-role team member
// not already on the event roster (id from get-team-details/ member.id).
interface AddPlayerCandidate {
  id: number;
  username: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditLeaderboardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { token } = useAuth();

  const [eventData, setEventData] = useState<any>(null);
  const [eventSlug, setEventSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registered playing roster per team: tournament_team_id -> {team_name, members[]}.
  // Sourced from get-event-details (tournament_teams[].members) the SAME way
  // ManualMatchResultStep does. The leaderboard's saved stats often carry no per-player
  // breakdown (stats[].players empty), which made the inline Player Stats section show
  // "No player data available". We overlay any saved per-player kills onto this roster so a
  // team's registered players ALWAYS show, pre-filled. (bug fix 2026-06-15)
  const [rosterByTeam, setRosterByTeam] = useState<
    Map<number, { team_name: string; members: { player_id: number; username: string }[] }>
  >(new Map());

  // Navigation state
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Participant type
  const [participantType, setParticipantType] = useState<"solo" | "team">(
    "solo",
  );

  // Bumped after a result upload applies so the FlaggedKillsPanel remounts + re-fetches its flags
  // (mirrors the leaderboard view page). A team upload can create/clear ringer flags, so the panel
  // must re-read them once the upload writes.
  const [flagRefreshKey, setFlagRefreshKey] = useState(0);

  // Tab control
  const [activeTab, setActiveTab] = useState("matches");

  // Upload drawer
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [uploadingMatch, setUploadingMatch] = useState<{
    match_id: number;
    match_name: string;
    result_inputted: boolean;
  } | null>(null);
  const [uploadView, setUploadView] = useState<
    "method" | "manual" | "image_upload" | "room_file_upload"
  >("method");
  // ── OCR review sub-flow state (lives inside the "image_upload" view) ─────────
  // The Image Upload method runs a 2-step mini-stepper: MapSelectionStep (pick map + upload
  // screenshot) -> OCRReviewTable (edit + commit). Once MapSelectionStep returns a session we
  // stash it here so OCRReviewTable can take over the same drawer panel. Reset whenever the drawer
  // opens / the view changes so a new upload starts clean.
  const [ocrSession, setOcrSession] = useState<{
    sessionId: string;
    draftRows: DraftRow[];
    engine?: string | null;
  } | null>(null);

  // Match editing
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<Record<number, EditRow[]>>({});
  // Team player rows: matchId → TeamPlayerGroup[]
  const [playerGroups, setPlayerGroups] = useState<
    Record<number, TeamPlayerGroup[]>
  >({});
  // Which team groups are expanded in the player section
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>(
    {},
  );
  const [savingMatch, setSavingMatch] = useState(false);
  // Redo map (owner 2026-06-15): in-flight flag for the destructive "clear this map" action.
  const [redoingMap, setRedoingMap] = useState(false);
  // Redo ALL maps (owner 2026-07-07): in-flight flag for clearing every map in the group.
  const [redoingAllMaps, setRedoingAllMaps] = useState(false);
  // Whole-group "Save all maps" in-flight flag (fans out one save per map).
  const [savingAllMaps, setSavingAllMaps] = useState(false);

  // ── Add-player dialog state (Roster Rules, owner 2026-06-15) ───────────────────
  // The team whose "Add player" dialog is open (one of the Player Stats groups), the
  // loaded eligible candidates (PLAYING-role members not yet rostered), and per-phase
  // flags. Mirrors the same control in ManualMatchResultStep.
  const [addPlayerTeam, setAddPlayerTeam] = useState<{
    teamId: number;
    teamName: string;
  } | null>(null);
  const [addPlayerCandidates, setAddPlayerCandidates] = useState<
    AddPlayerCandidate[]
  >([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [addingPlayerId, setAddingPlayerId] = useState<number | null>(null);

  // Total leaderboard
  const [overall, setOverall] = useState<OverallEntry[]>([]);
  const [adjustments, setAdjustments] = useState<Record<number, number>>({});
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Per-match scoring config now lives in the shared <ScoringConfigPanel> (mounted on the
  // Scoring Config tab below). This page only supplies the stage/group/match context + token
  // and re-saves the map's results after a scoring save via handleSaveMatch.

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // AUTO-SEED safety-net (owner 2026-06-21): before loading standings, make sure every team added
      // to this event (admin add, public/organizer registration, or qualifier promotion) is seeded
      // into the ENTRY stage's groups, so it shows up here for stat entry WITHOUT a manual "Seed to
      // groups" step. Idempotent + gated (admin/organizer) on the backend; errors are ignored so the
      // page always loads. Endpoint: seeding_management.sync_entry_stage_seeding.
      try {
        await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/sync-entry-stage/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ event_id: id }),
          },
        );
      } catch {
        // Non-fatal: standings still load; teams can be seeded manually if this ever fails.
      }

      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: id }),
        },
      );
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(data.message || data.detail || "Failed to fetch data");
      }
      setEventData(data);
      setParticipantType(data.participant_type === "solo" ? "solo" : "team");

      const slug = data.event_slug ?? data.slug ?? "";
      if (slug) setEventSlug(slug);

      if (!selectedStageId && data.stages?.length > 0) {
        setSelectedStageId(data.stages[0].stage_id.toString());
        setSelectedGroupId(data.stages[0].groups[0]?.group_id.toString() ?? "");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchEventSlug = async () => {
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
      );
      const data = await res.json();
      const event = (data.events ?? []).find(
        (e: any) => e.event_id.toString() === id,
      );
      if (event?.slug) setEventSlug(event.slug);
    } catch {}
  };

  // Pull the registered playing roster (per team) for this event. Mirrors
  // ManualMatchResultStep: POST get-event-details {slug} -> event_details.tournament_teams[]
  // each with members[]{player_id, username}. Stored in rosterByTeam so the group-change effect
  // can overlay saved stats onto the registered players. Team mode only (solo has no team roster).
  const fetchRoster = async (slug: string) => {
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slug }),
        },
      );
      const data = await res.json();
      const details = data.event_details ?? data;
      const teams: any[] = details.tournament_teams ?? [];
      const map = new Map<
        number,
        { team_name: string; members: { player_id: number; username: string }[] }
      >();
      for (const tt of teams) {
        if (tt?.tournament_team_id == null) continue;
        map.set(tt.tournament_team_id, {
          team_name: tt.team_name ?? "-",
          members: (tt.members ?? []).map((m: any) => ({
            player_id: m.player_id,
            username: m.username,
          })),
        });
      }
      setRosterByTeam(map);
    } catch {
      // Non-fatal: fall back to whatever per-player stats the leaderboard saved.
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, token]);

  // Fallback slug lookup if not in leaderboard response
  useEffect(() => {
    if (eventData && !eventSlug) {
      fetchEventSlug();
    }
  }, [eventData]);

  // Once we know the slug and it's a team event, load the registered roster so the
  // Player Stats section can show each team's players (overlaying any saved kills).
  useEffect(() => {
    if (eventSlug && participantType === "team") {
      fetchRoster(eventSlug);
    }
  }, [eventSlug, participantType]);

  // When stage changes, reset group to first
  useEffect(() => {
    if (!selectedStageId || !eventData) return;
    const stage = eventData.stages?.find(
      (s: any) => s.stage_id.toString() === selectedStageId,
    );
    const firstGroup = stage?.groups?.[0];
    setSelectedGroupId(firstGroup?.group_id?.toString() ?? "");
  }, [selectedStageId]);

  // When group changes, reload edit state for that group
  useEffect(() => {
    if (!selectedGroupId || !eventData) return;

    const stage = eventData.stages?.find(
      (s: any) => s.stage_id.toString() === selectedStageId,
    );
    const group = stage?.groups?.find(
      (g: any) => g.group_id.toString() === selectedGroupId,
    );
    if (!group) return;

    const groupMatches: MatchData[] = group.matches ?? [];
    setSelectedMatchId(groupMatches[0]?.match_id ?? null);

    const initialRows: Record<number, EditRow[]> = {};
    const initialPlayerGroups: Record<number, TeamPlayerGroup[]> = {};

    for (const m of groupMatches) {
      initialRows[m.match_id] = (m.stats ?? []).map(statToEditRow);
      // Build each team's player rows from the REGISTERED ROSTER when we have it,
      // overlaying any saved per-player kills/damage/assists. Falls back to the saved
      // stats' players[] (statToTeamPlayerGroup) when the roster isn't loaded yet or the
      // team has no registered members. This is what makes a team's 6 players show up
      // even when the leaderboard only saved team-level placements. (bug fix 2026-06-15)
      initialPlayerGroups[m.match_id] = (m.stats ?? []).map((stat) => {
        const teamId = stat.tournament_team_id ?? 0;
        const roster = rosterByTeam.get(teamId);
        if (!roster || roster.members.length === 0) {
          return statToTeamPlayerGroup(stat);
        }
        // Index saved per-player stats by user id so we can overlay them onto the roster.
        const savedByUid = new Map<number, RawPlayer>();
        for (const p of stat.players ?? []) {
          if (p?.player_id != null) savedByUid.set(p.player_id, p);
        }
        return {
          teamId,
          teamName: stat.team_name ?? roster.team_name ?? "-",
          teamCountry: stat.team_country,
          players: roster.members.map((mem) => {
            const sp = savedByUid.get(mem.player_id);
            return {
              player_id: mem.player_id,
              username: mem.username,
              // No saved row for this member on this map means nothing has been entered for
              // them yet, so their boxes start EMPTY. A member WITH a saved row keeps its real
              // value, including a deliberate 0 - that is the distinction the owner could not
              // see before (bug 2026-08-06).
              kills: sp?.kills ?? null,
              damage: sp?.damage ?? null,
              assists: sp?.assists ?? null,
              // Free Fire squad allows at most 4 PLAYED players per match - the backend
              // (edit-match-result) rejects any team with >4 played. A registered roster
              // can hold 5-6 (substitutes), so a roster member counts as "played" by
              // DEFAULT only when they have a saved per-player stat for THIS map (sp set).
              // Substitutes not in the saved result default to NOT played; the admin ticks
              // the per-player "Played" box for anyone who actually played. Before this every
              // roster member defaulted to played=true, so every 5-6 member squad failed to
              // save ("Team X: max 4 played players allowed"). (bug fix 2026-06-15)
              played: sp != null,
            };
          }),
        };
      });
    }

    setEditRows(initialRows);
    setPlayerGroups(initialPlayerGroups);
    setExpandedTeams({});

    setOverall(group.overall_leaderboard ?? []);
    setAdjustments({});

    // Per-match scoring config is seeded by <ScoringConfigPanel> itself (from groupMatches'
    // scoring_settings), so it is no longer initialised here.
  }, [selectedGroupId, eventData, rosterByTeam]);

  // ── Watchlist tags (owner 2026-06-21) ───────────────────────────────────────
  // Mark which standings rows are on the AFC-wide advisory watchlist so <WatchTag> can flag them.
  // We derive the ids from the LOADED standings state (overall + per-match editRows + per-team
  // playerGroups) so the set tracks the currently selected group, and re-run whenever those reload
  // (group/stage switch, data refresh). One bulk watchlistApi.tags call per change; best-effort.
  //
  // Id semantics differ by mode: in TEAM mode an editRow/overall id is a SITE TEAM id and
  // playerGroups carry team ids + member player ids; in SOLO mode an editRow/overall id is a
  // PLAYER (competitor) id. We bucket accordingly so a team id is never checked against players.
  const [watched, setWatched] = useState<{
    teamIds: Set<number>;
    playerIds: Set<number>;
  }>({ teamIds: new Set(), playerIds: new Set() });

  useEffect(() => {
    const teamIds = new Set<number>();
    const playerIds = new Set<number>();
    const bucket = participantType === "team" ? teamIds : playerIds;
    // overall standings: id is team (team mode) or competitor/player (solo mode).
    for (const e of overall) {
      const eid = e.tournament_team_id ?? e.competitor_id;
      if (eid) bucket.add(eid);
    }
    // per-match editable rows: same id semantics as overall.
    for (const rows of Object.values(editRows)) {
      for (const r of rows) if (r.id) bucket.add(r.id);
    }
    // per-team player groups (team mode only): team header id + each member player id.
    for (const groups of Object.values(playerGroups)) {
      for (const g of groups) {
        if (g.teamId) teamIds.add(g.teamId);
        for (const p of g.players) if (p.player_id) playerIds.add(p.player_id);
      }
    }
    const teamArr = [...teamIds];
    const playerArr = [...playerIds];
    if (teamArr.length === 0 && playerArr.length === 0) {
      setWatched({ teamIds: new Set(), playerIds: new Set() });
      return;
    }
    let cancelled = false;
    watchlistApi
      .tags({ teamIds: teamArr, playerIds: playerArr })
      .then((res) => {
        if (cancelled) return;
        setWatched({
          teamIds: new Set(res.watched_team_ids),
          playerIds: new Set(res.watched_player_ids),
        });
      })
      .catch(() => {
        /* badges are best-effort; ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [overall, editRows, playerGroups, participantType]);

  // Is this standings-row entity (a team in team mode, a player in solo mode) watched?
  const isEntityWatched = (id?: number) =>
    id != null &&
    (participantType === "team"
      ? watched.teamIds.has(id)
      : watched.playerIds.has(id));

  // ── Derived ─────────────────────────────────────────────────────────────────

  const currentStage = eventData?.stages?.find(
    (s: any) => s.stage_id.toString() === selectedStageId,
  );
  // ── CS (Clash Squad / Head-to-Head) guard (P1#3, owner 2026-07-13) ───────────
  // A "cs - *" stage is run as a knockout/round-robin BRACKET, not a BR lobby, so this
  // BR-shaped editor (match grid, .log/OCR upload, scoring config) does not apply to it.
  // When the selected stage is CS we hide the whole BR editor and point the admin to the
  // bracket on the event page (mounted there via H2HBracketCard). Mirrors the same guard
  // added to the organizer leaderboard page and the public TournamentStructure.
  const isCsStage = isClashSquadFormat(currentStage?.stage_format);
  const currentGroup = currentStage?.groups?.find(
    (g: any) => g.group_id.toString() === selectedGroupId,
  );
  const groupMatches: MatchData[] = currentGroup?.matches ?? [];
  const currentRows =
    selectedMatchId !== null ? (editRows[selectedMatchId] ?? []) : [];
  const currentPlayerGroups =
    selectedMatchId !== null ? (playerGroups[selectedMatchId] ?? []) : [];

  const currentMatch = groupMatches.find((m) => m.match_id === selectedMatchId);
  const matchLeaderboard = [...(currentMatch?.stats ?? [])].sort(
    (a, b) => b.effective_total - a.effective_total,
  );

  // Match id list for the whole-group "Save all maps" fan-out (handleSaveAllMaps). The
  // scoring-config "Apply to entire event" list is now derived inside <ScoringConfigPanel>.
  const groupMatchIds = groupMatches.map((m) => m.match_id);

  // ── Edit row helpers ─────────────────────────────────────────────────────────

  const updateRow = (
    matchId: number,
    idx: number,
    field: keyof Omit<EditRow, "id" | "name">,
    value: ScoreValue | boolean,
  ) => {
    setEditRows((prev) => {
      const rows = [...(prev[matchId] ?? [])];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, [matchId]: rows };
    });
  };

  const updatePlayerRow = (
    matchId: number,
    teamIdx: number,
    playerIdx: number,
    field: keyof Omit<PlayerEditRow, "player_id" | "username">,
    value: ScoreValue | boolean,
  ) => {
    setPlayerGroups((prev) => {
      const groups = (prev[matchId] ?? []).map((g, ti) => {
        if (ti !== teamIdx) return g;
        const players = g.players.map((p, pi) => {
          if (pi !== playerIdx) return p;
          const next = { ...p, [field]: value };
          // Entering any stat for a player implies they played (a player who did not play
          // has no stats), so auto-tick "Played". This stops the save from silently dropping
          // a player whose kills were typed while "Played" was left unticked - the save only
          // sends played=true players to respect the 4-per-squad cap. (bug fix 2026-06-15)
          //
          // Typing 0 counts as entering a stat (owner bug 2026-08-06). This test used to be
          // `value > 0`, so a player the organizer deliberately scored at 0 kills was NOT
          // ticked and was then dropped by the .filter(p => p.played) below - the one player
          // in the lobby who went scoreless lost their row while everyone else kept theirs.
          if (field !== "played" && typeof value === "number") {
            next.played = true;
          }
          return next;
        });
        return { ...g, players };
      });
      return { ...prev, [matchId]: groups };
    });
  };

  const toggleTeam = (key: string) => {
    setExpandedTeams((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Save match results ───────────────────────────────────────────────────────

  // Build the exact per-map save request (endpoint + body) for ONE map from the
  // already-loaded editRows/playerGroups state. Factored out of handleSaveMatch so the
  // single-map Save AND the new "Save all maps" fan-out share one source of truth for
  // the request shape (solo -> edit-solo-match-result/rows; team -> edit-match-result/
  // results[] with nested players[]). Returns null when the map has no rows loaded.
  const buildMatchSaveRequest = (
    matchId: number,
  ): { endpoint: string; body: any } | null => {
    const rows = editRows[matchId] ?? [];
    if (rows.length === 0) return null;

    // PLACEMENT is sent RAW so a box the admin left empty arrives as null and the backend's
    // "every team that played this map needs a finishing position" guard rejects the save.
    // Sending 0 here (what `parseInt(x) || 0` used to produce) sailed past that guard and stored
    // a played row at 0 placement points. COUNT fields go through scoreOrZero: a blank kills box
    // legitimately means none. (owner bug 2026-08-06 - see lib/scoreInput.ts)
    if (participantType === "solo") {
      return {
        endpoint: `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-solo-match-result/`,
        body: {
          match_id: matchId.toString(),
          rows: rows.map((r) => ({
            competitor_id: r.id,
            placement: r.placement,
            kills: scoreOrZero(r.kills),
            played: r.played,
            bonus_points: scoreOrZero(r.bonus_points),
            penalty_points: scoreOrZero(r.penalty_points),
          })),
        },
      };
    }

    const groups = playerGroups[matchId] ?? [];
    return {
      endpoint: `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`,
      body: {
        match_id: matchId,
        results: rows.map((r) => {
          const teamGroup = groups.find((g) => g.teamId === r.id);
          return {
            tournament_team_id: r.id,
            placement: r.placement,
            played: r.played,
            bonus_points: scoreOrZero(r.bonus_points),
            penalty_points: scoreOrZero(r.penalty_points),
            // Send ONLY the players who actually played this map. Squad rules cap a match at
            // 4 played players, and persisting not-played substitutes (played=false) would
            // also make them reappear as "played" on the next load (the details API carries
            // no per-player played flag, so a re-seeded sub looks played again). Omitting them
            // keeps the payload within the cap and makes re-saving idempotent. The admin's
            // per-player "Played" checkboxes drive who is included. (bug fix 2026-06-15)
            players: (teamGroup?.players ?? [])
              .filter((p) => p.played)
              .map((p) => ({
                user_id: p.player_id,
                kills: scoreOrZero(p.kills),
                damage: scoreOrZero(p.damage),
                assists: scoreOrZero(p.assists),
                played: true,
              })),
          };
        }),
      },
    };
  };

  /**
   * Names of the teams/players in this map that are ticked as PLAYED but have an empty
   * placement box. The backend rejects the save for exactly this case, but its message cannot
   * say WHICH rows are at fault, and in a 12-team lobby that is the whole difference between
   * fixable and not. Called by both save paths below before the POST goes out.
   * (owner bug 2026-08-06 - "they can leave score blank for certain players")
   */
  const blankPlacementNames = (matchId: number): string[] =>
    rowsMissingPlacement(editRows[matchId] ?? []);

  // POST one map's results. Throws on a non-OK response so callers (single + bulk) can
  // count successes/failures uniformly.
  const saveMatchById = async (matchId: number): Promise<void> => {
    const req = buildMatchSaveRequest(matchId);
    if (!req) return; // nothing entered for this map -> skip (not an error)
    // Stop a half-filled map here rather than letting the server reject it, so the admin is told
    // WHICH rows are missing a finishing position. Throwing (not returning) means the "Save all
    // maps" fan-out counts this map as failed instead of silently skipping it.
    const missing = blankPlacementNames(matchId);
    if (missing.length > 0) {
      throw new Error(
        `${missing.join(", ")} ${missing.length === 1 ? "has" : "have"} no finishing position for this map. ` +
          "Type each one's position (1 for the winner, then 2, 3, and so on), or untick Played, then save again.",
      );
    }
    const res = await fetch(req.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req.body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.detail || "Save failed");
    }
  };

  const handleSaveMatch = async () => {
    if (selectedMatchId === null) return;
    setSavingMatch(true);
    try {
      await saveMatchById(selectedMatchId);
      toast.success("Match results saved!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save match results");
    } finally {
      setSavingMatch(false);
    }
  };

  // ── Redo this map (owner 2026-06-15) ────────────────────────────────────────
  // Wipe the currently selected map's results (stats reset, result_inputted->False) so
  // the admin can re-enter them from scratch. Other maps in the group are untouched.
  // Hits BE POST /events/clear-match-result/ (afc_tournament_and_scrims.clear_match_result),
  // then re-fetches so the map repaints blank. Gated behind an AlertDialog (destructive).
  const handleRedoMap = async () => {
    if (selectedMatchId === null) return;
    setRedoingMap(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/clear-match-result/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ match_id: selectedMatchId, force: true }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.detail || "Failed to clear map results");
      }
      toast.success("Map cleared. You can re-enter results for this map.");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to clear map results");
    } finally {
      setRedoingMap(false);
    }
  };

  // ── Redo ALL maps of the current group at once (owner 2026-07-07) ────────────
  // Sibling of handleRedoMap: instead of clearing only the selected map, fan out the SAME
  // clear-match-result call over EVERY map in the group (force:true so already-empty maps are
  // harmless no-ops), report an "X of Y" summary, then refresh so the whole group repaints
  // blank for re-entry. Mirrors handleSaveAllMaps' Promise.allSettled fan-out.
  const handleRedoAllMaps = async () => {
    if (groupMatchIds.length === 0) return;
    setRedoingAllMaps(true);
    try {
      const results = await Promise.allSettled(
        groupMatchIds.map((mid) =>
          fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/clear-match-result/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ match_id: mid, force: true }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.message || err.detail || `Map ${mid} failed`);
            }
          }),
        ),
      );
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      const ok = groupMatchIds.length - rejected.length;
      if (rejected.length > 0) {
        toast.error(
          `Cleared ${ok} of ${groupMatchIds.length} maps. ${rejected.length} failed: ${
            rejected[0].reason?.message || "try again"
          }`,
        );
      } else {
        toast.success(
          `Cleared all ${ok} map${ok !== 1 ? "s" : ""} in this group. Re-enter the results.`,
        );
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to clear the group's maps");
    } finally {
      setRedoingAllMaps(false);
    }
  };

  // ── Save ALL maps of the current group at once ───────────────────────────────
  // The user asked to edit a whole group in one go instead of map-by-map. Every map's
  // rows are already in editRows/playerGroups (loaded by the group-change effect), so
  // this fans out one per-map save per map via Promise.allSettled (same idiom as the
  // scoring "Apply to..." fan-out), reports an "X of Y saved" summary, and refreshes once.
  const handleSaveAllMaps = async () => {
    // Only maps that actually have rows loaded are saveable.
    const saveableIds = groupMatchIds.filter(
      (mid) => (editRows[mid] ?? []).length > 0,
    );
    if (saveableIds.length === 0) {
      toast.error("No map results to save in this group yet.");
      return;
    }
    setSavingAllMaps(true);
    try {
      const results = await Promise.allSettled(
        saveableIds.map((mid) => saveMatchById(mid)),
      );
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      const ok = saveableIds.length - rejected.length;
      if (rejected.length > 0) {
        // Surface the ACTUAL backend reason (e.g. "Team X: max 4 played players allowed")
        // instead of a bare count so the admin knows what to fix, and DO NOT refetch on a
        // failure: refetch reseeds the editable tables from the server and would wipe the
        // placements / bonus / penalty the admin just typed into the maps that failed.
        // Keeping their input lets them correct it and retry. (bug fix 2026-06-15)
        const reason =
          rejected[0].reason?.message || "open the failing map and try again";
        toast.error(
          `Saved ${ok} of ${saveableIds.length} maps. ${rejected.length} failed: ${reason}`,
        );
      } else {
        toast.success(
          `Saved all ${ok} map${ok !== 1 ? "s" : ""} in this group.`,
        );
        // Only resync from the server when everything saved - see note above.
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save the group's maps");
    } finally {
      setSavingAllMaps(false);
    }
  };

  // ── Add player to event roster (Roster Rules, owner 2026-06-15) ──────────────
  // Inline twin of the ManualMatchResultStep control. The Player Stats section shows
  // each team's registered roster (rosterByTeam, derived from get-event-details/, which
  // carries no role). To offer only PLAYING-role members who are NOT yet rostered, we
  // fetch the team's full member list from team/get-team-details/ {team_name} ->
  // team.members[]{id, username, management_role}, keep PLAYER_ROLES, and drop anyone
  // already in this team's rosterByTeam members (those player_ids).
  const openAddPlayer = async (teamId: number, teamName: string) => {
    setAddPlayerTeam({ teamId, teamName });
    setAddPlayerCandidates([]);
    setLoadingCandidates(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ team_name: teamName }),
        },
      );
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(data.message || data.detail || "Failed to load team");
      }
      const members: any[] = data.team?.members ?? [];
      // user_ids already on this event's roster (from the registered roster we loaded).
      const rostered = rosterByTeam.get(teamId);
      const rosteredIds = new Set(
        (rostered?.members ?? []).map((m) => m.player_id),
      );
      const candidates: AddPlayerCandidate[] = members
        // PLAYING roles only; default a missing role to "member" (a PLAYING role).
        .filter((m) => PLAYER_ROLES.includes(m.management_role ?? "member"))
        // Not already on the event roster.
        .filter((m) => !rosteredIds.has(m.id))
        .map((m) => ({ id: m.id, username: m.username }));
      setAddPlayerCandidates(candidates);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load team members");
    } finally {
      setLoadingCandidates(false);
    }
  };

  // POST the chosen member to the new add-player endpoint, then re-fetch all leaderboard
  // data + the registered roster so the Player Stats section shows the new player.
  // Request body: { event_id, tournament_team_id, user_id } (tournament_team_id is the
  // group's teamId, which is the TournamentTeam id sourced from get-event-details/).
  const handleAddPlayer = async (userId: number) => {
    if (!addPlayerTeam) return;
    setAddingPlayerId(userId);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/add-player-to-event-roster/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            event_id: id,
            tournament_team_id: addPlayerTeam.teamId,
            user_id: userId,
          }),
        },
      );
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(
          data.message || data.detail || "Failed to add player to roster",
        );
      }
      toast.success(data.message || "Player added to the roster.");
      setAddPlayerTeam(null);
      // Refresh the registered roster (drives the Player Stats list) and leaderboard data.
      if (eventSlug) await fetchRoster(eventSlug);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add player to roster");
    } finally {
      setAddingPlayerId(null);
    }
  };

  // ── Save total leaderboard adjustments ──────────────────────────────────────

  const handleSaveAdjustments = async () => {
    const leaderboardId = currentGroup?.leaderboard?.leaderboard_id;
    if (!leaderboardId) {
      toast.error("No leaderboard found for this group");
      return;
    }

    const hasChanges = Object.values(adjustments).some((v) => v !== 0);
    if (!hasChanges) {
      toast.info("No adjustments to save");
      return;
    }

    const firstMatchId = groupMatches[0]?.match_id;
    if (!firstMatchId) {
      toast.error("No matches found to apply adjustments");
      return;
    }

    // The adjustment save re-posts the whole first map (placements included) with the bonus /
    // penalty deltas folded in, so it hits the same blank-placement trap as a normal save: a row
    // whose placement box was cleared would post null. Guard it here with the same named-rows
    // message rather than letting the server answer - on the SOLO endpoint that payload used to
    // come back as a 500. (owner bug 2026-08-06 - see lib/scoreInput.ts)
    const missingForAdjust = blankPlacementNames(firstMatchId);
    if (missingForAdjust.length > 0) {
      toast.error(
        `${missingForAdjust.join(", ")} ${missingForAdjust.length === 1 ? "has" : "have"} no finishing position on the first map. ` +
          "Fill that in on the Results tab before saving adjustments.",
      );
      return;
    }

    setSavingAdjust(true);
    try {
      const firstMatchRows = editRows[firstMatchId] ?? [];
      // An adjustment ADDS to whatever bonus/penalty the row already carries; a row whose box is
      // empty carries none, so scoreOrZero is the right base (blank bonus == 0 bonus).
      const updatedRows = firstMatchRows.map((row) => {
        const adj = adjustments[row.id] ?? 0;
        return {
          ...row,
          bonus_points: Math.max(
            0,
            scoreOrZero(row.bonus_points) + (adj > 0 ? adj : 0),
          ),
          penalty_points: Math.max(
            0,
            scoreOrZero(row.penalty_points) + (adj < 0 ? Math.abs(adj) : 0),
          ),
        };
      });

      let endpoint: string;
      let body: any;

      if (participantType === "solo") {
        endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-solo-match-result/`;
        body = {
          match_id: firstMatchId.toString(),
          rows: updatedRows.map((r) => ({
            competitor_id: r.id,
            placement: r.placement,
            kills: scoreOrZero(r.kills),
            played: r.played,
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
          })),
        };
      } else {
        const groups = playerGroups[firstMatchId] ?? [];
        endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`;
        body = {
          match_id: firstMatchId,
          results: updatedRows.map((r) => {
            const teamGroup = groups.find((g) => g.teamId === r.id);
            return {
              tournament_team_id: r.id,
              placement: r.placement,
              played: r.played,
              players: (teamGroup?.players ?? []).map((p) => ({
                player_id: p.player_id,
                kills: scoreOrZero(p.kills),
                damage: scoreOrZero(p.damage),
                assists: scoreOrZero(p.assists),
                played: p.played,
              })),
            };
          }),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.detail || "Save failed");
      }

      toast.success("Adjustments saved!");
      setAdjustments({});
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save adjustments");
    } finally {
      setSavingAdjust(false);
    }
  };

  // Per-match scoring config save + "Apply to..." fan-out + the field/rank editors now live
  // inside <ScoringConfigPanel> (Scoring Config tab). This page passes handleSaveMatch as the
  // panel's onScoringSaved so a scoring save still re-saves the map's results (recomputing points).

  // ── Upload handlers ──────────────────────────────────────────────────────────

  const handleOpenUpload = (m: MatchData) => {
    setUploadingMatch({
      match_id: m.match_id,
      match_name: `Match ${m.match_number} (${m.match_map})`,
      result_inputted: (m as any).result_inputted ?? false,
    });
    setUploadView("method");
    setOcrSession(null); // start the OCR mini-stepper from the map picker
    setUploadDrawerOpen(true);
  };

  const handleUploadComplete = () => {
    setUploadDrawerOpen(false);
    setUploadingMatch(null);
    setOcrSession(null); // clear any in-flight OCR draft when the drawer closes
    fetchData();
    setFlagRefreshKey((k) => k + 1); // re-pull ringer flags after an upload (FlaggedKillsPanel)
    setActiveTab("matches");
  };

  // ── Upload formData ───────────────────────────────────────────────────────────

  const uploadFormData = uploadingMatch
    ? {
        event_slug: eventSlug,
        event_id: id,
        completed_match_ids: uploadingMatch.result_inputted
          ? [uploadingMatch.match_id]
          : [],
        group_matches: currentGroup?.matches ?? [],
        competitors_in_group: [],
        group_leaderboard: currentGroup?.leaderboard ?? null,
        placement_points: {},
        kill_point: String(currentGroup?.leaderboard?.kill_point ?? "1"),
        assist_point: String(currentGroup?.leaderboard?.assist_point ?? "0.5"),
        damage_point: String(currentGroup?.leaderboard?.damage_point ?? "0.5"),
        apply_to_all_maps: true,
        leaderboard_id: currentGroup?.leaderboard?.leaderboard_id ?? null,
        group_id: selectedGroupId,
        stage_id: selectedStageId,
      }
    : null;

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) return <FullLoader />;

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader back title="Edit Leaderboard" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <IconAlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={fetchData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedOverall = [...overall].sort(
    (a, b) => b.effective_total - a.effective_total,
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Header row: the title + the "Copy OBS overlay link" action (live leaderboard overlay). */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {/* data-tour anchor (leaderboard-edit-title): admin tour "Edit leaderboard" step. */}
        <span data-tour="leaderboard-edit-title" className="inline-flex">
          <PageHeader
            back
            title={`Edit: ${eventData?.event_name ?? "Leaderboard"}`}
            description="Edit match results, scoring configuration, and apply adjustments"
          />
        </span>
        {/* Live Overlays studio link (owner 2026-07-05, complaint C): replaces the removed per-selection
            "Copy OBS overlay link" dialog. The studio is where every OBS link lives now - each saved
            overlay has ONE stable link, and the WHICH-leaderboard choice (including combining groups /
            stages) is driven from the overlay card, not baked into the URL. */}
        {eventData && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/a/overlays/${id}`}>
              <IconBroadcast className="size-4" /> Live overlays
            </Link>
          </Button>
        )}
        {/* Export graphic on the EDIT page too (owner 2026-07-04): previously only on the view page.
            Renders the selected stage/group standings onto a chosen custom design + size. */}
        {eventData && (
          <EventStageExportGraphicDialog
            eventId={id}
            stageId={selectedStageId}
            groupId={selectedGroupId}
            stages={eventData?.stages ?? []}
            organizationId={eventData?.organization_id ?? null}
            defaultTitle={eventData?.event_name}
            defaultSubtitle={
              eventData?.stages?.find(
                (s: any) => s.stage_id.toString() === selectedStageId,
              )?.stage_name ?? ""
            }
          />
        )}
      </div>

      {/* Broadcast control REMOVED from this page (owner 2026-07-02): it now lives on the Live
          Overlays studio (/a/overlays/<eventId>) where the rest of the overlay management is, so it
          was redundant here. (The organizer leaderboard page keeps its copy until organizers get a
          studio of their own.) */}

      {/* Stage tabs */}
      {/* data-tour anchor (leaderboard-edit-stage-group): admin tour "Stage and group picker"
          step. Stage is these tabs; the group selector renders just below when a stage has
          more than one group. */}
      <Tabs
        value={selectedStageId}
        onValueChange={setSelectedStageId}
        data-tour="leaderboard-edit-stage-group"
      >
        <ScrollableTabsList className="w-full justify-start">
          {eventData?.stages?.map((s: any) => (
            <TabsTrigger key={s.stage_id} value={s.stage_id.toString()}>
              {s.stage_name}
            </TabsTrigger>
          ))}
        </ScrollableTabsList>
      </Tabs>

      {/* CS bracket note (P1#3): the selected stage is a Clash Squad bracket, so the BR editor
          below does not apply. Send the admin to the bracket on the event page instead. */}
      {isCsStage && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <IconTrophy className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">This stage runs as a Clash Squad bracket</p>
                <p className="text-sm text-muted-foreground">
                  Clash Squad results and standings are managed from the bracket on the event page,
                  not from this Battle Royale editor.
                </p>
              </div>
            </div>
            {eventSlug && (
              <Button asChild size="sm" className="shrink-0">
                <Link href={`/a/events/${eventSlug}`}>
                  <IconTrophy className="size-4" /> Go to the bracket
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Group selector */}
      {!isCsStage && currentStage?.groups?.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="shrink-0">
            <IconUsers size={14} className="inline mr-1" />
            Group:
          </Label>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Group" />
            </SelectTrigger>
            <SelectContent>
              {currentStage.groups.map((g: any) => (
                <SelectItem key={g.group_id} value={g.group_id.toString()}>
                  {g.group_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Edit sections */}
      {/* data-tour anchor (leaderboard-edit-match): admin tour "Edit individual match" step.
          These tabs are where one match's results, totals, scoring and uploads are re-entered.
          Hidden for CS stages (P1#3) - a bracket has no per-map BR grid/upload/scoring. */}
      {!isCsStage && (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Flagging gets its OWN tab for team events (owner 2026-06-30) so the admin no longer scrolls
            past the whole standings to reach the flagged-kills / unmatched-team controls. */}
        <TabsList
          data-tour="leaderboard-edit-match"
          className={`grid w-full ${participantType === "solo" ? "grid-cols-6" : "grid-cols-8"}`}
        >
          <TabsTrigger value="matches">
            <IconMap size={14} className="mr-1" />
            Match Results
          </TabsTrigger>
          <TabsTrigger value="total">
            <IconTrophy size={14} className="mr-1" />
            Total Leaderboard
          </TabsTrigger>
          {/* Combined (owner 2026-07-06): merge team standings across ANY stages/groups. Team-only
              (the aggregator is team-scoped); mirrors the public "Combined" tab. */}
          {participantType !== "solo" && (
            <TabsTrigger value="combined">
              <IconLayersSubtract size={14} className="mr-1" />
              Combined
            </TabsTrigger>
          )}
          <TabsTrigger value="scoring">
            <IconSettings size={14} className="mr-1" />
            Scoring Config
          </TabsTrigger>
          <TabsTrigger value="upload">
            <IconUpload size={14} className="mr-1" />
            Upload Results
          </TabsTrigger>
          {participantType !== "solo" && (
            <TabsTrigger value="flagging">
              <IconFlag size={14} className="mr-1" />
              Flagging
            </TabsTrigger>
          )}
          {/* MVPs (owner 2026-07-02): event-wide MVP by arranged criteria; see MvpTab. */}
          <TabsTrigger value="mvp" data-tour="leaderboard-mvp-tab">
            <IconTrophy size={14} className="mr-1" />
            MVPs
          </TabsTrigger>
          {/* Top Killers (owner 2026-07-05, complaint H): players ranked by summed kills; see TopKillersTab. */}
          <TabsTrigger value="top_killers">
            <IconTrophy size={14} className="mr-1" />
            Top Killers
          </TabsTrigger>
        </TabsList>

        {/* ── Combined Tab (team-only): merge team standings across chosen stages/groups (or the
            whole event) into one aggregate board. Self-contained (own picker + fetch), reused
            verbatim from the public tournament page so numbers match the OBS overlay + public view. ── */}
        {participantType !== "solo" && (
          <TabsContent value="combined" className="mt-4">
            <CombinedStandings
              eventId={Number(id)}
              stages={eventData?.stages ?? []}
              participantType={participantType}
              // Omit resultsPublished so the editor always shows the picker; the backend's authed
              // bypass returns numbers even before the event is published.
            />
          </TabsContent>
        )}

        {/* ── MVPs Tab: event-scoped; the scope bar can COMBINE across selected stages/groups. ── */}
        <TabsContent value="mvp" className="mt-4">
          <MvpTab eventId={id} organizationId={eventData?.organization_id ?? null} />
        </TabsContent>

        {/* ── Top Killers Tab: event-scoped players by summed kills (same combine + download bar). ── */}
        <TabsContent value="top_killers" className="mt-4">
          <TopKillersTab eventId={id} organizationId={eventData?.organization_id ?? null} />
        </TabsContent>

        {/* ── Match Results Tab ── */}
        <TabsContent value="matches" className="mt-4 space-y-4">
          {/* The Match Results grid is now a shared component (components/leaderboards/
              MatchResultsGrid.tsx) so the organizer leaderboard editor renders the SAME grid.
              This page still owns the editing state (selectedMatchId / editRows / playerGroups are
              shared with the Total Leaderboard + Scoring tabs), so the grid is fully controlled by
              the props below. Passing no `labels` renders the exact English this tab always shipped;
              the two data-tour anchors keep the admin tour steps working. Zero behaviour change. */}
          <MatchResultsGrid
            participantType={participantType}
            groupMatches={groupMatches}
            selectedMatchId={selectedMatchId}
            onSelectMatch={setSelectedMatchId}
            currentRows={currentRows}
            currentPlayerGroups={currentPlayerGroups}
            matchLeaderboard={matchLeaderboard}
            expandedTeams={expandedTeams}
            onToggleTeam={toggleTeam}
            onUpdateRow={updateRow}
            onUpdatePlayerRow={updatePlayerRow}
            isEntityWatched={isEntityWatched}
            watchedTeamIds={watched.teamIds}
            watchedPlayerIds={watched.playerIds}
            canAddPlayer
            onOpenAddPlayer={openAddPlayer}
            onSaveMatch={handleSaveMatch}
            savingMatch={savingMatch}
            onSaveAllMaps={handleSaveAllMaps}
            savingAllMaps={savingAllMaps}
            groupMatchCount={groupMatchIds.length}
            onRedoMap={handleRedoMap}
            redoingMap={redoingMap}
            onRedoAllMaps={handleRedoAllMaps}
            redoingAllMaps={redoingAllMaps}
            dataTourMatchList="leaderboard-edit-match-list"
            dataTourSave="leaderboard-edit-save"
          />
          {/* Stored evidence for the selected map: the retained .log result file(s) + OCR/manual
              screenshots, so a disputed result can be re-checked later (owner 2026-07-07). Renders
              nothing when the map has no stored files. Admin = English defaults + full manage. */}
          <div className="mt-4">
            <MatchEvidencePanel matchId={selectedMatchId} token={token} canManage />
          </div>
        </TabsContent>

        {/* ── Total Leaderboard Tab ── */}
        <TabsContent value="total" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Leaderboard</CardTitle>
              <CardDescription>
                Apply point adjustments to the overall standings. Positive
                values add bonus points; negative values add penalty points to
                the first map.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedOverall.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No leaderboard data yet.
                </p>
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>
                            {participantType === "team" ? "Team" : "Player"}
                          </TableHead>
                          <TableHead className="text-right">Booyahs</TableHead>
                          <TableHead className="text-right">Kills</TableHead>
                          {/* Place Pts: the summed placement points behind the total. Always shown
                              (renders 0 when none), so organizers can see the placement contribution
                              at a glance, not just the combined Total Pts. (owner 2026-06-15) */}
                          <TableHead className="text-right">
                            Place Pts
                          </TableHead>
                          <TableHead className="text-right">
                            Total Pts
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedOverall.map((entry, idx) => {
                          const entityId = getEntityId(entry);
                          const adj = adjustments[entityId] ?? 0;
                          const displayTotal = (
                            entry.effective_total + adj
                          ).toFixed(1);
                          return (
                            <TableRow key={entityId || idx}>
                              <TableCell className="text-muted-foreground">
                                #{idx + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                <span className="inline-flex items-center gap-2">
                                  {/* Flag beside the team name (team's country; solo -> none). */}
                                  <CountryFlag country={entry.team_country} />
                                  {getEntityName(entry)}
                                  {/* Advisory watchlist flag (entityId is team in team mode, player in solo). */}
                                  {isEntityWatched(entityId) && (
                                    <WatchTag reason="On the advisory watchlist" />
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.total_booyah}
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.total_kills}
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.placement_sum ?? 0}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {entry.effective_total.toFixed(1)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveAdjustments}
                      disabled={
                        savingAdjust ||
                        Object.values(adjustments).every((v) => v === 0)
                      }
                    >
                      {savingAdjust ? (
                        <span className="flex items-center gap-2">
                          <IconLoader2 size={14} className="animate-spin" />
                          Saving…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <IconDeviceFloppy size={14} />
                          Save Adjustments
                        </span>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Scoring Config Tab ── */}
        <TabsContent value="scoring" className="mt-4 space-y-4">
          {/* Tie-breakers (owner 2026-07-02): how EQUAL-POINT teams are ordered. Scope follows the
              stage tabs + group picker above (this stage / this group), or the whole event. */}
          <TieBreakersPanel
            eventId={id}
            stageId={selectedStageId}
            stageName={currentStage?.stage_name}
            groupId={selectedGroupId}
            groupName={currentGroup?.group_name}
          />
          {/* Per-match scoring editor + "Apply to..." fan-out, now a shared component reused by
              the organizer leaderboard page. Controlled by this page's shared selectedMatchId so
              the Scoring tab tracks the Match Results / Upload tabs; onScoringSaved re-saves the
              map's results after a scoring save so the stored points recompute (unchanged). */}
          <ScoringConfigPanel
            stages={eventData?.stages ?? []}
            groupMatches={groupMatches}
            token={token}
            apiBase={env.NEXT_PUBLIC_BACKEND_API_URL}
            selectedMatchId={selectedMatchId}
            onSelectMatch={setSelectedMatchId}
            onScoringSaved={handleSaveMatch}
          />
        </TabsContent>

        {/* ── Upload Results Tab ── */}
        <TabsContent value="upload" className="mt-4 space-y-4">
          {/* Debugger-log rich-stat backfill (owner 2026-07-02): event-wide, so it lists EVERY
              stage/group/match as a mapping target, not just the selected group. */}
          <DebuggerBackfillPanel
            eventId={id}
            matchOptions={(eventData?.stages ?? []).flatMap((st: any) =>
              (st.groups ?? []).flatMap((g: any) =>
                (g.matches ?? []).map((m: any) => ({
                  match_id: m.match_id,
                  label: `${st.stage_name} · ${g.group_name} · Match ${m.match_number} (${m.match_map || "-"})`,
                })),
              ),
            )}
          />
          {groupMatches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No matches found for this group.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Bulk: upload screenshots for several maps at once (this group). */}
              <GroupBulkUploadPanel
                matches={groupMatches.map((m) => ({
                  match_id: m.match_id,
                  match_number: m.match_number,
                  match_map: m.match_map,
                }))}
                groupName={currentGroup?.group_name}
                apiBase={env.NEXT_PUBLIC_BACKEND_API_URL}
                token={token}
                onComplete={fetchData}
              />

              {/* Bulk: upload every map's match-LOG / 3D-room file at once for this group,
                  assign each file to a map, review, then apply (owner 2026-06-29 - parity with
                  the leaderboard view page). Works for team + solo (participantType picks the
                  endpoint). */}
              <div className="flex justify-end">
                <MultiMapLogUpload
                  matches={groupMatches.map((m) => ({
                    match_id: m.match_id,
                    match_number: m.match_number,
                    match_map: m.match_map,
                  }))}
                  token={token}
                  participantType={participantType}
                  onChanged={fetchData}
                />
              </div>

              {/* Or upload one map at a time (per-map drawer). */}
              <p className="text-xs font-medium text-muted-foreground pt-1">
                Or upload a single map:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groupMatches.map((m) => {
                  const done = (m as any).result_inputted ?? false;
                  return (
                    <Card key={m.match_id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            Match {m.match_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.match_map}
                          </p>
                        </div>
                        <Badge variant={done ? "default" : "secondary"}>
                          {done ? "Results Entered" : "Pending"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant={done ? "outline" : "default"}
                        onClick={() => handleOpenUpload(m)}
                      >
                        <IconUpload size={14} className="mr-1" />
                        {done ? "Re-upload Results" : "Upload Results"}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Flagging Tab (team events only) ── the per-player ringer flags + the unmatched-team
            attribution, in their own tab so they're one click away from the standings. */}
        {participantType !== "solo" && (
          <TabsContent value="flagging" className="mt-4 space-y-4">
            {eventData && (
              <>
                {/* Pending "decide later" captures from the desktop client (complaint D) sit above the
                    per-player ringer flags; the panel renders nothing when there are none. */}
                <PendingCapturesPanel
                  key={`pending-${flagRefreshKey}`}
                  eventId={id}
                  token={token}
                  canManage
                  onChanged={fetchData}
                />
                <FlaggedKillsPanel
                  key={flagRefreshKey}
                  eventId={id}
                  token={token}
                  canManage
                  onChanged={fetchData}
                  // Flagged players follow the stage/group being viewed (owner 2026-07-10); combine picker overrides.
                  selectedStageId={selectedStageId}
                  selectedGroupId={selectedGroupId}
                />
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
      )}

      {/* ── Upload Results Drawer ── */}
      <Sheet open={uploadDrawerOpen} onOpenChange={setUploadDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto p-0"
        >
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>
              {uploadingMatch?.match_name ?? "Upload Results"}
            </SheetTitle>
            <SheetDescription>
              Select an upload method for this match.
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-4">
            {uploadView === "method" && uploadingMatch && (
              <MatchMethodSelectionStep
                matchName={uploadingMatch.match_name}
                onSelect={(method) =>
                  setUploadView(
                    method as "manual" | "image_upload" | "room_file_upload",
                  )
                }
                onBack={() => setUploadDrawerOpen(false)}
              />
            )}

            {uploadView === "manual" && uploadingMatch && uploadFormData && (
              <ManualMatchResultStep
                match={uploadingMatch}
                formData={uploadFormData}
                participantTypeOverride={participantType}
                initialStats={
                  groupMatches.find(
                    (m) => m.match_id === uploadingMatch.match_id,
                  )?.stats ?? []
                }
                // Surface the ordered-entry banner only on Champion-Point stages.
                championPointEnabled={currentStage?.champion_point_enabled ?? false}
                onComplete={handleUploadComplete}
                onBack={() => setUploadView("method")}
              />
            )}

            {/* ── Image Upload = the OCR review mini-stepper ──────────────────
                Step 1 (no session yet): MapSelectionStep - pick which map this
                screenshot is for and upload it (POST /events/ocr-match-result/ via
                ocrApi.uploadOcrScreenshot). Step 2 (session ready): OCRReviewTable -
                edit + commit the auto-extracted rows (PATCH/commit on the session).
                On commit we run handleUploadComplete (close drawer + refresh, same as
                every other upload path). `maps` is this group's matches; the picked
                position is the 1-indexed map_index the backend expects.
                NOTE: the standalone ImageUploadStep (re-extract from an already-stored
                image) is still imported and available, but the primary screenshot ->
                review path is this stepper, so it is no longer mounted here. */}
            {uploadView === "image_upload" && uploadingMatch && !ocrSession && (
              <MapSelectionStep
                matchId={uploadingMatch.match_id}
                maps={(currentGroup?.matches ?? []).map((m: any) => ({
                  match_id: m.match_id,
                  match_number: m.match_number,
                  match_map: m.match_map,
                }))}
                onSessionReady={(sessionId, draftRows, engine) =>
                  setOcrSession({ sessionId, draftRows, engine })
                }
                onBack={() => setUploadView("method")}
              />
            )}

            {uploadView === "image_upload" && uploadingMatch && ocrSession && (
              <OCRReviewTable
                sessionId={ocrSession.sessionId}
                draftRows={ocrSession.draftRows}
                matchId={uploadingMatch.match_id}
                engine={ocrSession.engine}
                onCommitted={handleUploadComplete}
                onBack={() => setOcrSession(null)}
              />
            )}

            {uploadView === "room_file_upload" &&
              uploadingMatch &&
              uploadFormData && (
                <FileUploadStep
                  match={uploadingMatch}
                  formData={uploadFormData}
                  participantTypeOverride={participantType}
                  // Enables the "All maps at once" toggle on the 3D Room File step, scoped to this
                  // group's matches (owner 2026-06-29 - parity with the leaderboard view page).
                  groupMatches={currentGroup?.matches ?? []}
                  onAllMapsApplied={() => {
                    fetchData();
                    setFlagRefreshKey((k) => k + 1); // re-pull ringer flags after the upload
                    setUploadDrawerOpen(false);
                  }}
                  onNext={handleUploadComplete}
                  onBack={() => setUploadView("method")}
                />
              )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Add-player dialog (Roster Rules, owner 2026-06-15) ──────────────────
          Driven by openAddPlayer/handleAddPlayer. Lists eligible PLAYING-role team
          members not yet on the event roster; clicking one adds them via
          /events/add-player-to-event-roster/. Closes by clearing addPlayerTeam. */}
      <Dialog
        open={!!addPlayerTeam}
        onOpenChange={(o) => !o && setAddPlayerTeam(null)}
      >
        <DialogContent className="flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Add player to roster</DialogTitle>
            <DialogDescription>
              {addPlayerTeam
                ? `Add a player to ${addPlayerTeam.teamName} for this event.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-1">
            {loadingCandidates ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="animate-spin size-6 text-primary" />
              </div>
            ) : addPlayerCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No eligible players to add. Every playing member of this team is
                already on the roster.
              </p>
            ) : (
              addPlayerCandidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-xs font-medium">{c.username}</span>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    disabled={addingPlayerId !== null}
                    onClick={() => handleAddPlayer(c.id)}
                  >
                    {addingPlayerId === c.id ? (
                      <span className="flex items-center gap-2">
                        <IconLoader2 size={14} className="animate-spin" />
                        Adding...
                      </span>
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setAddPlayerTeam(null)}
              disabled={addingPlayerId !== null}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
