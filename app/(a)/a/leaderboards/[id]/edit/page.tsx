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
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

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

interface MatchData {
  match_id: number;
  match_number: number;
  match_map: string;
  stats: RawStat[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation state
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Participant type
  const [participantType, setParticipantType] = useState<"solo" | "team">(
    "solo",
  );

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

  // Scoring config
  const [killPoint, setKillPoint] = useState("1");
  const [ranks, setRanks] = useState<{ id: string; val: string }[]>([]);
  const [savingScoring, setSavingScoring] = useState(false);

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

  useEffect(() => {
    fetchData();
  }, [id, token]);

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

    // Scoring config
    const lb = group.leaderboard;
    setKillPoint(lb?.kill_point?.toString() ?? "1");
    const placementPts = lb?.placement_points ?? {};
    const rankEntries = Object.entries(placementPts)
      .map(([rank, val]) => ({ id: rank, val: String(val) }))
      .sort((a, b) => parseInt(a.id) - parseInt(b.id));
    const minRanks = 10;
    const padded = [...rankEntries];
    for (let i = padded.length + 1; i <= minRanks; i++) {
      padded.push({ id: `new-${i}-${Date.now()}`, val: "0" });
    }
    setRanks(padded);
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

  // ── Save scoring config ──────────────────────────────────────────────────────

  const handleSaveScoring = async () => {
    const leaderboardId = currentGroup?.leaderboard?.leaderboard_id;
    const stageId = currentGroup?.stage_id ?? currentStage?.stage_id;
    const groupId = currentGroup?.group_id;

    if (!leaderboardId) {
      toast.error("No leaderboard found for this group");
      return;
    }

    setSavingScoring(true);
    try {
      const placementPointsObj: Record<string, number> = {};
      ranks.forEach((r, idx) => {
        placementPointsObj[(idx + 1).toString()] = parseInt(r.val) || 0;
      });

      const formData = new FormData();
      formData.append("leaderboard_id", leaderboardId.toString());
      if (stageId) formData.append("stage_id", stageId.toString());
      if (groupId) formData.append("group_id", groupId.toString());
      formData.append("placement_points", JSON.stringify(placementPointsObj));
      formData.append("kill_point", killPoint);

      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-leaderboard/`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Update failed");
      }

      toast.success("Scoring configuration updated!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update scoring");
    } finally {
      setSavingScoring(false);
    }
  };

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
      <Tabs defaultValue="matches">
        <TabsList className="grid w-full grid-cols-3">
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
                          <TableHead className="text-center">
                            +/- Adjust
                          </TableHead>
                          <TableHead className="text-right">
                            Adjusted Total
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
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() =>
                                      setAdjustments((prev) => ({
                                        ...prev,
                                        [entityId]: (prev[entityId] ?? 0) - 1,
                                      }))
                                    }
                                    className="size-7 rounded border flex items-center justify-center text-sm hover:bg-muted transition-colors"
                                  >
                                    −
                                  </button>
                                  <span className="w-10 text-center text-sm tabular-nums">
                                    {adj >= 0 ? `+${adj}` : adj}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setAdjustments((prev) => ({
                                        ...prev,
                                        [entityId]: (prev[entityId] ?? 0) + 1,
                                      }))
                                    }
                                    className="size-7 rounded border flex items-center justify-center text-sm hover:bg-muted transition-colors"
                                  >
                                    +
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                {displayTotal}
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
        <TabsContent value="scoring" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Configuration</CardTitle>
              <CardDescription>
                Edit the kill point value and placement point rewards for this
                leaderboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-xs">
                <Label>Kill Points</Label>
                <Input
                  type="number"
                  min="0"
                  value={killPoint}
                  onChange={(e) => setKillPoint(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Placement Points</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRanks([
                        ...ranks,
                        { id: `add-${Date.now()}`, val: "0" },
                      ])
                    }
                  >
                    <IconPlus size={12} className="mr-1" /> Add Rank
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {ranks.map((r, i) => (
                    <Card key={r.id} className="py-1 group relative border">
                      <CardContent className="p-2">
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs text-muted-foreground">
                            Rank {i + 1}
                          </Label>
                          {ranks.length > 10 && (
                            <button
                              onClick={() =>
                                setRanks(
                                  ranks.filter((_, index) => index !== i),
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
                          onChange={(e) => {
                            const newRanks = [...ranks];
                            newRanks[i] = {
                              ...newRanks[i],
                              val: e.target.value,
                            };
                            setRanks(newRanks);
                          }}
                          className="h-8"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveScoring} disabled={savingScoring}>
                  {savingScoring ? (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
