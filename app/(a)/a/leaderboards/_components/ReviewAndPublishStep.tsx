"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconEdit,
  IconTrash,
  IconLoader2,
  IconAlertCircle,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdjustScoreModal } from "./AdjustScoreModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MatchStat {
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
  stats: MatchStat[];
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

interface Props {
  onNext: () => void;
  onBack: () => void;
  formData: any;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ReviewAndPublishStep({ onNext, onBack, formData }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const [participantType, setParticipantType] = useState<"solo" | "team">("solo");
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [overall, setOverall] = useState<OverallEntry[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  // AdjustScoreModal state
  const [adjustMatch, setAdjustMatch] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

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
          body: JSON.stringify({ event_id: formData.event_id }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || "Failed to fetch leaderboard");

      setParticipantType(data.participant_type === "team" ? "team" : "solo");

      const targetGroupId = parseInt(formData.group_id);
      let targetGroup: any = null;
      for (const stage of data.stages ?? []) {
        const found = (stage.groups ?? []).find((g: any) => g.group_id === targetGroupId);
        if (found) { targetGroup = found; break; }
      }
      if (!targetGroup) throw new Error("Group not found in leaderboard data");

      const groupMatches: MatchData[] = targetGroup.matches ?? [];
      setMatches(groupMatches);
      setSelectedMatchId(groupMatches[0]?.match_id ?? null);
      setOverall(targetGroup.overall_leaderboard ?? []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDrafts = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/save-leaderboard-draft/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ group_id: formData.group_id }),
        },
      );
      if (!res.ok) throw new Error("Failed to save draft");
      toast.success("Leaderboard saved to drafts!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/publish-leaderboard/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ group_id: formData.group_id }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.detail || "Failed to publish leaderboard");
      }
      toast.success("Leaderboard published successfully!");
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to publish leaderboard");
    } finally {
      setPublishing(false);
    }
  };

  const getEntityName = (entry: OverallEntry) =>
    entry.competitor__user__username ?? entry.team_name ?? "—";
  const getEntityId = (entry: OverallEntry) =>
    entry.competitor_id ?? entry.tournament_team_id ?? 0;

  const selectedMatch = matches.find((m) => m.match_id === selectedMatchId);

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
            <Button variant="ghost" onClick={onBack}>Back</Button>
            <Button onClick={fetchData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedOverall = [...overall].sort((a, b) => b.effective_total - a.effective_total);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="gap-0">
        <CardHeader>
          <CardTitle>Review Generated Leaderboards</CardTitle>
          <CardDescription>Review and edit before publishing</CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-8">

          {/* ── Results by Map ───────────────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold">Results by Map</h3>
            <div className="flex gap-2 flex-wrap">
              {matches.map((m) => (
                <Button
                  key={m.match_id}
                  size="sm"
                  variant={selectedMatchId === m.match_id ? "default" : "secondary"}
                  onClick={() => setSelectedMatchId(m.match_id)}
                >
                  {m.match_map}
                </Button>
              ))}
            </div>

            {selectedMatch && (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{participantType === "team" ? "Team" : "Player"}</TableHead>
                      <TableHead className="text-right">Placement</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">Placement Pts</TableHead>
                      <TableHead className="text-right">Kill Pts</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...selectedMatch.stats]
                      .sort((a, b) => b.effective_total - a.effective_total)
                      .map((stat, idx) => (
                        <TableRow key={stat.competitor_id ?? stat.tournament_team_id ?? idx}>
                          <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                          <TableCell className="font-medium">
                            {stat.username ?? stat.team_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">{stat.placement}</TableCell>
                          <TableCell className="text-right">{stat.kills}</TableCell>
                          <TableCell className="text-right">{stat.placement_points}</TableCell>
                          <TableCell className="text-right">{stat.kill_points}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {stat.effective_total}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ── Total Leaderboard summary ────────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="font-semibold">Total Leaderboard</h3>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>{participantType === "team" ? "Team Name" : "Player Name"}</TableHead>
                    <TableHead className="text-right">Booyahs</TableHead>
                    <TableHead className="text-right">Kills</TableHead>
                    <TableHead className="text-right">Placements</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOverall.map((entry, idx) => (
                    <TableRow key={getEntityId(entry) || idx}>
                      <TableCell>
                        <Badge variant="outline">#{idx + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{getEntityName(entry)}</TableCell>
                      <TableCell className="text-right">{entry.total_booyah}</TableCell>
                      <TableCell className="text-right">{entry.total_kills}</TableCell>
                      <TableCell className="text-right text-primary font-medium">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {entry.effective_total.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Team / Player Leaderboard tabs ───────────────────────────── */}
          <Tabs defaultValue="overall">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overall">
                {participantType === "team" ? "Team Leaderboard" : "Player Leaderboard"}
              </TabsTrigger>
              <TabsTrigger value="bymap">By Map</TabsTrigger>
            </TabsList>

            {/* Overall tab */}
            <TabsContent value="overall" className="mt-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>{participantType === "team" ? "Team" : "Player"}</TableHead>
                      <TableHead className="text-right">Booyahs</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">Placements</TableHead>
                      <TableHead className="text-right">Total Points</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOverall.map((entry, idx) => (
                      <TableRow key={getEntityId(entry) || idx}>
                        <TableCell className="font-medium text-primary">#{idx + 1}</TableCell>
                        <TableCell>{getEntityName(entry)}</TableCell>
                        <TableCell className="text-right">{entry.total_booyah}</TableCell>
                        <TableCell className="text-right">{entry.total_kills}</TableCell>
                        <TableCell className="text-right text-primary">{idx + 1}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
                            {entry.effective_total.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => {
                                // Open AdjustScoreModal for the first match as a default
                                // In practice, the user would pick a specific match to edit
                                if (matches[0]) setAdjustMatch(matches[0]);
                              }}
                            >
                              <IconEdit size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive">
                              <IconTrash size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* By Map tab */}
            <TabsContent value="bymap" className="mt-4 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {matches.map((m) => (
                  <Button
                    key={m.match_id}
                    size="sm"
                    variant={selectedMatchId === m.match_id ? "default" : "secondary"}
                    onClick={() => setSelectedMatchId(m.match_id)}
                  >
                    {m.match_map}
                  </Button>
                ))}
              </div>

              {selectedMatch && (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>{participantType === "team" ? "Team" : "Player"}</TableHead>
                        <TableHead className="text-right">Placement</TableHead>
                        <TableHead className="text-right">Kills</TableHead>
                        <TableHead className="text-right">Total Points</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...selectedMatch.stats]
                        .sort((a, b) => b.effective_total - a.effective_total)
                        .map((stat, idx) => (
                          <TableRow key={stat.competitor_id ?? stat.tournament_team_id ?? idx}>
                            <TableCell className="font-medium text-primary">#{idx + 1}</TableCell>
                            <TableCell>{stat.username ?? stat.team_name ?? "—"}</TableCell>
                            <TableCell className="text-right">{stat.placement}</TableCell>
                            <TableCell className="text-right">{stat.kills}</TableCell>
                            <TableCell className="text-right">
                              <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
                                {stat.effective_total}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => setAdjustMatch(selectedMatch)}
                                >
                                  <IconEdit size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:text-destructive"
                                >
                                  <IconTrash size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={onBack}>Back</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveToDrafts} disabled={savingDraft}>
                {savingDraft ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" /> Saving…
                  </span>
                ) : (
                  "Save to Drafts"
                )}
              </Button>
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" /> Publishing…
                  </span>
                ) : (
                  "Publish Leaderboard"
                )}
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* AdjustScoreModal (opens when clicking edit on a match row) */}
      {adjustMatch && (
        <AdjustScoreModal
          open={!!adjustMatch}
          onClose={() => setAdjustMatch(null)}
          match={adjustMatch}
          onSuccess={() => { setAdjustMatch(null); fetchData(); }}
        />
      )}
    </>
  );
}
