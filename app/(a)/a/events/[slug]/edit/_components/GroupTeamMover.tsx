"use client";

// ── GroupTeamMover (F2, owner 2026-06-19; remove controls owner 2026-07-06) ─────────────────────
// Drag-and-drop a TEAM from one group into another within a stage, AND remove a team from a group or
// a whole stage. Self-contained on purpose: it owns its OWN @dnd-kit DndContext and reads team ids
// from the group-rosters endpoint, so it never entangles with the form-driven stage/group REORDER DnD
// that lives in StagesGroupsTab.
//
// FLOW
//   1. POST /events/get-event-group-rosters/ { event_id } → stage → group → teams[{tournament_team_id,
//      team_id, team_name}]. (Team events only; the move/remove endpoints key on tournament_team_id.)
//   2. Each group renders as a droppable column of draggable team chips; each chip has a small ✕ that
//      opens a Remove dialog (remove from THIS group, or from the whole STAGE).
//   3. On drop into a DIFFERENT group → POST /events/seeding/move-team/ {from_group_id, to_group_id,
//      tournament_team_id}. The backend returns 409 { requires_force } when the team already has
//      entered results in the source group; we show a confirm dialog and retry with force=true.
//   4. Remove → POST /events/seeding/remove-from-group/ {group_id, tournament_team_id} OR
//      /events/seeding/remove-from-stage/ {stage_id, tournament_team_id}. The backend HARD-BLOCKS
//      (400) a team that already has entered match results (no force) - we surface that message.
//   5. On success → refetch rosters (in place) + toast.
//
// Mounted by StagesGroupsTab for team (duo/squad) events. Admin + organizer both reach it (the
// backend gate is org-aware: AFC admin OR can_manage_registrations). Round-robin stages ARE shown
// (since 2026-07-03): their zones are the base groups (A/B/C) + an "Unassigned" seeded pool whose
// group_id is the string "rr-unassigned-<stage_id>". A pooled team is stage-seeded but ungrouped, so
// its Remove dialog offers only "remove from stage" (there is no group to leave).

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
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
import { Button } from "@/components/ui/button";
import { IconGripVertical, IconLoader2, IconArrowsMove, IconX } from "@tabler/icons-react";
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
  is_round_robin?: boolean; // RR stages ARE shown (base groups + Unassigned pool).
  groups: RosterGroup[];
}

// The team a Remove dialog is acting on. isPool = the RR "Unassigned" pool (no group to leave, so
// only "remove from stage" is offered).
interface PendingRemove {
  stageId: number;
  groupId: number | string;
  ttId: number;
  name: string;
  isPool: boolean;
}

