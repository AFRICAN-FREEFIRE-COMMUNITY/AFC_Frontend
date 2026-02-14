"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconTrophy, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  onNext: () => void;
  onBack: () => void;
  formData: any;
}

export function GenerateLeaderboardStep({ onNext, onBack, formData }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);

    try {
      // Step 1: Create the leaderboard with point system
      const placementPointsObj: Record<string, number> = {};
      if (formData.placement_points) {
        Object.keys(formData.placement_points).forEach((key) => {
          placementPointsObj[key] = formData.placement_points[key];
        });
      }

      const leaderboardPayload = {
        event_id: formData.event_id,
        stage_id: formData.stage_id,
        group_id: formData.group_id,
        placement_points: placementPointsObj,
        kill_point: formData.kill_point || "1",
      };

      const leaderboardRes = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-leaderboard-manually/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(leaderboardPayload),
        },
      );

      if (!leaderboardRes.ok) {
        throw new Error("Failed to create leaderboard");
      }

      const leaderboardData = await leaderboardRes.json();

      console.log(leaderboardData);
      const matchId = leaderboardData.leaderboard_id; // Assuming API returns match_id

      // Step 2: Submit match results for each map
      if (formData.map_data && formData.map_data.length > 0) {
        for (const map of formData.map_data) {
          const results = map.teams.map((team: any) => ({
            tournament_team_id: team.team_id, // Using team_id from our data
            placement: team.placement,
            played: team.played,
            players: team.players.map((player: any) => ({
              user_id: player.id, // Using member id
              kills: player.kills,
              damage: player.damage || 0,
              assists: player.assists || 0,
              played: player.played,
            })),
          }));

          const matchResultPayload = {
            match_id: matchId,
            results: results,
          };

          console.log(matchResultPayload);

          const matchResultRes = await fetch(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/enter-team-match-result-manual/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(matchResultPayload),
            },
          );

          if (!matchResultRes.ok) {
            throw new Error(
              `Failed to submit results for map: ${map.map_name}`,
            );
          }
        }
      }

      toast.success("Leaderboard generated successfully!");
      onNext();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate leaderboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Generate Leaderboard</CardTitle>
        <CardDescription>
          Finalize your manual input and generate leaderboards
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <IconTrophy size={80} className="text-primary relative z-10" />
          </div>

          <div className="space-y-2 text-center max-w-md">
            <h3 className="text-xl font-semibold">Ready to Generate</h3>
            <p className="text-sm text-muted-foreground">
              Click the button below to process your data and automatically
              generate team and player leaderboards
            </p>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>✓ {formData.selected_teams?.length || 0} teams selected</p>
            <p>✓ {formData.map_data?.length || 0} map(s) configured</p>
            <p>✓ Point system configured</p>
          </div>

          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={loading}
            className="w-full max-w-sm"
          >
            {loading ? (
              <>
                <IconLoader2 className="mr-2 animate-spin" size={18} />
                Generating Leaderboards...
              </>
            ) : (
              "Generate Leaderboards"
            )}
          </Button>
        </div>

        <div className="flex justify-between pt-6">
          <Button variant="ghost" onClick={onBack} disabled={loading}>
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
