"use client";

// ── AddSoloPlayersModal (owner 2026-07-06) ──────────────────────────────────────────────────────
// The SOLO sibling of AddTeamsModal. add-teams-to-group / add-teams-to-stage are hard team-only, so a
// solo event had no way to hand-pick which registered players sit in a group/stage. This modal:
//   1. GET /events/seeding/registered-solo-players/?event_id=<id>[&stage_id][&group_id] → the event's
//      registered SOLO players with { competitor_id, username, uid, in_stage, in_group } (already-seeded
//      rows are greyed out).
//   2. POST /events/seeding/add-solo-to-group/ {group_id, competitor_ids:[...]} or
//      /events/seeding/add-solo-to-stage/ {stage_id, competitor_ids:[...]}.
// Mirrors AddTeamsModal's structure/idiom exactly (shared admin component, reused verbatim on the
// organizer Groups page). Backend: seeding_management.add_solo_players_to_group / _to_stage /
// list_registered_solo_players. Consumed by: organizer groups/page.tsx (solo events).

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";
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

interface SoloPlayer {
  competitor_id: number;
  user_id: number;
  username: string; // IGN
  uid: string | null;
  full_name: string;
  in_stage: boolean;
  in_group: boolean;
}

type Mode = "group" | "stage";

interface AddSoloPlayersModalProps {
  mode: Mode;
  eventId: number;
  targetId: number; // group_id (mode=group) or stage_id (mode=stage)
  targetName: string;
  /** the stage id, so the picker can grey out players already in the stage even in group mode */
  stageId?: number;
  onSuccess?: () => void;
}

const ENDPOINT: Record<Mode, string> = {
  group: "/events/seeding/add-solo-to-group/",
  stage: "/events/seeding/add-solo-to-stage/",
};

const BODY_KEY: Record<Mode, string> = {
  group: "group_id",
  stage: "stage_id",
};

const LABEL: Record<Mode, string> = {
  group: "Add Players to Group",
  stage: "Add Players to Stage",
};

export function AddSoloPlayersModal({
  mode,
  eventId,
  targetId,
  targetName,
  stageId,
  onSuccess,
}: AddSoloPlayersModalProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);

  const [players, setPlayers] = useState<SoloPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch the event's registered solo players when the modal opens. Pass stage_id/group_id so the
  // response's in_stage/in_group flags let us grey out already-seeded rows.
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setSelected([]);
    setSearch("");
    const params = new URLSearchParams({ event_id: String(eventId) });
    if (mode === "group") {
      params.set("group_id", String(targetId));
      if (stageId != null) params.set("stage_id", String(stageId));
    } else {
      params.set("stage_id", String(targetId));
    }
    axios
      .get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/registered-solo-players/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((res) => setPlayers(res.data.players ?? []))
      .catch(() => toast.error("Failed to load players."))
      .finally(() => setLoading(false));
  }, [open, token, eventId, mode, targetId, stageId]);

  // Search across IGN, full name, and UID (shared matchesSearch: punctuation/accent/fancy-font folding).
  const filtered = players.filter((p) =>
    matchesSearch([p.username, p.full_name, p.uid], search),
  );

  // A player is "already added" for THIS target: in_group when seeding a group, in_stage for a stage.
  const alreadyIn = (p: SoloPlayer) => (mode === "group" ? p.in_group : p.in_stage);

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
        { [BODY_KEY[mode]]: targetId, competitor_ids: selected },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        `${selected.length} player${selected.length > 1 ? "s" : ""} added to ${targetName}.`,
      );
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Failed to add players.",
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
              Select players to add to <strong>{targetName}</strong>. Players already added are
              disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by IGN, name, or UID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Player list */}
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <IconLoader2 className="size-4 animate-spin" />
                Loading players...
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {players.length === 0
                  ? "No registered players found."
                  : "No players match your search."}
              </p>
            ) : (
              <ScrollArea className="h-72 rounded-md border">
                <div className="p-1">
                  {filtered.map((player) => {
                    const added = alreadyIn(player);
                    const isSelected = selected.includes(player.competitor_id);
                    return (
                      <label
                        key={player.competitor_id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md select-none transition-colors ${
                          added
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-muted cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={added}
                          onCheckedChange={() => !added && toggle(player.competitor_id)}
                        />
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                          {player.username.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">
                            {player.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {player.uid ? `UID ${player.uid}` : "No UID"}
                            {player.full_name ? ` • ${player.full_name}` : ""}
                          </span>
                        </div>
                        {added && (
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
                {selected.length > 0 ? `${selected.length} selected` : "None selected"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || selected.length === 0}>
                  {submitting && <IconLoader2 className="size-4 animate-spin mr-2" />}
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
