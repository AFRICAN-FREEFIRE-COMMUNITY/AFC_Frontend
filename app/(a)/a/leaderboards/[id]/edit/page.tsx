"use client";

import React, { useState, useEffect, use } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// MVPs tab (owner 2026-07-02): criteria-arranged event MVP. See _components/MvpTab.tsx.
import MvpTab from "@/app/(a)/a/leaderboards/_components/MvpTab";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  IconChevronDown,
  IconChevronRight,
  IconUpload,
  IconFlag,
  IconCopy,
  IconRefresh,
  IconUserPlus,
} from "@tabler/icons-react";
// Redo map (owner 2026-06-15): destructive confirm before wiping one map's results.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
// "Copy OBS overlay link" dialog (components/overlay/CopyOverlayLinkDialog.tsx): builds the public
// live-overlay URL for this event's leaderboard. Mounted beside the header so an admin can grab the
// OBS Browser Source link. Same component the organizer event leaderboard page mounts.
import { CopyOverlayLinkDialog } from "@/components/overlay/CopyOverlayLinkDialog";
// Broadcast control moved to the Live Overlays studio (owner 2026-07-02) — no longer mounted here.
import { toast } from "sonner";
// Shared advisory-watchlist badge + client (components/WatchTag.tsx, lib/watchlist.ts). One bulk
// watchlistApi.tags call (recomputed when the standings reload) marks which standings team_ids /
// player_ids are watched; <WatchTag> then renders next to those flagged names in the standings.
import { WatchTag } from "@/components/WatchTag";
import { watchlistApi } from "@/lib/watchlist";
import { ManualMatchResultStep } from "../../_components/ManualMatchResultStep";
import { MatchMethodSelectionStep } from "../../_components/MatchMethodSelectionStep";
import { FileUploadStep } from "../../_components/FileUploadStep";
// "Upload all maps (.log)" — multi-map match-log upload (per-file map pick + review + apply),
// mirroring the leaderboard view page so the edit page offers it too (owner 2026-06-29).
import { MultiMapLogUpload } from "../../_components/MultiMapLogUpload";
import { GroupBulkUploadPanel } from "../../_components/GroupBulkUploadPanel";
// Flagged-kills control (owner 2026-06-30): the "Count flagged players' kills" toggle + the per-player
// list. Previously only on the leaderboard VIEW page; the admin uploads results HERE on the edit page,
// so it must be reachable here too. Same component the view page mounts.
import { FlaggedKillsPanel } from "@/components/leaderboards/FlaggedKillsPanel";
// OCR review flow (Phase 1): pick a map + drop a screenshot (MapSelectionStep), then review +
// correct the auto-extracted rows (OCRReviewTable) and commit. Mounted in the Upload drawer below,
// in place of the old read-only ImageUploadStep preview. DraftRow types come from lib/api/ocr.ts.
import { MapSelectionStep } from "../../_components/MapSelectionStep";
import { OCRReviewTable } from "../../_components/OCRReviewTable";
import type { DraftRow } from "@/lib/api/ocr";

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

interface MatchScoringConfig {
  killPoint: string;
  pointsPerAssist: string;
  pointsPer1000Damage: string;
  ranks: { id: string; val: string }[];
}

