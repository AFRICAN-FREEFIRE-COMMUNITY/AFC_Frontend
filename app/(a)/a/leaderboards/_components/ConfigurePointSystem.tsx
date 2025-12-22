"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconX, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { FormDescription } from "@/components/ui/form";
import { Loader } from "@/components/Loader";

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

  const handleCreate = async () => {
    setLoading(true);

    // 1. Create the placement_point object exactly as requested
    const placementPointsObj: Record<string, number> = {};
    ranks.forEach((r, idx) => {
      placementPointsObj[(idx + 1).toString()] = parseInt(r.val) || 0;
    });

    // 2. Initialize FormData
    const submissionData = new FormData();

    // 3. Append simple fields
    submissionData.append("event_id", parentFormData.event_id);
    submissionData.append("stage_id", parentFormData.stage_id);
    submissionData.append("group_id", parentFormData.group_id);
    submissionData.append(
      "leaderboard_method",
      parentFormData.leaderboard_method
    );
    submissionData.append("file_type", parentFormData.file_type);
    submissionData.append("kill_point", killPoint);

    // 4. Append the object as a JSON string
    // Backend will typically parse this from the 'placement_point' key
    submissionData.append(
      "placement_point",
      JSON.stringify(placementPointsObj)
    );

    // Debugging: Log the FormData entries
    for (let [key, value] of submissionData.entries()) {
      console.log(`${key}:`, value);
    }

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-leaderboard/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: submissionData,
        }
      );

      if (res.ok) onNext();
      else alert("Creation failed. Please check IDs.");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Configure Point System</span>{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRanks([...ranks, { id: Date.now(), val: "0" }])}
          >
            <IconPlus size={14} className="mr-2" />{" "}
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
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? <Loader text="Creating..." /> : "Create Leaderboard"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
