"use client";

// ── ResultsStep (wizard step 3) ───────────────────────────────────────────────
// Add the "maps" (matches) and enter per-map results for every participant. Mirrors the per-map
// editable-table pattern from the event GroupResultsEditor (map tabs + a placement/kills table), but
// works over standalone participants and the standalone endpoints:
//   • add a map     -> POST /leaderboards/standalone/<id>/matches/        (addMatch)
//   • remove a map  -> DELETE /leaderboards/standalone/matches/<mid>/     (removeMatch)
//   • save a map    -> POST /leaderboards/standalone/matches/<mid>/results/ {results:[...]} (saveResults)
//
// Each map keeps its own editable rows (one per participant): placement + kills (+ bonus/penalty). The
// backend computes placement_points/kill_points/total_points from the leaderboard's scoring config on
// save, so we only send the raw inputs.
//
// CONSUMED BY: ../page.tsx (the wizard). Reads the shared participants + matches lists via props and
// reports newly-created/removed maps back up so Review can re-fetch fresh standings.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconMapPin,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { InfoTip } from "@/components/ui/info-tip";
import {
  standaloneLeaderboardsApi,
  type StandaloneMatch,
  type StandaloneParticipant,
} from "@/lib/standaloneLeaderboards";

// One editable cell-set per participant, per map.
interface ResultRow {
  participant_id: number;
  name: string;
  is_ghost: boolean;
  placement: number;
  kills: number;
}

function blankRows(participants: StandaloneParticipant[]): ResultRow[] {
  return participants.map((p) => ({
    participant_id: p.id,
    name: p.name,
    is_ghost: p.is_ghost,
    placement: 0,
    kills: 0,
  }));
}

export function ResultsStep({
  leaderboardId,
  participants,
  matches,
  onMatchesChange,
  onBack,
  onNext,
}: {
  leaderboardId: number;
  participants: StandaloneParticipant[];
  matches: StandaloneMatch[];
  onMatchesChange: (next: StandaloneMatch[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [activeMatchId, setActiveMatchId] = useState<number | null>(
    matches[0]?.id ?? null,
  );
  // Per-map editable rows, keyed by match id. Seeded blank from the participant list.
  const [rowsByMatch, setRowsByMatch] = useState<Record<number, ResultRow[]>>({});
  const [addingMap, setAddingMap] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);

  // Ensure every map has a row-set and the active tab points at a real map. Runs when
  // maps or participants change (e.g. after adding a map, or arriving from step 2).
  useEffect(() => {
    setRowsByMatch((prev) => {
      const next = { ...prev };
      for (const m of matches) {
        if (!next[m.id]) next[m.id] = blankRows(participants);
      }
      return next;
    });
    if (activeMatchId === null && matches.length > 0) {
      setActiveMatchId(matches[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, participants]);

  const currentRows =
    activeMatchId !== null ? rowsByMatch[activeMatchId] ?? [] : [];

  const updateRow = (
    matchId: number,
    idx: number,
    field: "placement" | "kills",
    value: number,
  ) =>
    setRowsByMatch((prev) => {
      const rows = [...(prev[matchId] ?? [])];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, [matchId]: rows };
    });

  // ── Add a map (next match_number). ──
  const addMap = async () => {
    setAddingMap(true);
    try {
      const nextNumber = matches.length + 1;
      const res = await standaloneLeaderboardsApi.addMatch(leaderboardId, {
        match_number: nextNumber,
      });
      const updated = [...matches, res.match];
      onMatchesChange(updated);
      setActiveMatchId(res.match.id);
      toast.success(`Added map ${res.match.match_number}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to add a map.");
    } finally {
      setAddingMap(false);
    }
  };

  const removeMap = async (m: StandaloneMatch) => {
    try {
      await standaloneLeaderboardsApi.removeMatch(m.id);
      const updated = matches.filter((x) => x.id !== m.id);
      onMatchesChange(updated);
      setRowsByMatch((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      if (activeMatchId === m.id) setActiveMatchId(updated[0]?.id ?? null);
      toast.success(`Removed map ${m.match_number}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove the map.");
    }
  };

  // ── Save the active map's results. ──
  const saveMap = async () => {
    if (activeMatchId === null) return;
    const rows = rowsByMatch[activeMatchId] ?? [];
    if (rows.length === 0) {
      toast.error("No participants to score on this map.");
      return;
    }
    setSavingMatch(true);
    try {
      await standaloneLeaderboardsApi.saveResults(activeMatchId, {
        results: rows.map((r) => ({
          participant_id: r.participant_id,
          placement: r.placement,
          kills: r.kills,
        })),
      });
      toast.success("Map results saved.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save results.");
    } finally {
      setSavingMatch(false);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center">
          Results per map
          <InfoTip
            text="Add a map for each match played, then enter each participant's placement and kills. Points are computed automatically from your scoring config."
            className="ml-1.5"
          />
        </CardTitle>
        <CardDescription>
          Add maps and enter placement + kills for every participant, then save each map.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map tabs + add. Mirrors the GroupResultsEditor map-tab row (button pills). */}
        <div className="flex flex-wrap items-center gap-2">
          {matches.map((m) => (
            <div key={m.id} className="flex items-center">
              <Button
                variant={activeMatchId === m.id ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveMatchId(m.id)}
              >
                <IconMapPin size={14} className="mr-1" />
                {m.match_map || `Map ${m.match_number}`}
              </Button>
              <button
                type="button"
                onClick={() => removeMap(m)}
                className="ml-1 text-muted-foreground hover:text-destructive"
                aria-label={`Remove map ${m.match_number}`}
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addMap}
            disabled={addingMap}
          >
            <IconPlus size={14} className="mr-1" />
            {addingMap ? "Adding..." : "Add map"}
          </Button>
        </div>

        {matches.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No maps yet. Add a map to start entering results.
          </p>
        ) : (
          <>
            {/* Per-map editable table (placement + kills per participant). */}
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="p-2 text-xs text-foreground">Participant</TableHead>
                    <TableHead className="w-28 p-2 text-xs text-foreground">Placement</TableHead>
                    <TableHead className="w-28 p-2 text-xs text-foreground">Kills</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRows.map((row, idx) => (
                    <TableRow key={row.participant_id}>
                      <TableCell className="p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.name}</span>
                          {row.is_ghost && (
                            <Badge
                              variant="outline"
                              className="rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                            >
                              Ghost
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          min="0"
                          className="h-8 w-20"
                          value={row.placement || ""}
                          onChange={(e) =>
                            updateRow(
                              activeMatchId!,
                              idx,
                              "placement",
                              parseInt(e.target.value) || 0,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          min="0"
                          className="h-8 w-20"
                          value={row.kills || ""}
                          onChange={(e) =>
                            updateRow(
                              activeMatchId!,
                              idx,
                              "kills",
                              parseInt(e.target.value) || 0,
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveMap} disabled={savingMatch}>
                {savingMatch ? (
                  <span className="flex items-center gap-2">
                    <IconLoader2 size={14} className="animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconDeviceFloppy size={14} /> Save this map
                  </span>
                )}
              </Button>
            </div>
          </>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>Continue to review</Button>
        </div>
      </CardContent>
    </Card>
  );
}
