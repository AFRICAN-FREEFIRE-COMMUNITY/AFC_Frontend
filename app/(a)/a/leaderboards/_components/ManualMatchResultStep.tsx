"use client";

import React, { useState, useEffect } from "react";
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
import { IconLoader2, IconMap } from "@tabler/icons-react";
import { Loader } from "@/components/Loader";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TournamentMember {
  player_id: number;
  username: string;
}

interface TournamentTeam {
  tournament_team_id: number;
  team_id: number;
  team_name: string;
  team_logo: string | null;
  members: TournamentMember[];
}

interface PlayerResult {
  user_id: number;
  username: string;
  kills: number;
  damage: number;
  assists: number;
  played: boolean;
}

interface TeamResult {
  tournament_team_id: number;
  team_name: string;
  team_logo: string | null;
  placement: number;
  played: boolean;
  players: PlayerResult[];
}

interface SoloResult {
  competitor_id: number;
  username: string;
  placement: number;
  kills: number;
  bonus_points: number;
  penalty_points: number;
  played: boolean;
}

interface Props {
  match: { match_id: number; match_name: string };
  formData: any;
  onComplete: (matchId: number) => void;
  onBack: () => void;
  /** Pass match.stats from the leaderboard API to pre-populate with existing values */
  initialStats?: any[];
  /** Skips participant-type detection when already known (e.g. from eventData.participant_type) */
  participantTypeOverride?: "solo" | "team";
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ManualMatchResultStep({
  match,
  formData,
  onComplete,
  onBack,
  initialStats,
  participantTypeOverride,
}: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [participantType, setParticipantType] = useState<"team" | "solo">(
    "team",
  );
  const [teamResults, setTeamResults] = useState<TeamResult[]>([]);
  const [soloResults, setSoloResults] = useState<SoloResult[]>([]);

  const isEditing = (formData.completed_match_ids ?? []).includes(
    match.match_id,
  );

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      // ── Fast path: use pre-built stats passed from the details page ──────────
      // API stats structure has tournament_team_id (team) or competitor_id (solo)
      if (participantTypeOverride && initialStats && initialStats.length > 0) {
        setParticipantType(participantTypeOverride);

        if (participantTypeOverride === "team") {
          setTeamResults(
            initialStats.map((s: any) => ({
              tournament_team_id: s.tournament_team_id,
              team_name: s.team_name,
              team_logo: s.team_logo ?? null,
              placement: s.placement ?? 0,
              played: s.played ?? true,
              players: (s.players ?? []).map((p: any) => ({
                user_id: p.player_id ?? p.user_id,
                username: p.username,
                kills: p.kills ?? 0,
                damage: p.damage ?? 0,
                assists: p.assists ?? 0,
                played: p.played ?? true,
              })),
            })),
          );
        } else {
          setSoloResults(
            initialStats.map((s: any) => ({
              competitor_id: s.competitor_id,
              username: s.username,
              placement: s.placement ?? 0,
              kills: s.kills ?? 0,
              bonus_points: s.bonus_points ?? 0,
              penalty_points: s.penalty_points ?? 0,
              played: s.played ?? true,
            })),
          );
        }
        return;
      }

      // ── Normal path: fetch participant roster from event details ─────────────
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slug: formData.event_slug }),
        },
      );
      const data = await res.json();
      const details = data.event_details ?? data;

      const pType: "team" | "solo" =
        participantTypeOverride ??
        (details.participant_type === "solo" ? "solo" : "team");
      setParticipantType(pType);

      const teams: TournamentTeam[] = details.tournament_teams ?? [];

      if (pType === "team") {
        setTeamResults(
          teams.map((tt) => ({
            tournament_team_id: tt.tournament_team_id,
            team_name: tt.team_name,
            team_logo: tt.team_logo ?? null,
            placement: 0,
            played: true,
            players: (tt.members ?? []).map((m) => ({
              user_id: m.player_id,
              username: m.username,
              kills: 0,
              damage: 0,
              assists: 0,
              played: true,
            })),
          })),
        );
      } else {
        const competitors: string[] = formData.competitors_in_group ?? [];
        if (competitors.length > 0) {
          setSoloResults(
            competitors.map((name, idx) => ({
              competitor_id: idx + 1,
              username: name,
              placement: 0,
              kills: 0,
              bonus_points: 0,
              penalty_points: 0,
              played: true,
            })),
          );
        } else {
          setSoloResults(
            teams.flatMap((tt) =>
              (tt.members ?? []).map((m) => ({
                competitor_id: m.player_id,
                username: m.username,
                placement: 0,
                kills: 0,
                bonus_points: 0,
                penalty_points: 0,
                played: true,
              })),
            ),
          );
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load participant data");
      if (participantTypeOverride) setParticipantType(participantTypeOverride);
    } finally {
      setLoading(false);
    }
  };

  // ── Team helpers ───────────────────────────────────────────────────────────

  const updateTeamPlacement = (idx: number, val: number) => {
    setTeamResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], placement: val };
      return next;
    });
  };

  const updateTeamPlayed = (idx: number, val: boolean) => {
    setTeamResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], played: val };
      return next;
    });
  };

  const updatePlayerField = (
    teamIdx: number,
    playerIdx: number,
    field: "kills" | "damage" | "assists" | "played",
    value: number | boolean,
  ) => {
    setTeamResults((prev) => {
      const next = [...prev];
      const players = [...next[teamIdx].players];
      players[playerIdx] = { ...players[playerIdx], [field]: value };
      next[teamIdx] = { ...next[teamIdx], players };
      return next;
    });
  };

  // ── Solo helpers ───────────────────────────────────────────────────────────

  const updateSoloField = (
    idx: number,
    field: "placement" | "kills" | "bonus_points" | "penalty_points" | "played",
    value: number | boolean,
  ) => {
    setSoloResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let endpoint: string;
      let body: any;

      if (participantType === "team") {
        endpoint = isEditing
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/enter-team-match-result-manual/`;

        body = {
          match_id: match.match_id,
          results: teamResults.map((t) => ({
            tournament_team_id: t.tournament_team_id,
            placement: t.placement,
            played: t.played,
            players: t.players.map((p) => ({
              user_id: p.user_id,
              kills: p.kills,
              damage: p.damage,
              assists: p.assists,
              played: p.played,
            })),
          })),
        };
      } else {
        endpoint = isEditing
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-match-result/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/enter-solo-match-result-manual/`;

        body = {
          match_id: match.match_id,
          results: soloResults.map((s) => ({
            competitor_id: s.competitor_id,
            placement: s.placement,
            kills: s.kills,
            played: s.played,
            bonus_points: s.bonus_points,
            penalty_points: s.penalty_points,
          })),
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
        throw new Error(err.message || err.detail || "Submission failed");
      }

      toast.success(
        isEditing ? "Results updated!" : "Results submitted successfully!",
      );
      onComplete(match.match_id);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit results");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="gap-0">
        <CardContent className="flex items-center justify-center py-20">
          <IconLoader2 className="animate-spin size-8 text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconMap size={20} className="text-muted-foreground" />
          {match.match_name} — Manual Input
        </CardTitle>
        <CardDescription>
          Enter results for each{" "}
          {participantType === "team" ? "team" : "player"} on {match.match_name}
          .
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {participantType === "team" ? (
          /* ── TEAM MODE ─────────────────────────────────────────────────── */
          teamResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No teams found for this match.
            </p>
          ) : (
            teamResults.map((team, ti) => (
              <div
                key={team.tournament_team_id}
                className="rounded-lg border p-4 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`team-played-${ti}`}
                    checked={team.played}
                    onCheckedChange={(v) => updateTeamPlayed(ti, !!v)}
                  />
                  <label
                    htmlFor={`team-played-${ti}`}
                    className="font-semibold cursor-pointer select-none"
                  >
                    {team.team_name}
                  </label>
                </div>

                <div className="space-y-1.5">
                  <Label>Placement</Label>
                  <Input
                    type="number"
                    min="0"
                    className="max-w-xs"
                    value={team.placement || ""}
                    disabled={!team.played}
                    onChange={(e) =>
                      updateTeamPlacement(ti, parseInt(e.target.value) || 0)
                    }
                  />
                </div>

                {team.players.length > 0 && (
                  <div className="space-y-2">
                    <Label>Players</Label>
                    <div className="space-y-2">
                      {team.players.map((player, pi) => (
                        <div
                          key={player.user_id}
                          className="rounded-md border px-3 py-2 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`p-${ti}-${pi}`}
                              checked={player.played}
                              onCheckedChange={(v) =>
                                updatePlayerField(ti, pi, "played", !!v)
                              }
                            />
                            <label
                              htmlFor={`p-${ti}-${pi}`}
                              className="text-sm font-medium cursor-pointer select-none"
                            >
                              {player.username}
                            </label>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Kills
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={player.kills || ""}
                                disabled={!player.played}
                                onChange={(e) =>
                                  updatePlayerField(
                                    ti,
                                    pi,
                                    "kills",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Damage
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={player.damage || ""}
                                disabled={!player.played}
                                onChange={(e) =>
                                  updatePlayerField(
                                    ti,
                                    pi,
                                    "damage",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Assists
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={player.assists || ""}
                                disabled={!player.played}
                                onChange={(e) =>
                                  updatePlayerField(
                                    ti,
                                    pi,
                                    "assists",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          /* ── SOLO MODE ─────────────────────────────────────────────────── */
          <div className="space-y-2">
            <Label>Players</Label>
            <div className="space-y-2">
              {soloResults.map((solo, si) => (
                <div
                  key={solo.competitor_id}
                  className="rounded-md border px-3 py-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`solo-${si}`}
                      checked={solo.played}
                      onCheckedChange={(v) =>
                        updateSoloField(si, "played", !!v)
                      }
                    />
                    <label
                      htmlFor={`solo-${si}`}
                      className="text-sm font-medium cursor-pointer select-none flex-1 truncate"
                    >
                      {solo.username}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Placement
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={solo.placement || ""}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "placement",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Kills
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={solo.kills || ""}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "kills",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Bonus Points
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={solo.bonus_points || ""}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "bonus_points",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Penalty Points
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={solo.penalty_points || ""}
                        disabled={!solo.played}
                        onChange={(e) =>
                          updateSoloField(
                            si,
                            "penalty_points",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader text={isEditing ? "Updating..." : "Submitting..."} />
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Submit Results"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