interface OverallEntry {
  competitor_id?: number;
  tournament_team_id?: number;
  competitor__user__username?: string;
  team_name?: string;
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

interface EditRow {
  id: number;
  name: string;
  placement: number;
  kills: number;
  bonus_points: number;
  penalty_points: number;
  played: boolean;
}

interface PlayerEditRow {
  player_id: number;
  username: string;
  kills: number;
  damage: number;
  assists: number;
  played: boolean;
}

interface TeamPlayerGroup {
  teamId: number;
  teamName: string;
  players: PlayerEditRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statToEditRow(stat: RawStat): EditRow {
  return {
    id: stat.competitor_id ?? stat.tournament_team_id ?? 0,
    name: stat.username ?? stat.team_name ?? "-",
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

  // Per-match scoring config
  const [matchScoring, setMatchScoring] = useState<
    Record<number, MatchScoringConfig>
  >({});
  const [savingMatchScoring, setSavingMatchScoring] = useState(false);
  const [applyingToAll, setApplyingToAll] = useState(false);

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
      const data = await res.json();
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
          players: roster.members.map((mem) => {
            const sp = savedByUid.get(mem.player_id);
            return {
              player_id: mem.player_id,
              username: mem.username,
              kills: sp?.kills ?? 0,
              damage: sp?.damage ?? 0,
              assists: sp?.assists ?? 0,
              // Free Fire squad allows at most 4 PLAYED players per match — the backend
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

    // Per-match scoring config
    const initialMatchScoring: Record<number, MatchScoringConfig> = {};
    for (const m of groupMatches) {
      const s = m.scoring_settings;
      const placementPts = s?.placement_points ?? {};
      const rankEntries = Object.entries(placementPts)
        .map(([rank, val]) => ({ id: rank, val: String(val) }))
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));
      const minRanks = 10;
      const padded = [...rankEntries];
      for (let i = padded.length + 1; i <= minRanks; i++) {
        padded.push({ id: `new-${i}-${Date.now()}`, val: "0" });
      }
      initialMatchScoring[m.match_id] = {
        killPoint: s?.kill_point?.toString() ?? "1",
        pointsPerAssist: s?.points_per_assist?.toString() ?? "0",
        pointsPer1000Damage: s?.points_per_1000_damage?.toString() ?? "0",
        ranks: padded,
      };
    }
    setMatchScoring(initialMatchScoring);
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

  // Match ID lists for batch scoring apply
  const groupMatchIds = groupMatches.map((m) => m.match_id);
  const allMatchIds: number[] =
    eventData?.stages?.flatMap((s: any) =>
      (s.groups ?? []).flatMap((g: any) =>
        (g.matches ?? []).map((m: any) => m.match_id as number),
      ),
    ) ?? [];

  // ── Edit row helpers ─────────────────────────────────────────────────────────

  const updateRow = (
    matchId: number,
    idx: number,
    field: keyof Omit<EditRow, "id" | "name">,
    value: number | boolean,
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
    value: number | boolean,
  ) => {
    setPlayerGroups((prev) => {
      const groups = (prev[matchId] ?? []).map((g, ti) => {
        if (ti !== teamIdx) return g;
        const players = g.players.map((p, pi) => {
          if (pi !== playerIdx) return p;
          const next = { ...p, [field]: value };
          // Entering any stat for a player implies they played (a player who did not play
          // has no stats), so auto-tick "Played". This stops the save from silently dropping
          // a player whose kills were typed while "Played" was left unticked — the save only
          // sends played=true players to respect the 4-per-squad cap. (bug fix 2026-06-15)
          if (field !== "played" && typeof value === "number" && value > 0) {
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

    if (participantType === "solo") {
      return {
        endpoint: `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-solo-match-result/`,
        body: {
          match_id: matchId.toString(),
          rows: rows.map((r) => ({
            competitor_id: r.id,
            placement: r.placement,
            kills: r.kills,
            played: r.played,
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
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
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
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
                kills: p.kills,
                damage: p.damage,
                assists: p.assists,
                played: true,
              })),
          };
        }),
      },
    };
  };

  // POST one map's results. Throws on a non-OK response so callers (single + bulk) can
  // count successes/failures uniformly.
  const saveMatchById = async (matchId: number): Promise<void> => {
    const req = buildMatchSaveRequest(matchId);
    if (!req) return; // nothing entered for this map -> skip (not an error)
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

  // ── Save ALL maps of the current group at once ───────────────────────────────
  // The user asked to edit a whole group in one go instead of map-by-map. Every map's
  // rows are already in editRows/playerGroups (loaded by the group-change effect), so
  // this fans out one per-map save per map via Promise.allSettled (same idiom as
  // handleApplyScoringToMatches), reports an "X of Y saved" summary, and refreshes once.
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
        // Only resync from the server when everything saved — see note above.
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
      const data = await res.json();
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
      const data = await res.json();
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

    setSavingAdjust(true);
    try {
      const firstMatchRows = editRows[firstMatchId] ?? [];
      const updatedRows = firstMatchRows.map((row) => {
        const adj = adjustments[row.id] ?? 0;
        return {
          ...row,
          bonus_points: Math.max(0, row.bonus_points + (adj > 0 ? adj : 0)),
          penalty_points: Math.max(
            0,
            row.penalty_points + (adj < 0 ? Math.abs(adj) : 0),
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
            kills: r.kills,
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
                kills: p.kills,
                damage: p.damage,
                assists: p.assists,
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

  // ── Save match scoring config ────────────────────────────────────────────────

  const handleSaveMatchScoring = async () => {
    if (selectedMatchId === null) return;
    const config = matchScoring[selectedMatchId];
    if (!config) return;

    setSavingMatchScoring(true);
    try {
      const placementPointsObj: Record<string, number> = {};
      config.ranks.forEach((r, idx) => {
        placementPointsObj[(idx + 1).toString()] = parseFloat(r.val) || 0;
      });

      const body = {
        match_id: selectedMatchId,
        scoring_settings: {
          kill_point: parseFloat(config.killPoint) || 0,
          placement_points: placementPointsObj,
          points_per_assist: parseFloat(config.pointsPerAssist) || 0,
          points_per_1000_damage: parseFloat(config.pointsPer1000Damage) || 0,
        },
      };

      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-scoring-config/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.detail || "Update failed");
      }

      toast.success("Match scoring configuration updated!");
      // Re-save match results immediately so points are recalculated
      await handleSaveMatch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update scoring");
    } finally {
      setSavingMatchScoring(false);
    }
  };

  // ── Apply scoring config to multiple matches ─────────────────────────────────

  const handleApplyScoringToMatches = async (
    matchIds: number[],
    label: string,
  ) => {
    if (selectedMatchId === null) return;
    const config = matchScoring[selectedMatchId];
    if (!config) return;

    const placementPointsObj: Record<string, number> = {};
    config.ranks.forEach((r, idx) => {
      placementPointsObj[(idx + 1).toString()] = parseFloat(r.val) || 0;
    });

    const scoringSettings = {
      kill_point: parseFloat(config.killPoint) || 0,
      placement_points: placementPointsObj,
      points_per_assist: parseFloat(config.pointsPerAssist) || 0,
      points_per_1000_damage: parseFloat(config.pointsPer1000Damage) || 0,
    };

    setApplyingToAll(true);
    try {
      const results = await Promise.allSettled(
        matchIds.map((matchId) =>
          fetch(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-scoring-config/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                match_id: matchId,
                scoring_settings: scoringSettings,
              }),
            },
          ),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected").length;

      // Update local state for any matches already loaded in the current group
      setMatchScoring((prev) => {
        const updated = { ...prev };
        for (const matchId of matchIds) {
          if (matchId in updated) {
            updated[matchId] = {
              killPoint: config.killPoint,
              pointsPerAssist: config.pointsPerAssist,
              pointsPer1000Damage: config.pointsPer1000Damage,
              ranks: config.ranks.map((r) => ({ ...r })),
            };
          }
        }
        return updated;
      });

      if (failed > 0) {
        toast.warning(
          `Applied to ${matchIds.length - failed} match${matchIds.length - failed !== 1 ? "es" : ""}. ${failed} failed.`,
        );
      } else {
        toast.success(
          `Scoring applied to ${matchIds.length} match${matchIds.length !== 1 ? "es" : ""} - ${label}!`,
        );
      }
    } catch {
      toast.error("Failed to apply scoring configuration");
    } finally {
      setApplyingToAll(false);
    }
  };

  // ── Match scoring config helpers ─────────────────────────────────────────────

  const updateMatchScoringField = (
    matchId: number,
    field: keyof Omit<MatchScoringConfig, "ranks">,
    value: string,
  ) => {
    setMatchScoring((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value },
    }));
  };

  const updateMatchScoringRank = (
    matchId: number,
    rankIdx: number,
    val: string,
  ) => {
    setMatchScoring((prev) => {
      const config = prev[matchId];
      if (!config) return prev;
      const ranks = config.ranks.map((r, i) =>
        i === rankIdx ? { ...r, val } : r,
      );
      return { ...prev, [matchId]: { ...config, ranks } };
    });
  };

  const addMatchScoringRank = (matchId: number) => {
    setMatchScoring((prev) => {
      const config = prev[matchId];
      if (!config) return prev;
      return {
        ...prev,
        [matchId]: {
          ...config,
          ranks: [...config.ranks, { id: `add-${Date.now()}`, val: "0" }],
        },
      };
    });
  };

  const removeMatchScoringRank = (matchId: number, rankIdx: number) => {
    setMatchScoring((prev) => {
      const config = prev[matchId];
      if (!config) return prev;
      return {
        ...prev,
        [matchId]: {
          ...config,
          ranks: config.ranks.filter((_, i) => i !== rankIdx),
        },
      };
    });
  };

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
        {/* Overlay link picker. organizationId is null here (AFC admin surface uses the AFC-native
            design library, same as this page's LeaderboardDesignsManager). Defaults to the currently
            selected stage/group; the dialog lets the admin re-pick any stage/group. */}
        {eventData && (
          <CopyOverlayLinkDialog
            eventId={id}
            stageId={selectedStageId}
            groupId={selectedGroupId}
            stages={eventData?.stages ?? []}
            organizationId={null}
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
        <ScrollArea>
          <TabsList className="w-full justify-start">
            {eventData?.stages?.map((s: any) => (
              <TabsTrigger key={s.stage_id} value={s.stage_id.toString()}>
                {s.stage_name}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Tabs>

      {/* Group selector */}
      {currentStage?.groups?.length > 1 && (
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
          These tabs are where one match's results, totals, scoring and uploads are re-entered. */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Flagging gets its OWN tab for team events (owner 2026-06-30) so the admin no longer scrolls
            past the whole standings to reach the flagged-kills / unmatched-team controls. */}
        <TabsList
          data-tour="leaderboard-edit-match"
          className={`grid w-full ${participantType === "solo" ? "grid-cols-5" : "grid-cols-6"}`}
        >
          <TabsTrigger value="matches">
            <IconMap size={14} className="mr-1" />
            Match Results
          </TabsTrigger>
          <TabsTrigger value="total">
            <IconTrophy size={14} className="mr-1" />
            Total Leaderboard
          </TabsTrigger>
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
        </TabsList>

        {/* ── MVPs Tab: event-scoped (ignores the stage/group pickers above). ── */}
        <TabsContent value="mvp" className="mt-4">
          <MvpTab eventId={id} />
        </TabsContent>

        {/* ── Match Results Tab ── */}
        <TabsContent value="matches" className="mt-4 space-y-4">
          {groupMatches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No matches found for this group.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Map selector */}
              {/* data-tour anchor (leaderboard-edit-match-list): admin tour "Match list" step.
                  Every map in the selected group renders as a button; click one to load its
                  editable results below. */}
              <div data-tour="leaderboard-edit-match-list" className="flex gap-2 flex-wrap">
                {groupMatches.map((m) => (
                  <Button
                    key={m.match_id}
                    variant={
                      selectedMatchId === m.match_id ? "default" : "secondary"
                    }
                    size="sm"
                    onClick={() => setSelectedMatchId(m.match_id)}
                  >
                    {m.match_map}
                  </Button>
                ))}
              </div>

              {selectedMatchId !== null && currentRows.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    No results have been entered for this map yet.
                  </CardContent>
                </Card>
              )}

              {selectedMatchId !== null && currentRows.length > 0 && (
                <>
                  {/* ── Team / Solo placement table ── */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {participantType === "team"
                          ? "Team Placements"
                          : "Player Results"}
                      </CardTitle>
                      <CardDescription>
                        {participantType === "team"
                          ? "Edit team placement and participation for this map."
                          : "Edit placement, kills, and bonus/penalty points."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                {participantType === "team" ? "Team" : "Player"}
                              </TableHead>
                              <TableHead className="w-28">Placement</TableHead>
                              {participantType === "solo" && (
                                <TableHead className="w-28">Kills</TableHead>
                              )}
                              {participantType === "solo" && (
                                <TableHead className="w-28">
                                  Bonus Pts
                                </TableHead>
                              )}
                              {participantType === "solo" && (
                                <TableHead className="w-28">
                                  Penalty Pts
                                </TableHead>
                              )}
                              <TableHead className="w-20 text-center">
                                Played
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentRows.map((row, idx) => (
                              <TableRow key={row.id}>
                                <TableCell className="font-medium">
                                  <span className="inline-flex items-center gap-2">
                                    {row.name}
                                    {/* Advisory watchlist flag (team in team mode, player in solo). */}
                                    {isEntityWatched(row.id) && (
                                      <WatchTag reason="On the advisory watchlist" />
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    className="h-8 w-24"
                                    value={row.placement || ""}
                                    onChange={(e) =>
                                      updateRow(
                                        selectedMatchId,
                                        idx,
                                        "placement",
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                  />
                                </TableCell>
                                {participantType === "solo" && (
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min="0"
                                      className="h-8 w-24"
                                      value={row.kills || ""}
                                      onChange={(e) =>
                                        updateRow(
                                          selectedMatchId,
                                          idx,
                                          "kills",
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                    />
                                  </TableCell>
                                )}
                                {participantType === "solo" && (
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min="0"
                                      className="h-8 w-24"
                                      value={row.bonus_points || ""}
                                      onChange={(e) =>
                                        updateRow(
                                          selectedMatchId,
                                          idx,
                                          "bonus_points",
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                    />
                                  </TableCell>
                                )}
                                {participantType === "solo" && (
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min="0"
                                      className="h-8 w-24"
                                      value={row.penalty_points || ""}
                                      onChange={(e) =>
                                        updateRow(
                                          selectedMatchId,
                                          idx,
                                          "penalty_points",
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                    />
                                  </TableCell>
                                )}
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={row.played}
                                    onCheckedChange={(v) =>
                                      updateRow(
                                        selectedMatchId,
                                        idx,
                                        "played",
                                        !!v,
                                      )
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Player Stats (team mode only) ── */}
                  {participantType === "team" &&
                    currentPlayerGroups.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Player Stats
                          </CardTitle>
                          <CardDescription>
                            Edit individual player kills, damage, and assists
                            for each team. Click a team to expand.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {currentPlayerGroups.map((group, teamIdx) => {
                            const key = `${selectedMatchId}-${group.teamId}`;
                            const isExpanded = expandedTeams[key] ?? false;
                            return (
                              <div
                                key={group.teamId}
                                className="border rounded-lg overflow-hidden"
                              >
                                {/* Team header */}
                                <button
                                  onClick={() => toggleTeam(key)}
                                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <IconChevronDown
                                        size={16}
                                        className="text-muted-foreground"
                                      />
                                    ) : (
                                      <IconChevronRight
                                        size={16}
                                        className="text-muted-foreground"
                                      />
                                    )}
                                    <span className="font-medium text-sm inline-flex items-center gap-2">
                                      {group.teamName}
                                      {/* Advisory watchlist flag for this team. */}
                                      {watched.teamIds.has(group.teamId) && (
                                        <WatchTag reason="On the advisory watchlist" />
                                      )}
                                    </span>
                                  </div>
                                  <Badge variant="secondary">
                                    {group.players.length} player
                                    {group.players.length !== 1 ? "s" : ""}
                                  </Badge>
                                </button>

                                {/* Player rows */}
                                {isExpanded && (
                                  <div className="border-t">
                                    {group.players.length === 0 ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        No player data available for this team.
                                      </p>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Player</TableHead>
                                            <TableHead className="w-28">
                                              Kills
                                            </TableHead>
                                            <TableHead className="w-28">
                                              Damage
                                            </TableHead>
                                            <TableHead className="w-28">
                                              Assists
                                            </TableHead>
                                            <TableHead className="w-20 text-center">
                                              Played
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {group.players.map(
                                            (player, playerIdx) => (
                                              <TableRow key={player.player_id}>
                                                <TableCell className="font-medium">
                                                  <span className="inline-flex items-center gap-2">
                                                    {player.username}
                                                    {/* Advisory watchlist flag for this player. */}
                                                    {watched.playerIds.has(
                                                      player.player_id,
                                                    ) && (
                                                      <WatchTag reason="On the advisory watchlist" />
                                                    )}
                                                  </span>
                                                </TableCell>
                                                <TableCell>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    className="h-8 w-24"
                                                    value={player.kills || ""}
                                                    onChange={(e) =>
                                                      updatePlayerRow(
                                                        selectedMatchId,
                                                        teamIdx,
                                                        playerIdx,
                                                        "kills",
                                                        parseInt(
                                                          e.target.value,
                                                        ) || 0,
                                                      )
                                                    }
                                                  />
                                                </TableCell>
                                                <TableCell>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    className="h-8 w-24"
                                                    value={player.damage || ""}
                                                    onChange={(e) =>
                                                      updatePlayerRow(
                                                        selectedMatchId,
                                                        teamIdx,
                                                        playerIdx,
                                                        "damage",
                                                        parseInt(
                                                          e.target.value,
                                                        ) || 0,
                                                      )
                                                    }
                                                  />
                                                </TableCell>
                                                <TableCell>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    className="h-8 w-24"
                                                    value={player.assists || ""}
                                                    onChange={(e) =>
                                                      updatePlayerRow(
                                                        selectedMatchId,
                                                        teamIdx,
                                                        playerIdx,
                                                        "assists",
                                                        parseInt(
                                                          e.target.value,
                                                        ) || 0,
                                                      )
                                                    }
                                                  />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                  <Checkbox
                                                    checked={player.played}
                                                    onCheckedChange={(v) =>
                                                      updatePlayerRow(
                                                        selectedMatchId,
                                                        teamIdx,
                                                        playerIdx,
                                                        "played",
                                                        !!v,
                                                      )
                                                    }
                                                  />
                                                </TableCell>
                                              </TableRow>
                                            ),
                                          )}
                                        </TableBody>
                                      </Table>
                                    )}

                                    {/* ── Add player to event roster (Roster Rules,
                                        owner 2026-06-15) ── per-team picker of PLAYING-role
                                        members not yet rostered; adds via
                                        /events/add-player-to-event-roster/ then refetches. */}
                                    <div className="px-4 py-3 border-t">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() =>
                                          openAddPlayer(
                                            group.teamId,
                                            group.teamName,
                                          )
                                        }
                                      >
                                        <IconUserPlus size={14} className="mr-1" />
                                        Add player
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )}

                  {/* ── Match Leaderboard ── */}
                  {matchLeaderboard.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Match Leaderboard
                        </CardTitle>
                        <CardDescription>
                          Calculated standings for this map. Edit bonus and
                          penalty points, then save above.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-14">Rank</TableHead>
                                <TableHead>
                                  {participantType === "team"
                                    ? "Team"
                                    : "Player"}
                                </TableHead>
                                <TableHead className="text-right w-24">
                                  Placement
                                </TableHead>
                                <TableHead className="text-right w-24">
                                  Place Pts
                                </TableHead>
                                <TableHead className="text-right w-24">
                                  Kill Pts
                                </TableHead>
                                <TableHead className="w-28">Bonus</TableHead>
                                <TableHead className="w-28">Penalty</TableHead>
                                <TableHead className="text-right w-24">
                                  Total
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {matchLeaderboard.map((stat, idx) => {
                                const statId =
                                  stat.competitor_id ??
                                  stat.tournament_team_id ??
                                  0;
                                const editIdx = currentRows.findIndex(
                                  (r) => r.id === statId,
                                );
                                const editRow =
                                  editIdx >= 0
                                    ? currentRows[editIdx]
                                    : undefined;
                                const bonus =
                                  editRow?.bonus_points ?? stat.bonus_points;
                                const penalty =
                                  editRow?.penalty_points ??
                                  stat.penalty_points;
                                const liveTotal =
                                  stat.placement_points +
                                  stat.kill_points +
                                  bonus -
                                  penalty;
                                return (
                                  <TableRow key={statId || idx}>
                                    <TableCell className="text-muted-foreground font-medium">
                                      #{idx + 1}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <span className="inline-flex items-center gap-2">
                                        {stat.username ?? stat.team_name ?? "-"}
                                        {/* Advisory watchlist flag (statId is team in team mode, player in solo). */}
                                        {isEntityWatched(statId) && (
                                          <WatchTag reason="On the advisory watchlist" />
                                        )}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {stat.placement}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {stat.placement_points}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {stat.kill_points}
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        className="h-8 w-24"
                                        value={bonus || ""}
                                        disabled={editIdx < 0}
                                        onChange={(e) =>
                                          updateRow(
                                            selectedMatchId,
                                            editIdx,
                                            "bonus_points",
                                            parseInt(e.target.value) || 0,
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="0"
                                        className="h-8 w-24"
                                        value={penalty || ""}
                                        disabled={editIdx < 0}
                                        onChange={(e) =>
                                          updateRow(
                                            selectedMatchId,
                                            editIdx,
                                            "penalty_points",
                                            parseInt(e.target.value) || 0,
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-primary">
                                      {liveTotal.toFixed(1)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Save buttons: this map only, or every map in the group at once.
                      "Save all maps" fans out one save per map (handleSaveAllMaps). */}
                  {/* data-tour anchor (leaderboard-edit-save): admin tour "Save changes" step. */}
                  <div data-tour="leaderboard-edit-save" className="flex flex-wrap justify-end gap-2">
                    {/* Redo this map (owner 2026-06-15): clears ONLY the selected map's
                        results so it can be re-entered. Destructive -> AlertDialog confirm.
                        Calls handleRedoMap -> POST /events/clear-match-result/. */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="mr-auto"
                          disabled={redoingMap || savingMatch || savingAllMaps}
                        >
                          {redoingMap ? (
                            <span className="flex items-center gap-2">
                              <IconLoader2 size={14} className="animate-spin" />
                              Clearing…
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <IconRefresh size={14} />
                              Redo this map
                            </span>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Redo this map?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This clears all results for this map. Other maps are not
                            affected. You can then re-enter the results.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRedoMap}>
                            Redo map
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="outline"
                      onClick={handleSaveAllMaps}
                      disabled={savingAllMaps || savingMatch}
                    >
                      {savingAllMaps ? (
                        <span className="flex items-center gap-2">
                          <IconLoader2 size={14} className="animate-spin" />
                          Saving all maps…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <IconDeviceFloppy size={14} />
                          Save all maps ({groupMatchIds.length})
                        </span>
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveMatch}
                      disabled={savingMatch || savingAllMaps}
                    >
                      {savingMatch ? (
                        <span className="flex items-center gap-2">
                          <IconLoader2 size={14} className="animate-spin" />
                          Saving…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <IconDeviceFloppy size={14} />
                          Save this map
                        </span>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
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
          {groupMatches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No matches found for this group.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Match selector */}
              <div className="flex gap-2 flex-wrap">
                {groupMatches.map((m) => (
                  <Button
                    key={m.match_id}
                    variant={
                      selectedMatchId === m.match_id ? "default" : "secondary"
                    }
                    size="sm"
                    onClick={() => setSelectedMatchId(m.match_id)}
                  >
                    {m.match_map}
                  </Button>
                ))}
              </div>

              {selectedMatchId !== null &&
                (() => {
                  const config = matchScoring[selectedMatchId];
                  if (!config) return null;
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Scoring Configuration
                        </CardTitle>
                        <CardDescription>
                          Edit scoring for{" "}
                          {
                            groupMatches.find(
                              (m) => m.match_id === selectedMatchId,
                            )?.match_map
                          }{" "}
                          - Match{" "}
                          {
                            groupMatches.find(
                              (m) => m.match_id === selectedMatchId,
                            )?.match_number
                          }
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Scalar fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
                          <div className="space-y-2">
                            <Label>Kill Point</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={config.killPoint}
                              onChange={(e) =>
                                updateMatchScoringField(
                                  selectedMatchId,
                                  "killPoint",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Pts / Assist</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={config.pointsPerAssist}
                              onChange={(e) =>
                                updateMatchScoringField(
                                  selectedMatchId,
                                  "pointsPerAssist",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Pts / 1000 Dmg</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={config.pointsPer1000Damage}
                              onChange={(e) =>
                                updateMatchScoringField(
                                  selectedMatchId,
                                  "pointsPer1000Damage",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Placement points */}
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <Label>Placement Points</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                addMatchScoringRank(selectedMatchId)
                              }
                            >
                              <IconPlus size={12} className="mr-1" /> Add Rank
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {config.ranks.map((r, i) => (
                              <Card
                                key={r.id}
                                className="py-1 group relative border"
                              >
                                <CardContent className="p-2">
                                  <div className="flex justify-between items-center mb-1">
                                    <Label className="text-xs text-muted-foreground">
                                      Rank {i + 1}
                                    </Label>
                                    {config.ranks.length > 10 && (
                                      <button
                                        onClick={() =>
                                          removeMatchScoringRank(
                                            selectedMatchId,
                                            i,
                                          )
                                        }
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                      >
                                        <IconX size={10} />
                                      </button>
                                    )}
                                  </div>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={r.val}
                                    onChange={(e) =>
                                      updateMatchScoringRank(
                                        selectedMatchId,
                                        i,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8"
                                  />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          {/* Apply to multiple matches */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={applyingToAll || savingMatchScoring}
                              >
                                {applyingToAll ? (
                                  <span className="flex items-center gap-2">
                                    <IconLoader2 size={14} className="animate-spin" />
                                    Applying…
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <IconCopy size={14} />
                                    Apply to…
                                    <IconChevronDown size={12} />
                                  </span>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto">
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                Copy current config to…
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* Current group - quick access */}
                              <DropdownMenuItem
                                onClick={() =>
                                  handleApplyScoringToMatches(
                                    groupMatchIds,
                                    `this group`,
                                  )
                                }
                              >
                                <IconMap size={14} className="mr-2 text-muted-foreground" />
                                This group
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {groupMatchIds.length} match{groupMatchIds.length !== 1 ? "es" : ""}
                                </span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* Dynamic: every stage + each of its groups */}
                              {(eventData?.stages ?? []).map((stage: any) => {
                                const stageIds: number[] =
                                  (stage.groups ?? []).flatMap((g: any) =>
                                    (g.matches ?? []).map((m: any) => m.match_id as number),
                                  );
                                return (
                                  <DropdownMenuGroup key={stage.stage_id}>
                                    {/* Stage row */}
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleApplyScoringToMatches(
                                          stageIds,
                                          stage.stage_name,
                                        )
                                      }
                                    >
                                      <IconTrophy size={14} className="mr-2 text-muted-foreground" />
                                      <span className="font-medium">{stage.stage_name}</span>
                                      <span className="ml-auto text-xs text-muted-foreground">
                                        {stageIds.length} match{stageIds.length !== 1 ? "es" : ""}
                                      </span>
                                    </DropdownMenuItem>

                                    {/* Group rows (indented) */}
                                    {(stage.groups ?? []).map((group: any) => {
                                      const groupIds: number[] = (group.matches ?? []).map(
                                        (m: any) => m.match_id as number,
                                      );
                                      return (
                                        <DropdownMenuItem
                                          key={group.group_id}
                                          className="pl-8"
                                          onClick={() =>
                                            handleApplyScoringToMatches(
                                              groupIds,
                                              `${stage.stage_name} › ${group.group_name}`,
                                            )
                                          }
                                        >
                                          <IconUsers size={13} className="mr-2 text-muted-foreground" />
                                          {group.group_name}
                                          <span className="ml-auto text-xs text-muted-foreground">
                                            {groupIds.length} match{groupIds.length !== 1 ? "es" : ""}
                                          </span>
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </DropdownMenuGroup>
                                );
                              })}

                              <DropdownMenuSeparator />

                              {/* Entire event */}
                              <DropdownMenuItem
                                onClick={() =>
                                  handleApplyScoringToMatches(
                                    allMatchIds,
                                    `entire event`,
                                  )
                                }
                              >
                                <IconSettings size={14} className="mr-2 text-muted-foreground" />
                                Entire event
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {allMatchIds.length} match{allMatchIds.length !== 1 ? "es" : ""}
                                </span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Save current match only */}
                          <Button
                            onClick={handleSaveMatchScoring}
                            disabled={savingMatchScoring || applyingToAll}
                          >
                            {savingMatchScoring ? (
                              <span className="flex items-center gap-2">
                                <IconLoader2 size={14} className="animate-spin" />
                                Saving…
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <IconDeviceFloppy size={14} />
                                Save Scoring Config
                              </span>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
            </>
          )}
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
                  assign each file to a map, review, then apply (owner 2026-06-29 — parity with
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
              <FlaggedKillsPanel
                key={flagRefreshKey}
                eventId={id}
                token={token}
                canManage
                onChanged={fetchData}
              />
            )}
          </TabsContent>
        )}
      </Tabs>

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
                  // group's matches (owner 2026-06-29 — parity with the leaderboard view page).
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
