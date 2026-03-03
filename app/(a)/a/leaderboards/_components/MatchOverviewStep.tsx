"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconMap, IconCheck } from "@tabler/icons-react";

interface GroupMatch {
  match_id: number;
  match_number: number;
  match_map: string;
  result_inputted: boolean;
}

export interface DisplayMatch {
  match_id: number;
  match_name: string;
}

interface Props {
  formData: any;
  updateData: (data: any) => void;
  onEnterMatch: (match: DisplayMatch) => void;
  onComplete: () => void;
  onBack: () => void;
}

export function MatchOverviewStep({
  formData,
  onEnterMatch,
  onComplete,
  onBack,
}: Props) {
  const groupMatches: GroupMatch[] = formData.group_matches ?? [];

  const isCompleted = (matchId: number) =>
    (formData.completed_match_ids ?? []).includes(matchId);

  const completedCount = groupMatches.filter((m) => isCompleted(m.match_id)).length;
  const allCompleted =
    groupMatches.length > 0 && completedCount === groupMatches.length;

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Match Overview</CardTitle>
        <CardDescription>
          Below are the matches (maps) for this group. Click on any match to
          select an upload method and input results.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {groupMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No matches found for the selected group.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {groupMatches.map((match) => {
              const completed = isCompleted(match.match_id);
              return (
                <button
                  key={match.match_id}
                  onClick={() =>
                    onEnterMatch({
                      match_id: match.match_id,
                      match_name: match.match_map,
                    })
                  }
                  className="text-left rounded-lg border p-4 hover:border-primary/60 hover:bg-muted/30 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconMap size={18} className="text-muted-foreground shrink-0" />
                      <span className="font-semibold">{match.match_map}</span>
                    </div>
                    <Badge variant={completed ? "default" : "secondary"}>
                      {completed ? (
                        <span className="flex items-center gap-1">
                          <IconCheck size={11} /> Done
                        </span>
                      ) : (
                        "Pending"
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-primary">
                    {completed
                      ? "Results inputted — click to edit"
                      : "Click to select upload method and input results"}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={onComplete} disabled={!allCompleted}>
            {allCompleted
              ? "Generate Leaderboard"
              : `${completedCount}/${groupMatches.length} matches complete`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
