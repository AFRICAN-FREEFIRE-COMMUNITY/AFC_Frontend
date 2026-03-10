"use client";

import { useState } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [showConfirm, setShowConfirm] = useState(false);

  const isCompleted = (matchId: number) =>
    (formData.completed_match_ids ?? []).includes(matchId);

  const completedCount = groupMatches.filter((m) => isCompleted(m.match_id)).length;
  const allCompleted =
    groupMatches.length > 0 && completedCount === groupMatches.length;

  const pendingMatches = groupMatches.filter((m) => !isCompleted(m.match_id));

  const handleGenerateClick = () => {
    if (!allCompleted) {
      setShowConfirm(true);
    } else {
      onComplete();
    }
  };

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
          <Button onClick={handleGenerateClick}>
            {allCompleted
              ? "Generate Leaderboard"
              : `Generate Leaderboard (${completedCount}/${groupMatches.length})`}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Not all maps have results</AlertDialogTitle>
            <AlertDialogDescription>
              The following{" "}
              {pendingMatches.length === 1 ? "map has" : `${pendingMatches.length} maps have`}{" "}
              not had results submitted yet:
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {pendingMatches.map((m) => (
                  <li key={m.match_id} className="text-sm font-medium text-foreground">
                    {m.match_map}
                  </li>
                ))}
              </ul>
              <span className="mt-3 block">
                Do you still want to generate the leaderboard with the available results?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={onComplete}>
              Generate Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
