"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconX, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import { toast } from "sonner";

export function ConfigurePointSystem({ onNext, onBack, parentFormData }: any) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [killPoint, setKillPoint] = useState("1");
  const [ranks, setRanks] = useState([
    { id: 1, val: "12" },
    { id: 2, val: "9" },
    { id: 3, val: "8" },
    { id: 4, val: "7" },
    { id: 5, val: "6" },
    { id: 6, val: "5" },
    { id: 7, val: "4" },
    { id: 8, val: "3" },
    { id: 9, val: "2" },
    { id: 10, val: "1" },
  ]);

  const isManualFlow = parentFormData.leaderboard_method === "manual";

  const handleContinue = async () => {
    // Build placement_points object
    const placementPointsObj: Record<string, number> = {};
    ranks.forEach((r, idx) => {
      placementPointsObj[(idx + 1).toString()] = parseInt(r.val) || 0;
    });

    if (isManualFlow) {
      // For manual flow, just pass data to next step
      onNext({
        placement_points: placementPointsObj,
        kill_point: killPoint,
      });
    } else {
      // For automated flow, submit to backend
      setLoading(true);

      const submissionData = new FormData();
      submissionData.append("event_id", parentFormData.event_id);
      submissionData.append("stage_id", parentFormData.stage_id);
      submissionData.append("group_id", parentFormData.group_id);
      submissionData.append(
        "leaderboard_method",
        parentFormData.leaderboard_method
      );
      submissionData.append("file_type", parentFormData.file_type);
      submissionData.append("kill_point", killPoint);
      submissionData.append(
        "placement_point",
        JSON.stringify(placementPointsObj)
      );

      const endpoint =
        parentFormData.leaderboard_method === "manual"
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-leaderboard-manually/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-leaderboard/`;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: submissionData,
        });

        if (res.ok) {
          onNext();
        } else {
          const errorData = await res.json();
          toast.error(errorData.message || "Creation failed. Please check IDs.");
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Configure Point System</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRanks([...ranks, { id: Date.now(), val: "0" }])}
          >
            <IconPlus size={14} className="mr-2" />
            <span className="hidden md:inline-block">Add Rank</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-2">
          {ranks.map((r, i) => (
            <Card className="py-1" key={r.id}>
              <CardContent className="p-2">
                <div className="flex justify-between mb-1">
                  <Label>Rank {i + 1}</Label>
                  {i > 9 && (
                    <button
                      onClick={() =>
                        setRanks(ranks.filter((x) => x.id !== r.id))
                      }
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>
                <Input
                  value={r.val}
                  onChange={(e) => {
                    const newRanks = [...ranks];
                    newRanks[i].val = e.target.value;
                    setRanks(newRanks);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1.5">Points</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4">
          <div className="space-y-2.5">
            <Label>Kill Points</Label>
            <div>
              <Input
                value={killPoint}
                onChange={(e) => setKillPoint(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Points per kill
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-6">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={loading}>
            {loading ? (
              <Loader text="Creating..." />
            ) : isManualFlow ? (
              "Continue to Team Selection"
            ) : (
              "Create Leaderboard"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
