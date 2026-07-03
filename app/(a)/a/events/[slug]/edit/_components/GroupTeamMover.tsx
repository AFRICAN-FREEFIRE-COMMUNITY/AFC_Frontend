"use client";

// ── GroupTeamMover (F2, owner 2026-06-19) ───────────────────────────────────────────────────
// Drag-and-drop a TEAM from one group into another within a stage. Self-contained on purpose:
// it owns its OWN @dnd-kit DndContext and reads team ids from the group-rosters endpoint, so it
// never entangles with the form-driven stage/group REORDER DnD that lives in StagesGroupsTab.
//
// FLOW
//   1. POST /events/get-event-group-rosters/ { event_id } → stage → group → teams[{tournament_team_id,
//      team_id, team_name}]. (Team events only; the move endpoint keys on tournament_team_id.)
//   2. Each group renders as a droppable column of draggable team chips.
//   3. On drop into a DIFFERENT group → POST /events/seeding/move-team/ {from_group_id, to_group_id,
//      tournament_team_id}. The backend (seeding_management.move_team_between_groups) returns 409
//      { requires_force } when the team already has entered results in the source group; we then
//      show a confirm dialog and retry with force=true (the old-group results stay behind).
//   4. On success → refetch rosters (in place) + toast.
//
// Mounted by StagesGroupsTab for team (duo/squad) events. Admin + organizer both reach it (the
// backend gate is org-aware: AFC admin OR can_manage_registrations). Round-robin stages are EXCLUDED
// here: their teams live on the RR M2M (not StageGroupCompetitor) and drive generated lobbies, so a
// DnD move is unsupported (the move endpoint fail-safes RR). We filter them out by the authoritative
// `is_round_robin` flag the rosters endpoint returns — the old "RR groups come back without teams"
// assumption was FALSE (the RR branch DOES return teams[]), which let RR stages render as draggable.

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconGripVertical, IconLoader2, IconArrowsMove } from "@tabler/icons-react";
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
import { cn } from "@/lib/utils";
// Team country flag beside each team chip in the group-mover tree (owner 2026-07-03). team_country
// rides on each team from get_event_group_rosters (_team_payload). Blank -> CountryFlag renders nothing.
import { CountryFlag } from "@/lib/countryFlag";

interface RosterTeam {
  tournament_team_id: number;
  team_id: number;
  team_name: string;
  // The team's auto-derived country; drives the flag on the draggable chip.
  team_country?: string | null;
}
interface RosterGroup {
  // number for standard StageGroups / RR base groups; the string "rr-unassigned-<stage_id>"
  // is the RR stage's seeded-but-unassigned pool (owner 2026-07-03).
  group_id: number | string;
  group_name: string;
  teams?: RosterTeam[];
}
interface RosterStage {
  stage_id: number;
  stage_name: string;
  is_round_robin?: boolean; // RR stages are not DnD-movable (teams live on the RR M2M) -> excluded.
  groups: RosterGroup[];
}

