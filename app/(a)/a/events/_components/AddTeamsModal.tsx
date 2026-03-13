"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { IconLoader2, IconSearch, IconUserPlus } from "@tabler/icons-react";

interface Team {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  team_tag: string | null;
  member_count: number;
  country: string;
  is_banned: boolean;
}

type Mode = "event" | "stage" | "group";

interface AddTeamsModalProps {
  mode: Mode;
  targetId: number;
  targetName: string;
  onSuccess?: () => void;
  /** ids of teams already in the event/stage/group — they'll be greyed out */
  existingTeamIds?: number[];
}

const ENDPOINT: Record<Mode, string> = {
  event: "/events/add-teams-to-event/",
  stage: "/events/add-teams-to-stage/",
  group: "/events/add-teams-to-group/",
};

const BODY_KEY: Record<Mode, string> = {
  event: "event_id",
  stage: "stage_id",
  group: "group_id",
};

const LABEL: Record<Mode, string> = {
  event: "Add Teams to Event",
  stage: "Add Teams to Stage",
  group: "Add Teams to Group",
};

export function AddTeamsModal({
  mode,
  targetId,
  targetName,
  onSuccess,
  existingTeamIds = [],
}: AddTeamsModalProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch teams when modal opens
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setSelected([]);
    setSearch("");
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setTeams(res.data.teams ?? []))
      .catch(() => toast.error("Failed to load teams."))
      .finally(() => setLoading(false));
  }, [open, token]);

  const filtered = teams.filter((t) =>
    t.team_name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}${ENDPOINT[mode]}`,
        { [BODY_KEY[mode]]: targetId, team_ids: selected },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        `${selected.length} team${selected.length > 1 ? "s" : ""} added to ${targetName}.`,
      );
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Failed to add teams.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <IconUserPlus className="size-4 mr-1.5" />
        {LABEL[mode]}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{LABEL[mode]}</DialogTitle>
            <DialogDescription>
              Select teams to add to <strong>{targetName}</strong>. Teams
              already added are disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Team list */}
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <IconLoader2 className="size-4 animate-spin" />
                Loading teams...
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {teams.length === 0
                  ? "No teams found."
                  : "No teams match your search."}
              </p>
            ) : (
              <ScrollArea className="h-72 rounded-md border">
                <div className="p-1">
                  {filtered.map((team) => {
                    const alreadyAdded = existingTeamIds.includes(team.team_id);
                    const isSelected = selected.includes(team.team_id);
                    return (
                      <label
                        key={team.team_id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md select-none transition-colors ${
                          alreadyAdded
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-muted cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={alreadyAdded}
                          onCheckedChange={() =>
                            !alreadyAdded && toggle(team.team_id)
                          }
                        />
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                          {team.team_name.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">
                            {team.team_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {team.member_count} member
                            {team.member_count !== 1 ? "s" : ""} •{" "}
                            {team.country}
                          </span>
                        </div>
                        {alreadyAdded && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Added
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">
                {selected.length > 0
                  ? `${selected.length} selected`
                  : "None selected"}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || selected.length === 0}
                >
                  {submitting && (
                    <IconLoader2 className="size-4 animate-spin mr-2" />
                  )}
                  Add {selected.length > 0 ? `(${selected.length})` : ""}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
