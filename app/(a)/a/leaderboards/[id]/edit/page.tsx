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
} from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { ManualMatchResultStep } from "../../_components/ManualMatchResultStep";
import { MatchMethodSelectionStep } from "../../_components/MatchMethodSelectionStep";
import { ImageUploadStep } from "../../_components/ImageUploadStep";
import { FileUploadStep } from "../../_components/FileUploadStep";

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
    name: stat.username ?? stat.team_name ?? "—",
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
    teamName: stat.team_name ?? "—",
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
  return e.competitor__user__username ?? e.team_name ?? "—";
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

  // Navigation state
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Participant type
  const [participantType, setParticipantType] = useState<"solo" | "team">(
    "solo",
  );

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

  // Total leaderboard
  const [overall, setOverall] = useState<OverallEntry[]>([]);
  const [adjustments, setAdjustments] = useState<Record<number, number>>({});
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Per-match scoring config
  const [matchScoring, setMatchScoring] = useState<
    Record<number, MatchScoringConfig>
  >({});
  const [savingMatchScoring, setSavingMatchScoring] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
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

  useEffect(() => {
    fetchData();
  }, [id, token]);

  // Fallback slug lookup if not in leaderboard response
  useEffect(() => {
    if (eventData && !eventSlug) {
      fetchEventSlug();
    }
  }, [eventData]);

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
      initialPlayerGroups[m.match_id] = (m.stats ?? []).map(
        statToTeamPlayerGroup,
      );
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
  }, [selectedGroupId, eventData]);

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
        const players = g.players.map((p, pi) =>
          pi === playerIdx ? { ...p, [field]: value } : p,
        );
        return { ...g, players };
      });
      return { ...prev, [matchId]: groups };
    });
  };

  const toggleTeam = (key: string) => {
    setExpandedTeams((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Save match results ───────────────────────────────────────────────────────

  const handleSaveMatch = async () => {
    if (selectedMatchId === null) return;
    const rows = editRows[selectedMatchId] ?? [];
    setSavingMatch(true);
    try {
      let endpoint: string;
      let body: any;

      if (participantType === "solo") {
        endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-solo-match-result/`;
        body = {
          match_id: selectedMatchId.toString(),
          rows: rows.map((r) => ({
            competitor_id: r.id,
            placement: r.placement,
            kills: r.kills,
            played: r.played,
            bonus_points: r.bonus_points,
            penalty_points: r.penalty_points,
          })),
        };
      } else {
        const groups = playerGroups[selectedMatchId] ?? [];
        endpoint = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`;
        body = {
          match_id: selectedMatchId,
          results: rows.map((r) => {
            const teamGroup = groups.find((g) => g.teamId === r.id);
            return {
              tournament_team_id: r.id,
              placement: r.placement,
              played: r.played,
              bonus_points: r.bonus_points,
              penalty_points: r.penalty_points,
              players: (teamGroup?.players ?? []).map((p) => ({
                user_id: p.player_id,
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

      toast.success("Match results saved!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save match results");
    } finally {
      setSavingMatch(false);
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
    setUploadDrawerOpen(true);
  };

  const handleUploadComplete = () => {
    setUploadDrawerOpen(false);
    setUploadingMatch(null);
    fetchData();
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
      <PageHeader
        back
        title={`Edit: ${eventData?.event_name ?? "Leaderboard"}`}
        description="Edit match results, scoring configuration, and apply adjustments"
      />

      {/* Stage tabs */}
      <Tabs value={selectedStageId} onValueChange={setSelectedStageId}>
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
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
        </TabsList>

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
                                  {row.name}
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
                                    <span className="font-medium text-sm">
                                      {group.teamName}
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
                                                  {player.username}
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
                                      {stat.username ?? stat.team_name ?? "—"}
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

                  {/* Save button */}
                  <div className="flex justify-end">
                    <Button onClick={handleSaveMatch} disabled={savingMatch}>
                      {savingMatch ? (
                        <span className="flex items-center gap-2">
                          <IconLoader2 size={14} className="animate-spin" />
                          Saving…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <IconDeviceFloppy size={14} />
                          Save Match Results
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
                                {getEntityName(entry)}
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.total_booyah}
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.total_kills}
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
                          — Match{" "}
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

                        <div className="flex justify-end">
                          <Button
                            onClick={handleSaveMatchScoring}
                            disabled={savingMatchScoring}
                          >
                            {savingMatchScoring ? (
                              <span className="flex items-center gap-2">
                                <IconLoader2
                                  size={14}
                                  className="animate-spin"
                                />
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
          {groupMatches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No matches found for this group.
              </CardContent>
            </Card>
          ) : (
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
          )}
        </TabsContent>
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
                onComplete={handleUploadComplete}
                onBack={() => setUploadView("method")}
              />
            )}

            {uploadView === "image_upload" && (
              <ImageUploadStep
                onNext={handleUploadComplete}
                onBack={() => setUploadView("method")}
              />
            )}

            {uploadView === "room_file_upload" &&
              uploadingMatch &&
              uploadFormData && (
                <FileUploadStep
                  match={uploadingMatch}
                  formData={uploadFormData}
                  participantTypeOverride={participantType}
                  onNext={handleUploadComplete}
                  onBack={() => setUploadView("method")}
                />
              )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
