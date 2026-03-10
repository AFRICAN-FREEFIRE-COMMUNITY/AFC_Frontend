"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

type RankEntry = { id: number; val: string };

const DEFAULT_RANKS: RankEntry[] = [
  { id: 1, val: "100" },
  { id: 2, val: "80" },
  { id: 3, val: "60" },
  { id: 4, val: "40" },
  { id: 5, val: "20" },
];

function makeDefaultRanks(): RankEntry[] {
  return DEFAULT_RANKS.map((r) => ({ ...r }));
}

interface MapKillSystem {
  killPoint: string;
  assistPoint: string;
  damagePoint: string;
  ranks: RankEntry[];
}

export interface PointSystemData {
  placement_points: Record<string, number>;
  kill_point: string;
  assist_point: string;
  damage_point: string;
  apply_to_all_maps: boolean;
  placement_points_all?: Array<{
    match_id: number;
    kill_point: string;
    assist_point: string;
    damage_point: string;
  }>;
  leaderboard_id?: number | null;
}

interface Props {
  onNext: (data: PointSystemData) => void;
  onBack: () => void;
  parentFormData?: any;
}

function buildPlacementObj(ranks: RankEntry[]): Record<string, number> {
  const obj: Record<string, number> = {};
  ranks.forEach((r, idx) => {
    obj[(idx + 1).toString()] = parseInt(r.val) || 0;
  });
  return obj;
}

