"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ActionsTabProps {
  eventDetails: {
    event_status: string;
    event_name: string;
    event_id: number;
    stages: Array<{ stage_id: number; stage_status?: string }>;
    participant_type: string;
  };
  onStartTournament: () => void;
}

export default function ActionsTab({
  eventDetails,
  onStartTournament,
}: ActionsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(() => {
          // Define configuration for each status
          const statusConfig: Record<
            string,
            { text: string; disabled: boolean; variant: any }
          > = {
            upcoming: {
              text: "Start this tournament",
              disabled: false,
              variant: "default",
            },
            ongoing: {
              text: "Tournament in Progress",
              disabled: true,
              variant: "secondary",
            },
            completed: {
              text: "Tournament Completed",
              disabled: true,
              variant: "outline",
            },
            cancelled: {
              text: "Tournament Cancelled",
              disabled: true,
              variant: "destructive",
            },
          };

          // Fallback for unknown statuses
          const currentStatus = eventDetails.event_status || "upcoming";
          const config = statusConfig[currentStatus] || statusConfig.upcoming;

          // Additional logic: If the first stage is already ongoing, force disable the start button
          const isFirstStageOngoing =
            eventDetails.stages[0]?.stage_status === "ongoing";
          const finalDisabled = config.disabled || isFirstStageOngoing;
          const finalText = isFirstStageOngoing
            ? "Stage 1 in Progress"
            : config.text;

          return (
            <Button
              type="button"
              variant={config.variant}
              onClick={onStartTournament}
              className="w-full font-bold"
              disabled={finalDisabled}
            >
              {finalText}
            </Button>
          );
        })()}

        {/* Optional: Show a message if completed */}
        {eventDetails.event_status === "completed" && (
          <p className="text-xs text-center text-muted-foreground italic">
            This tournament has ended. Results are now locked.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