// A draggable team chip. id encodes the source group + team so onDragEnd knows what moved. The ✕
// button stops pointer/drag propagation so clicking it never starts a drag.
function TeamChip({
  groupId,
  team,
  disabled,
  canMove,
  onMove,
  onRemove,
}: {
  groupId: number | string;
  team: RosterTeam;
  disabled: boolean;
  // canMove = this stage has another group/pool to move INTO, so the tap-move button is worth showing.
  canMove: boolean;
  onMove: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("evEditTabs");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `t:${groupId}:${team.tournament_team_id}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-card px-2 py-2 text-xs select-none group/chip",
        isDragging && "opacity-40",
      )}
    >
      {/* Only the grip area is the drag handle, so the ✕ button stays independently clickable. */}
      <span
        {...listeners}
        {...attributes}
        className="flex items-center gap-1.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
        title={t("groupMover.dragToMove")}
      >
        <IconGripVertical size={13} className="text-muted-foreground shrink-0" />
        {/* Flag beside the team name on the draggable chip (team's country). */}
        <CountryFlag country={team.team_country} className="shrink-0" />
        <span className="capitalize truncate">{team.team_name}</span>
      </span>
      {/* Tap-to-move (owner 2026-07-06): the reliable path on phones where press-hold-drag is fiddly.
          Hidden when the stage has no other group to move into. stopPropagation on pointerdown so a tap
          here never starts a drag. On desktop it's just a click alternative to dragging. */}
      {canMove && (
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
          title={t("groupMover.moveToAnotherGroup")}
          className="shrink-0 rounded p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          <IconArrowsMove size={13} />
        </button>
      )}
      <button
        type="button"
        disabled={disabled}
        // Stop the pointer event reaching the dnd sensor so the ✕ never begins a drag.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title={t("groupMover.removeTeam")}
        className="shrink-0 rounded p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
      >
        <IconX size={13} />
      </button>
    </div>
  );
}

// A droppable group column. Highlights when a chip is dragged over it. `disabled` freezes its chips
// while a mutation is in flight so a second action can't fire against now-stale group membership.
function GroupColumn({
  group,
  disabled,
  canMove,
  onMove,
  onRemove,
}: {
  group: RosterGroup;
  disabled: boolean;
  canMove: boolean;
  onMove: (team: RosterTeam) => void;
  onRemove: (team: RosterTeam) => void;
}) {
  const t = useTranslations("evEditTabs");
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
          <p className="italic text-xs text-muted-foreground py-2">{t("groupMover.dropHere")}</p>
        ) : (
          teams.map((t) => (
            <TeamChip
              key={t.tournament_team_id}
              groupId={group.group_id}
              team={t}
              disabled={disabled}
              canMove={canMove}
              onMove={() => onMove(t)}
              onRemove={() => onRemove(t)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function GroupTeamMover({ eventId }: { eventId: number }) {
  const t = useTranslations("evEditTabs");
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
  // Pending remove-from-group / remove-from-stage confirm.
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  // Pending tap-to-move: the team + the candidate groups it can move INTO (the phone-friendly, no-drag
  // path - owner 2026-07-06). candidates = the OTHER zones in the same stage (groups + RR pool).
  const [pendingMove, setPendingMove] = useState<{
    fromGroupId: number | string;
    ttId: number;
    name: string;
    candidates: { group_id: number | string; group_name: string }[];
  } | null>(null);

  // Mobile fix (owner 2026-07-06): plain pointer-drag felt broken on phones because every drag
  // attempt was read as a page SCROLL. Now split by input type - MouseSensor (8px activation, so a
  // click isn't a drag) for desktop; TouchSensor with a 180ms press-and-hold so a quick swipe still
  // SCROLLS while a deliberate hold starts the drag. The per-chip "move" button below is the tap-only
  // fallback for anyone who'd rather not drag on a small screen at all.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const fetchRosters = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-group-rosters/`,
        { event_id: eventId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
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
        toast.error(e?.response?.data?.message || t("groupMover.toastMoveFailed"));
        return "error" as const;
      });
    return res;
  };

  // POST a remove (group or stage scope). The backend hard-blocks (400) a team with entered results;
  // we surface that message. Returns "ok" | "error".
  const doRemove = async (scope: "group" | "stage", pr: PendingRemove) => {
    const url =
      scope === "group"
        ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/remove-from-group/`
        : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/remove-from-stage/`;
    const body =
      scope === "group"
        ? { group_id: pr.groupId, tournament_team_id: pr.ttId }
        : { stage_id: pr.stageId, tournament_team_id: pr.ttId };
    return axios
      .post(url, body, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => "ok" as const)
      .catch((e) => {
        toast.error(e?.response?.data?.message || t("groupMover.toastRemoveFailed"));
        return "error" as const;
      });
  };

  const runRemove = async (scope: "group" | "stage") => {
    if (!pendingRemove) return;
    const pr = pendingRemove;
    setPendingRemove(null);
    setMoving(true);
    const result = await doRemove(scope, pr);
    if (result === "ok") {
      toast.success(
        scope === "group"
          ? t("groupMover.toastRemovedFromGroup", { name: pr.name })
          : t("groupMover.toastRemovedFromStage", { name: pr.name }),
      );
      await fetchRosters();
    }
    setMoving(false);
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
      toast.success(t("groupMover.toastMoved", { name }));
      await fetchRosters(); // await so the tree is fresh before chips re-enable (no stale re-drag)
    } else if (result === "needs_force") {
      setPendingForce({ from, to, ttId, name });
    }
    setMoving(false);
  };

  // Tap-to-move: run the move into the chosen candidate group. Reuses doMove + the SAME force-confirm
  // flow drag uses, so the results guard behaves identically whether you drag or tap.
  const runMove = async (toGid: number | string) => {
    if (!pendingMove) return;
    const pm = pendingMove;
    setPendingMove(null);
    setMoving(true);
    const result = await doMove(pm.fromGroupId, toGid, pm.ttId, false);
    if (result === "ok") {
      toast.success(t("groupMover.toastMoved", { name: pm.name }));
      await fetchRosters();
    } else if (result === "needs_force") {
      setPendingForce({ from: pm.fromGroupId, to: toGid, ttId: pm.ttId, name: pm.name });
    }
    setMoving(false);
  };

  const confirmForceMove = async () => {
    if (!pendingForce) return;
    setMoving(true);
    const result = await doMove(pendingForce.from, pendingForce.to, pendingForce.ttId, true);
    setPendingForce(null);
    if (result === "ok") {
      toast.success(t("groupMover.toastMoved", { name: pendingForce.name }));
      await fetchRosters();
    }
    setMoving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" /> {t("groupMover.loading")}
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
          {t("groupMover.cardTitle")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("groupMover.help")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {stages.map((stage) => {
            // Zones = this stage's droppable columns (groups + the RR "Unassigned" pool). canMove is
            // true when there is somewhere ELSE to send a team, which gates the per-chip move button.
            const zones = stage.groups.filter((g) => Array.isArray(g.teams));
            const canMove = zones.length > 1;
            return (
              <div key={stage.stage_id} className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {stage.stage_name}
                </p>
                <div className="flex flex-wrap gap-3">
                  {zones.map((g) => (
                    <GroupColumn
                      key={g.group_id}
                      group={g}
                      disabled={moving}
                      canMove={canMove}
                      onMove={(team) =>
                        setPendingMove({
                          fromGroupId: g.group_id,
                          ttId: team.tournament_team_id,
                          name: team.team_name,
                          // Candidate targets = every OTHER zone in this stage.
                          candidates: zones
                            .filter((z) => String(z.group_id) !== String(g.group_id))
                            .map((z) => ({ group_id: z.group_id, group_name: z.group_name })),
                        })
                      }
                      onRemove={(team) =>
                        setPendingRemove({
                          stageId: stage.stage_id,
                          groupId: g.group_id,
                          ttId: team.tournament_team_id,
                          name: team.team_name,
                          isPool: typeof g.group_id === "string", // RR "Unassigned" pool
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
            <IconLoader2 className="size-3 animate-spin" /> {t("groupMover.working")}
          </p>
        )}
      </CardContent>

      {/* Results guard: the team has entered results in its current group (move). */}
      <AlertDialog open={!!pendingForce} onOpenChange={(o) => !o && setPendingForce(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupMover.forceTitle", { name: pendingForce?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("groupMover.forceBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moving}>{t("groupMover.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmForceMove();
              }}
              disabled={moving}
            >
              {t("groupMover.moveAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove: from this group (leaves the team stage-seeded) or from the whole stage. A pooled
          (Unassigned) team is not in any group, so only "remove from stage" is offered. */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupMover.removeTitle", { name: pendingRemove?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove?.isPool
                ? t("groupMover.removeBodyPool")
                : t("groupMover.removeBodyGroup")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={moving}>{t("groupMover.cancel")}</AlertDialogCancel>
            {!pendingRemove?.isPool && (
              <Button
                variant="outline"
                disabled={moving}
                onClick={(e) => {
                  e.preventDefault();
                  runRemove("group");
                }}
              >
                {t("groupMover.removeFromGroup")}
              </Button>
            )}
            <Button
              variant="destructive"
              disabled={moving}
              onClick={(e) => {
                e.preventDefault();
                runRemove("stage");
              }}
            >
              {t("groupMover.removeFromStage")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tap-to-move picker (owner 2026-07-06): the no-drag path. Lists every other group/pool in the
          stage as a big tappable target - comfortable on a phone. Move itself reuses the drag path's
          endpoint + results-guard (runMove -> doMove), so behaviour is identical either way. */}
      <AlertDialog open={!!pendingMove} onOpenChange={(o) => !o && setPendingMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groupMover.moveTitle", { name: pendingMove?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("groupMover.moveChooseGroup")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-2">
            {pendingMove?.candidates.map((c) => (
              <Button
                key={String(c.group_id)}
                variant="outline"
                disabled={moving}
                className="justify-start capitalize h-10"
                onClick={(e) => {
                  e.preventDefault();
                  runMove(c.group_id);
                }}
              >
                {c.group_name}
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moving}>{t("groupMover.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
