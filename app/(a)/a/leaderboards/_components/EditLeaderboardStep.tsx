"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconLoader2,
  IconAlertCircle,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

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

// Editable row state per stat entry
interface EditRow {
  id: number; // competitor_id or tournament_team_id
  name: string;
  placement: number;
  kills: number;
  bonus_points: number;
  penalty_points: number;
  played: boolean;
}

interface Props {
  formData: any;
  onNext: () => void;
  onBack: () => void;
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

// ── Component ──────────────────────────────────────────────────────────────────

export function EditLeaderboardStep({ formData, onNext, onBack }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantType, setParticipantType] = useState<"solo" | "team">(
    "solo",
  );
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [overall, setOverall] = useState<OverallEntry[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  // editRows[matchId] = array of editable rows for that match
  const [editRows, setEditRows] = useState<Record<number, EditRow[]>>({});
  const [saving, setSaving] = useState(false);
  // Local +/- adjustments for the Total Leaderboard
  const [adjustments, setAdjustments] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
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
          body: JSON.stringify({ event_id: formData.event_id }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || data.detail || "Failed to fetch leaderboard",
        );
      }

      setParticipantType(data.participant_type === "team" ? "team" : "solo");

      const targetGroupId = parseInt(formData.group_id);
      let targetGroup: any = null;
      for (const stage of data.stages ?? []) {
        const found = (stage.groups ?? []).find(
          (g: any) => g.group_id === targetGroupId,
        );
        if (found) {
          targetGroup = found;
          break;
        }
      }

      if (!targetGroup) throw new Error("Group not found in leaderboard data");

      const groupMatches: MatchData[] = targetGroup.matches ?? [];
      setMatches(groupMatches);
      setSelectedMatchId(groupMatches[0]?.match_id ?? null);
      setOverall(targetGroup.overall_leaderboard ?? []);

      // Initialise editable rows from raw stats
      const initialRows: Record<number, EditRow[]> = {};
      for (const m of groupMatches) {
        initialRows[m.match_id] = (m.stats ?? []).map(statToEditRow);
      }
      setEditRows(initialRows);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ── Edit helpers ────────────────────────────────────────────────────────────

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

  // ── Save match ──────────────────────────────────────────────────────────────

  const handleSaveMatch = async (matchId: number) => {
    const rows = editRows[matchId] ?? [];
    setSaving(true);
    try {
      let results: any[];

      if (participantType === "solo") {
        results = rows.map((r) => ({
          competitor_id: r.id,
          placement: r.placement,
          kills: r.kills,
          played: r.played,
          bonus_points: r.bonus_points,
          penalty_points: r.penalty_points,
        }));
      } else {
        // Team: players array not available from leaderboard response;
        // send team-level data only with empty players array.
        results = rows.map((r) => ({
          tournament_team_id: r.id,
          placement: r.placement,
          played: r.played,
          players: [],
        }));
      }

      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ match_id: matchId, results }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.detail || "Save failed");
      }

      toast.success("Match results saved!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save results");
    } finally {
      setSaving(false);
    }
  };

  // ── Total Leaderboard helpers ───────────────────────────────────────────────

  const adjustBy = (id: number, delta: number) =>
    setAdjustments((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + delta }));

  const getEntityId = (e: OverallEntry) =>
    e.competitor_id ?? e.tournament_team_id ?? 0;
  const getEntityName = (e: OverallEntry) =>
    e.competitor__user__username ?? e.team_name ?? "—";

  // ── Loading / Error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="gap-0">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <IconLoader2 className="animate-spin size-10 text-primary" />
          <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="gap-0">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <IconAlertCircle className="size-10 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button onClick={fetchLeaderboardData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentRows =
    selectedMatchId !== null ? (editRows[selectedMatchId] ?? []) : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Edit Leaderboard</CardTitle>
        <CardDescription>
          View results by map or edit the total leaderboard before publishing
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-8">
        {/* ── Results by Map ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="font-semibold">Results by Map</h3>

          {/* Map tabs */}
          <div className="flex gap-2 flex-wrap">
            {matches.map((m) => (
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

          {/* Editable match stats */}
          {selectedMatchId !== null && currentRows.length > 0 && (
            <div className="space-y-2">
              {participantType === "solo" ? (
                /* ── SOLO ── */
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead className="w-28">Placement</TableHead>
                        <TableHead className="w-28">Kills</TableHead>
                        <TableHead className="w-28">Bonus Pts</TableHead>
                        <TableHead className="w-28">Penalty Pts</TableHead>
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
                          <TableCell className="text-center">
                            <Checkbox
                              checked={row.played}
                              onCheckedChange={(v) =>
                                updateRow(selectedMatchId, idx, "played", !!v)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                /* ── TEAM ── */
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead className="w-28">Placement</TableHead>
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
                          <TableCell className="text-center">
                            <Checkbox
                              checked={row.played}
                              onCheckedChange={(v) =>
                                updateRow(selectedMatchId, idx, "played", !!v)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Save button for this match */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSaveMatch(selectedMatchId)}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <IconLoader2 size={14} className="animate-spin" /> Saving…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <IconDeviceFloppy size={14} /> Save Match Results
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Total Leaderboard ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="font-semibold">Total Leaderboard</h3>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {participantType === "team" ? "Team Name" : "Player Name"}
                  </TableHead>
                  <TableHead className="text-right">Booyahs</TableHead>
                  <TableHead className="text-right">Kills</TableHead>
                  <TableHead className="text-right">Placements</TableHead>
                  <TableHead className="text-right">Total Points</TableHead>
                  <TableHead className="text-center">+/- Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...overall]
                  .sort((a, b) => b.effective_total - a.effective_total)
                  .map((entry, idx) => {
                    const id = getEntityId(entry);
                    const adj = adjustments[id] ?? 0;
                    const displayTotal = (entry.effective_total + adj).toFixed(
                      1,
                    );
                    return (
                      <TableRow key={id || idx}>
                        <TableCell className="font-medium">
                          {getEntityName(entry)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.total_booyah}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.total_kills}
                        </TableCell>
                        <TableCell className="text-right">{idx + 1}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {displayTotal}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => adjustBy(id, -1)}
                              className="size-7 rounded border flex items-center justify-center text-sm hover:bg-muted transition-colors"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm tabular-nums">
                              {adj}
                            </span>
                            <button
                              onClick={() => adjustBy(id, 1)}
                              className="size-7 rounded border flex items-center justify-center text-sm hover:bg-muted transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>Continue to Review & Publish</Button>
        </div>
      </CardContent>
    </Card>
  );
}
