"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconX } from "@tabler/icons-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

interface MapKillSystem {
  killPoint: string;
  assistPoint: string;
  damagePoint: string;
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

  // ── Per-map kill / assist / damage ─────────────────────────────────────────
  const [mapSystems, setMapSystems] = useState<Record<number, MapKillSystem>>(
    () => {
      const init: Record<number, MapKillSystem> = {};
      groupMatches.forEach((m) => {
        init[m.match_id] = { killPoint: "1", assistPoint: "0.5", damagePoint: "0.5" };
      });
      return init;
    },
  );
  const [activeMapId, setActiveMapId] = useState<number | null>(
    groupMatches[0]?.match_id ?? null,
  );

  const updateMapField = useCallback(
    (matchId: number, field: keyof MapKillSystem, val: string) => {
      setMapSystems((prev) => ({
        ...prev,
        [matchId]: { ...prev[matchId], [field]: val },
      }));
    },
    [],
  );

  const copyGlobalToMap = (matchId: number) => {
    setMapSystems((prev) => ({
      ...prev,
      [matchId]: {
        killPoint: globalKill,
        assistPoint: globalAssist,
        damagePoint: globalDamage,
      },
    }));
    toast.success("Global settings copied to this map");
  };

  const [submitting, setSubmitting] = useState(false);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    const placementPP = buildPlacementObj(ranks);

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
      payload.placement_points = placementPP;
      payload.kill_point = parseFloat(globalKill) || 0;
      payload.points_per_assist = parseFloat(globalAssist) || 0;
      payload.points_per_1000_damage = parseFloat(globalDamage) || 0;
    } else {
      payload.placement_points_list = groupMatches.map((m) => ({
        placement_points: placementPP,
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
        placement_points: placementPP,
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

  const activeMatch = groupMatches.find((m) => m.match_id === activeMapId);
  const activeMapSystem = activeMapId !== null ? mapSystems[activeMapId] : null;

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
                You can configure different point systems for each map
                individually
              </p>
            )}
          </div>
        </div>

        {/* Placement Points – always global */}
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

        {/* Global kill/assist/damage (when apply-to-all is ON) */}
        {applyToAllMaps && (
          <KillAssistDamageFields
            killPoint={globalKill}
            assistPoint={globalAssist}
            damagePoint={globalDamage}
            onKillChange={setGlobalKill}
            onAssistChange={setGlobalAssist}
            onDamageChange={setGlobalDamage}
          />
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
              <>
                {/* Map tabs */}
                <div className="flex gap-2 flex-wrap">
                  {groupMatches.map((m) => (
                    <Button
                      key={m.match_id}
                      variant={activeMapId === m.match_id ? "default" : "secondary"}
                      onClick={() => setActiveMapId(m.match_id)}
                    >
                      {m.match_map}
                    </Button>
                  ))}
                </div>

                {/* Active map editor */}
                {activeMapId !== null && activeMapSystem && activeMatch && (
                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">
                        {activeMatch.match_map} — Point System
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copyGlobalToMap(activeMapId)}
                        >
                          Copy from Map
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setGlobalKill(activeMapSystem.killPoint);
                            setGlobalAssist(activeMapSystem.assistPoint);
                            setGlobalDamage(activeMapSystem.damagePoint);
                            toast.success("Saved as global template");
                          }}
                        >
                          Save as Template
                        </Button>
                      </div>
                    </div>

                    <KillAssistDamageFields
                      killPoint={activeMapSystem.killPoint}
                      assistPoint={activeMapSystem.assistPoint}
                      damagePoint={activeMapSystem.damagePoint}
                      onKillChange={(v) => updateMapField(activeMapId, "killPoint", v)}
                      onAssistChange={(v) => updateMapField(activeMapId, "assistPoint", v)}
                      onDamageChange={(v) => updateMapField(activeMapId, "damagePoint", v)}
                    />
                  </div>
                )}
              </>
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