// ── Kill/Assist/Damage input group ────────────────────────────────────────────
function KillAssistDamageFields({
  killPoint,
  assistPoint,
  damagePoint,
  onKillChange,
  onAssistChange,
  onDamageChange,
}: {
  killPoint: string;
  assistPoint: string;
  damagePoint: string;
  onKillChange: (v: string) => void;
  onAssistChange: (v: string) => void;
  onDamageChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-1.5">
        <Label>Points per Kill</Label>
        <Input
          type="number"
          step="0.5"
          value={killPoint}
          onChange={(e) => onKillChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Points per Assist</Label>
        <Input
          type="number"
          step="0.5"
          value={assistPoint}
          onChange={(e) => onAssistChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Points per Damage (per 1000)</Label>
        <Input
          type="number"
          step="0.5"
          value={damagePoint}
          onChange={(e) => onDamageChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ConfigurePointSystem({ onNext, onBack, parentFormData }: Props) {
  const { token } = useAuth();
  const groupMatches: any[] = parentFormData?.group_matches ?? [];

  // ── Shared placement points (always global) ────────────────────────────────
  const [ranks, setRanks] = useState<RankEntry[]>(
    DEFAULT_RANKS.map((r) => ({ ...r })),
  );

  const updateRank = (idx: number, val: string) => {
    setRanks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], val };
      return next;
    });
  };
  const addRank = () =>
    setRanks((prev) => [...prev, { id: Date.now(), val: "0" }]);
  const removeRank = (id: number) =>
    setRanks((prev) => prev.filter((r) => r.id !== id));

  // ── Global kill / assist / damage (used when apply-to-all OR as default) ──
  const [globalKill, setGlobalKill] = useState("1");
  const [globalAssist, setGlobalAssist] = useState("0.5");
  const [globalDamage, setGlobalDamage] = useState("0.5");

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const [applyToAllMaps, setApplyToAllMaps] = useState(true);

  // ── Per-map kill / assist / damage / placement ──────────────────────────────
  const [mapSystems, setMapSystems] = useState<Record<number, MapKillSystem>>(
    () => {
      const init: Record<number, MapKillSystem> = {};
      groupMatches.forEach((m) => {
        init[m.match_id] = {
          killPoint: "1",
          assistPoint: "0.5",
          damagePoint: "0.5",
          ranks: makeDefaultRanks(),
        };
      });
      return init;
    },
  );

  const updateMapField = useCallback(
    (matchId: number, field: keyof Omit<MapKillSystem, "ranks">, val: string) => {
      setMapSystems((prev) => ({
        ...prev,
        [matchId]: { ...prev[matchId], [field]: val },
      }));
    },
    [],
  );

  const updateMapRank = useCallback(
    (matchId: number, idx: number, val: string) => {
      setMapSystems((prev) => {
        const nextRanks = [...prev[matchId].ranks];
        nextRanks[idx] = { ...nextRanks[idx], val };
        return { ...prev, [matchId]: { ...prev[matchId], ranks: nextRanks } };
      });
    },
    [],
  );

  const addMapRank = useCallback((matchId: number) => {
    setMapSystems((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        ranks: [...prev[matchId].ranks, { id: Date.now(), val: "0" }],
      },
    }));
  }, []);

  const removeMapRank = useCallback((matchId: number, rankId: number) => {
    setMapSystems((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        ranks: prev[matchId].ranks.filter((r) => r.id !== rankId),
      },
    }));
  }, []);

  const [submitting, setSubmitting] = useState(false);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    const globalPlacementPP = buildPlacementObj(ranks);

    if (!applyToAllMaps) {
      const missing = groupMatches.filter((m) => !mapSystems[m.match_id]);
      if (missing.length > 0) {
        toast.error(`Please configure: ${missing.map((m) => m.match_map).join(", ")}`);
        return;
      }
    }

    const payload: any = {
      event_id: parentFormData?.event_id,
      stage_id: parentFormData?.stage_id,
      group_id: parentFormData?.group_id,
      apply_to_all: applyToAllMaps,
    };

    if (applyToAllMaps) {
      payload.placement_points = globalPlacementPP;
      payload.kill_point = parseFloat(globalKill) || 0;
      payload.points_per_assist = parseFloat(globalAssist) || 0;
      payload.points_per_1000_damage = parseFloat(globalDamage) || 0;
    } else {
      payload.placement_points_list = groupMatches.map((m) => ({
        placement_points: buildPlacementObj(mapSystems[m.match_id].ranks),
        kill_point: parseFloat(mapSystems[m.match_id].killPoint) || 0,
        points_per_assist: parseFloat(mapSystems[m.match_id].assistPoint) || 0,
        points_per_1000_damage: parseFloat(mapSystems[m.match_id].damagePoint) || 0,
      }));
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-leaderboard-manually/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.detail || "Failed to create leaderboard");
      }

      onNext({
        placement_points: globalPlacementPP,
        kill_point: globalKill,
        assist_point: globalAssist,
        damage_point: globalDamage,
        apply_to_all_maps: applyToAllMaps,
        placement_points_all: applyToAllMaps
          ? undefined
          : groupMatches.map((m) => ({
              match_id: m.match_id,
              kill_point: mapSystems[m.match_id].killPoint,
              assist_point: mapSystems[m.match_id].assistPoint,
              damage_point: mapSystems[m.match_id].damagePoint,
            })),
        leaderboard_id: data.leaderboard_id ?? data.id ?? null,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create leaderboard");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Configure Point System</CardTitle>
        <CardDescription>
          Set how many points are awarded for placement, kills, assists, and
          damage. Keep in mind, kills is always visible in the leaderboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Apply to all toggle */}
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            applyToAllMaps ? "bg-muted/30" : ""
          }`}
        >
          <Checkbox
            id="apply-all"
            checked={applyToAllMaps}
            onCheckedChange={(v) => setApplyToAllMaps(!!v)}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label htmlFor="apply-all" className="cursor-pointer font-medium">
              Apply this point system to all maps
            </Label>
            {!applyToAllMaps && (
              <p className="text-xs text-muted-foreground">
                Configure different point systems for each map individually
              </p>
            )}
          </div>
        </div>

        {/* Global config (when apply-to-all is ON) */}
        {applyToAllMaps && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Placement Points</Label>
                <Button variant="outline" size="sm" onClick={addRank}>
                  <IconPlus size={13} className="mr-1" />
                  + Add Placement
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3">
                {ranks.map((r, i) => (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Place {i + 1}
                      </Label>
                      {i > 4 && (
                        <button
                          onClick={() => removeRank(r.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <IconX size={12} />
                        </button>
                      )}
                    </div>
                    <Input
                      type="number"
                      value={r.val}
                      onChange={(e) => updateRank(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <KillAssistDamageFields
              killPoint={globalKill}
              assistPoint={globalAssist}
              damagePoint={globalDamage}
              onKillChange={setGlobalKill}
              onAssistChange={setGlobalAssist}
              onDamageChange={setGlobalDamage}
            />
          </>
        )}

        {/* Per-map section (when apply-to-all is OFF) */}
        {!applyToAllMaps && (
          <div className="space-y-4">
            <Label className="font-medium">Per-Map Point System Configuration</Label>

            {groupMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No matches found for the selected group.
              </p>
            ) : (
              <Tabs defaultValue={groupMatches[0].match_id.toString()}>
                <TabsList className="w-full flex-wrap h-auto gap-1">
                  {groupMatches.map((m) => (
                    <TabsTrigger key={m.match_id} value={m.match_id.toString()}>
                      {m.match_map}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {groupMatches.map((m) => {
                  const sys = mapSystems[m.match_id];
                  if (!sys) return null;
                  return (
                    <TabsContent key={m.match_id} value={m.match_id.toString()} className="mt-4 space-y-4">
                      {/* Placement Points per map */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium text-muted-foreground">Placement Points</Label>
                          <Button variant="outline" size="sm" onClick={() => addMapRank(m.match_id)}>
                            <IconPlus size={13} className="mr-1" />
                            + Add
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3">
                          {sys.ranks.map((r, i) => (
                            <div key={r.id} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Place {i + 1}</Label>
                                {i > 4 && (
                                  <button
                                    onClick={() => removeMapRank(m.match_id, r.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <IconX size={12} />
                                  </button>
                                )}
                              </div>
                              <Input
                                type="number"
                                value={r.val}
                                onChange={(e) => updateMapRank(m.match_id, i, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Kill/Assist/Damage per map */}
                      <KillAssistDamageFields
                        killPoint={sys.killPoint}
                        assistPoint={sys.assistPoint}
                        damagePoint={sys.damagePoint}
                        onKillChange={(v) => updateMapField(m.match_id, "killPoint", v)}
                        onAssistChange={(v) => updateMapField(m.match_id, "assistPoint", v)}
                        onDamageChange={(v) => updateMapField(m.match_id, "damagePoint", v)}
                      />
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={submitting}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={submitting}>
            {submitting ? "Creating Leaderboard…" : "Create Leaderboard"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
