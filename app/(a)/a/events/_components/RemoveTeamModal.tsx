"use client";

// RemoveTeamModal (owner 2026-06-22)
// REMOVE a team from an event ENTIRELY - distinct from DisqualifyModal (which keeps the team marked
// "disqualified"). This deletes the team's registration + tournament-team + members + stage/group
// seeds, freeing the slot. Backend: POST /events/remove-team-from-event/ {event_id, team_id}
// (afc_tournament_and_scrims.remove_team_from_event), gated AFC admin OR organizer with
// can_manage_registrations, and BLOCKED (400 code "has_results") if the team already has match
// results - the backend message then tells the admin to disqualify instead. Rendered in
// RegisteredTeamsTab next to Edit roster / Disqualify (admin + organizer share that tab).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { IconUserX } from "@tabler/icons-react";

export const RemoveTeamModal = ({
  team_id,
  event_id,
  name,
  onSuccess,
  showLabel = false,
}: {
  team_id: number;
  event_id: number;
  name: string;
  onSuccess?: () => void;
  showLabel?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const router = useRouter();

  const handleRemove = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/remove-team-from-event/`,
          { event_id, team_id },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Team removed from the event.");
        setOpen(false);
        onSuccess?.();
      } catch (e: any) {
        // Backend returns a clear message (e.g. the "has results, disqualify instead" 400).
        toast.error(e.response?.data?.message || "Failed to remove team.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IconUserX />
          {showLabel && <span>Remove</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <div className="text-center">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <DialogTitle className="text-xl">Remove team from event</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            Remove <b>&quot;{name}&quot;</b> from this event entirely? This frees their slot and is
            different from disqualifying (which keeps them on record as disqualified). It can&apos;t be
            done once the team has match results.
          </DialogDescription>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleRemove}
              disabled={pending}
            >
              {pending ? <Loader text="Removing..." /> : "Remove"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