// A draggable team chip. id encodes the source group + team so onDragEnd knows what moved.
function TeamChip({
  groupId,
  team,
  disabled,
}: {
  groupId: number | string;
  team: RosterTeam;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `t:${groupId}:${team.tournament_team_id}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40",
      )}
      title="Drag to another group to move this team"
    >
      <IconGripVertical size={13} className="text-muted-foreground shrink-0" />
      {/* Flag beside the team name on the draggable chip (team's country). */}
      <CountryFlag country={team.team_country} className="shrink-0" />
      <span className="capitalize truncate">{team.team_name}</span>
    </div>
  );
}

// A droppable group column. Highlights when a chip is dragged over it. `disabled` freezes its chips
// while a move is in flight so a second drag can't fire against now-stale group membership.
function GroupColumn({ group, disabled }: { group: RosterGroup; disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `g:${group.group_id}` });
  const teams = group.teams ?? [];
  return (
    <Card className="gap-0 min-w-[180px] flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="capitalize">{group.group_name}</span>
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
            {teams.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={setNodeRef}
        className={cn(
          "min-h-16 space-y-1.5 rounded-md transition-colors",
          isOver && "ring-2 ring-primary/60 bg-primary/5",
        )}
      >
        {teams.length === 0 ? (
          <p className="italic text-xs text-muted-foreground py-2">Drop a team here</p>
        ) : (
          teams.map((t) => <TeamChip key={t.tournament_team_id} groupId={group.group_id} team={t} disabled={disabled} />)
        )}
      </CardContent>
    </Card>
  );
}

export default function GroupTeamMover({ eventId }: { eventId: number }) {
  const { token } = useAuth();
  const [stages, setStages] = useState<RosterStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState<RosterTeam | null>(null);
  const [moving, setMoving] = useState(false);
  // Pending force-confirm move (the team has results in its current group).
  const [pendingForce, setPendingForce] = useState<{
    from: number | string;
    to: number | string;
    ttId: number;
    name: string;
  } | null>(null);

  // 8px activation distance so a click on a chip isn't read as a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchRosters = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-group-rosters/`,
        { event_id: eventId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Keep stages that have at least one group with a teams[] array. ROUND-ROBIN stages are
      // included since 2026-07-03 (owner: "SEMI FINALS isn't showing"): their zones are the BASE
      // groups (A/B/C) + the "Unassigned" seeded pool, and the move endpoint has a real RR branch
      // (game-day lobbies derive from base groups, so moves reshape future lobbies automatically).
      const all: RosterStage[] = res.data?.stages ?? [];
      setStages(
        all.filter((s) => (s.groups ?? []).some((g) => Array.isArray(g.teams))),
      );
    } catch {
      /* best-effort: the mover just won't render if rosters can't load */
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    fetchRosters();
  }, [fetchRosters]);

  // POST the move; returns "ok" | "needs_force" | "error".
  const doMove = async (from: number | string, to: number | string, ttId: number, force: boolean) => {
    const res = await axios
      .post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/move-team/`,
        { from_group_id: from, to_group_id: to, tournament_team_id: ttId, force },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then(() => "ok" as const)
      .catch((e) => {
        if (e?.response?.status === 409 && e?.response?.data?.requires_force) return "needs_force" as const;
        toast.error(e?.response?.data?.message || "Failed to move team.");
        return "error" as const;
      });
    return res;
  };

  // Group ids may be numeric (StageGroups / RR base groups) OR the RR pool string
  // "rr-unassigned-<stage_id>" (owner 2026-07-03) - normalise without forcing Number().
  const parseGid = (raw: string): number | string =>
    /^\d+$/.test(raw) ? Number(raw) : raw;

  const onDragStart = (ev: DragStartEvent) => {
    const id = String(ev.active.id); // t:<groupId>:<ttId>
    const [, gid, ttId] = id.split(":");
    for (const s of stages) {
      const g = s.groups.find((x) => String(x.group_id) === gid);
      const t = g?.teams?.find((x) => x.tournament_team_id === Number(ttId));
      if (t) {
        setActiveTeam(t);
        return;
      }
    }
  };

  const onDragEnd = async (ev: DragEndEvent) => {
    setActiveTeam(null);
    if (!ev.over) return;
    const [, fromStr, ttStr] = String(ev.active.id).split(":");
    const toStr = String(ev.over.id).replace("g:", "");
    const from = parseGid(fromStr);
    const to = parseGid(toStr);
    const ttId = Number(ttStr);
    if (!from || !to || !ttId || String(from) === String(to)) return;

    const name =
      stages.flatMap((s) => s.groups).find((g) => String(g.group_id) === String(from))?.teams?.find(
        (t) => t.tournament_team_id === ttId,
      )?.team_name ?? "team";

    setMoving(true);
    const result = await doMove(from, to, ttId, false);
    if (result === "ok") {
      toast.success(`${name} moved.`);
      await fetchRosters(); // await so the tree is fresh before chips re-enable (no stale re-drag)
    } else if (result === "needs_force") {
      setPendingForce({ from, to, ttId, name });
    }
    setMoving(false);
  };

  const confirmForceMove = async () => {
    if (!pendingForce) return;
    setMoving(true);
    const result = await doMove(pendingForce.from, pendingForce.to, pendingForce.ttId, true);
    setPendingForce(null);
    if (result === "ok") {
      toast.success(`${pendingForce.name} moved.`);
      await fetchRosters();
    }
    setMoving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" /> Loading group rosters…
        </CardContent>
      </Card>
    );
  }
  // Nothing to move (solo event, unseeded, or no groups with teams) → render nothing.
  if (stages.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconArrowsMove size={18} className="text-primary" />
          Move teams between groups
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Drag a team from one group into another. If the team already has results in its current
          group, you&apos;ll be asked to confirm (those results stay with the old group).
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {stages.map((stage) => (
            <div key={stage.stage_id} className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {stage.stage_name}
              </p>
              <div className="flex flex-wrap gap-3">
                {stage.groups
                  .filter((g) => Array.isArray(g.teams))
                  .map((g) => (
                    <GroupColumn key={g.group_id} group={g} disabled={moving} />
                  ))}
              </div>
            </div>
          ))}
          <DragOverlay>
            {activeTeam ? (
              <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs shadow-lg">
                <IconGripVertical size={13} className="text-muted-foreground" />
                {/* Flag beside the team name on the drag overlay (team's country). */}
                <CountryFlag country={activeTeam.team_country} className="shrink-0" />
                <span className="capitalize">{activeTeam.team_name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {moving && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconLoader2 className="size-3 animate-spin" /> Moving…
          </p>
        )}
      </CardContent>

      {/* Results guard: the team has entered results in its current group. */}
      <AlertDialog open={!!pendingForce} onOpenChange={(o) => !o && setPendingForce(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {pendingForce?.name} anyway?</AlertDialogTitle>
            <AlertDialogDescription>
              This team already has results entered in its current group. Moving it leaves those
              results in the old group&apos;s standings. Move anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmForceMove();
              }}
              disabled={moving}
            >
              Move anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
