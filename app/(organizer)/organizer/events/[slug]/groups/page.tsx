// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Events › [slug] › Groups & Rosters.
//
// LIVE-EVENT SEEDING CHECK. Shows, for one of the org's events, the full tree
// stage → group → teams → players (or, for solo events, stage → group → players).
// Purpose: during a running tournament an organizer (or AFC admin) can confirm WHO
// is in WHICH group at a glance, and look a single in-game name up fast with the
// IGN search box.
//
// ── DATA SOURCE ──
//   POST ${NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-group-rosters/ with
//   { slug } and header Authorization: Bearer <token>. That endpoint
//   (afc_tournament_and_scrims.views.get_event_group_rosters) gates on AFC event
//   admin OR org can_manage_registrations, and returns:
//     { event_id, event_name, participant_type, is_solo, stages: [
//        { stage_id, stage_name, stage_format, stage_status, groups: [
//           team events:  { group_name, team_count, player_count, teams: [
//              { team_name, team_tag, competitor_status, players: [
//                 { user_id, username (IGN), uid, full_name, status } ] } ] }
//           solo events:  { group_name, player_count, players: [ ...same player… ] }
//        ] } ] }
//   An unseeded stage/group comes back with teams: [] / players: [] (never an
//   error), so we render a "not yet seeded" state instead of failing.
//
// ── STRUCTURE (mirrors the sibling leaderboard page) ──
//   'use client'; slug unwrapped via React `use(params)`; token from useAuth();
//   { membership, isOwner } from useOrganizer(). Gated on
//   can_manage_registrations || isOwner — the SAME permission the backend enforces
//   and the SAME gate the events-list "Groups & Rosters" button uses. A member
//   without it gets the IconLock lock-card the leaderboard page shows.
//
//   slug → event: we confirm the slug is one of THIS org's events via
//   GET /events/get-all-events/?organization_id=<id> (the "notMine" guard the
//   leaderboard page uses), then POST the rosters endpoint with { slug }.
//
// ── CONSUMED BY / CONNECTS TO ──
//   Linked from app/(organizer)/organizer/events/page.tsx (the "Groups & Rosters"
//   row action). The admin equivalent is the "Group Rosters" tab on
//   app/(a)/a/events/[slug]/page.tsx, which renders the same tree from the same
//   endpoint (posting { event_id } instead of { slug }).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconLock, IconTrophy, IconSearch, IconTrash } from "@tabler/icons-react";
import { env } from "@/lib/env";
// Team country flag beside each team name in the organizer group-roster tree (owner 2026-07-03).
// team_country rides on each team from get_event_group_rosters (_team_payload). Mirrors the admin
// events group tab. CountryFlag renders nothing when the value is blank/unresolvable.
import { CountryFlag } from "@/lib/countryFlag";
import { matchesSearch } from "@/lib/search";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { useOrganizer } from "../../../_components/OrganizerContext";
// ── ORGANIZER PARITY F1 (owner 2026-07-04): the SAME manual group-management controls AFC admins
// already have on the event-edit "Stages & Groups" tab, surfaced here for an organizer's OWN events.
// All three are the SHARED admin components, reused verbatim (never rebuilt) so behaviour + backend
// wiring stay identical to the admin surface:
//   • GroupTeamMover  — drag a team between a stage's groups. Self-contained DnD; POSTs
//                       /events/seeding/move-team/ (org-inclusive via seeding_management._seeding_gate).
//   • AddTeamsModal   — add already-registered teams straight into ONE group (mode="group" -> POST
//                       /events/add-teams-to-group/, org-inclusive since 2026-07-02).
//   • RemoveTeamModal — remove a team from the event entirely (POST /events/remove-team-from-event/,
//                       org-inclusive via _resolve_event_team; backend blocks once results exist).
// Gate: this page only renders past the canView guard (can_manage_registrations || isOwner), which is
// the EXACT permission each of those backend endpoints enforces, so no extra front-end gating is
// needed. The admin wiring these mirror lives in .../events/[slug]/edit/_components/StagesGroupsTab.tsx.
import GroupTeamMover from "@/app/(a)/a/events/[slug]/edit/_components/GroupTeamMover";
import { AddTeamsModal } from "@/app/(a)/a/events/_components/AddTeamsModal";
import { RemoveTeamModal } from "@/app/(a)/a/events/_components/RemoveTeamModal";
// SOLO manual seeding (owner 2026-07-06): add-teams-* are team-only, so solo events get their own
// add modal + per-player remove. AddSoloPlayersModal is the shared admin component (English, like
// AddTeamsModal); the per-row remove button + its dialog live here and ARE i18n'd (organizer surface).
// Backend: seeding_management.add_solo_players_to_group/_to_stage + remove_competitor_from_group/_stage.
import { AddSoloPlayersModal } from "@/app/(a)/a/events/_components/AddSoloPlayersModal";

type Params = { slug: string };

// ── Roster response shape (mirror of the backend get_event_group_rosters payload).
// username is the in-game name (IGN). is_solo decides teams[] vs players[]. ──
interface RosterPlayer {
  user_id: number;
  username: string; // the IGN
  uid: string | null; // nullable game UID
  full_name: string;
  status: string;
  competitor_status?: string; // solo only
}
interface RosterTeam {
  tournament_team_id: number;
  team_id: number;
  team_name: string;
  // The team's auto-derived country (get_event_group_rosters _team_payload); drives the flag.
  team_country?: string | null;
  team_tag: string | null;
  competitor_status: string;
  players: RosterPlayer[];
}
interface RosterGroup {
  group_id: number;
  group_name: string;
  teams_qualifying?: number | null;
  team_count: number;
  player_count: number;
  total_in_group: number;
  teams?: RosterTeam[];
  players?: RosterPlayer[];
}
interface RosterStage {
  stage_id: number;
  stage_name: string;
  stage_format: string;
  stage_status: string;
  groups: RosterGroup[];
}
interface EventGroupRosters {
  event_id: number;
  event_name: string;
  participant_type: string;
  is_solo: boolean;
  stages: RosterStage[];
}

export default function OrganizerEventGroupsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug: routeSlug } = use(params);
  const t = useTranslations("organizer");
  const { token } = useAuth();
  const { membership, isOwner } = useOrganizer();

  // The org permission the backend enforces for this read. Same gate the events-list
  // "Groups & Rosters" button + the backend endpoint use.
  const canView =
    membership.permissions.can_manage_registrations || isOwner;
  const organizationId = membership.organization.organization_id;

  // ── slug → event resolution state (same pattern as the leaderboard page) ──
  // resolving: still confirming the slug belongs to this org.
  // notMine: the slug is NOT one of this org's events (or none matched).
  const [resolving, setResolving] = useState(true);
  const [notMine, setNotMine] = useState(false);

  // ── Roster state ──
  const [data, setData] = useState<EventGroupRosters | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ── 1) Confirm the slug is one of THIS org's events ───────────────────────────
  // Scope get-all-events by organization_id and match the route slug. A slug not in
  // this list is treated as notMine — an org can only view its own events' rosters.
  useEffect(() => {
    if (!canView) {
      setResolving(false);
      return;
    }
    const resolve = async () => {
      setResolving(true);
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/?organization_id=${organizationId}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        const json = await res.json();
        const match = (json.events ?? []).find(
          (e: any) => e.slug === routeSlug,
        );
        if (!match) {
          setNotMine(true);
        }
      } catch {
        // A failed resolution is treated as "not yours" rather than crashing.
        setNotMine(true);
      } finally {
        setResolving(false);
      }
    };
    resolve();
  }, [routeSlug, organizationId, token, canView]);

  // ── 2) Load the group rosters for the resolved event ──────────────────────────
  // POSTs { slug } (the backend accepts slug or event_id; the organizer FE sends
  // slug to match the rest of /organizer/events/*). Never errors the page on failure
  // — leaves an empty state so a partially-seeded event still renders.
  // Extracted from the load effect so the F1 group-management controls below can re-pull the tree in
  // place after a mutation (AddTeamsModal / RemoveTeamModal onSuccess). Flipping `loading` briefly also
  // remounts the GroupTeamMover (which owns a SEPARATE fetch), so an add/remove is reflected there too.
  const loadRosters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-group-rosters/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ slug: routeSlug }),
        },
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to load group rosters for", routeSlug, err);
    } finally {
      setLoading(false);
    }
  }, [routeSlug, token]);

  useEffect(() => {
    if (!canView || notMine || resolving) return;
    loadRosters();
  }, [canView, notMine, resolving, loadRosters]);

  // ── SOLO per-player remove (owner 2026-07-06) ─────────────────────────────────────────────────
  // A solo player row can be pulled out of just its group or the whole stage. The backend
  // (seeding_management.remove_competitor_from_group / _from_stage) HARD-BLOCKS a player who already
  // has entered match results (400 + message) so real stats are never orphaned — we surface that.
  // Solo rows only carry user_id (the roster payload has no competitor id), so we send user_id; the
  // endpoint resolves it to the RegisteredCompetitors within this event.
  const [pendingSoloRemove, setPendingSoloRemove] = useState<{
    groupId: number;
    stageId: number;
    userId: number;
    name: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  const removeSolo = async (scope: "group" | "stage") => {
    if (!pendingSoloRemove) return;
    const pr = pendingSoloRemove;
    setPendingSoloRemove(null);
    setRemoving(true);
    try {
      const url =
        scope === "group"
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/remove-from-group/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/seeding/remove-from-stage/`;
      const body =
        scope === "group"
          ? { group_id: pr.groupId, user_id: pr.userId }
          : { stage_id: pr.stageId, user_id: pr.userId };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.message || t("groups.removeFailed"));
      } else {
        toast.success(
          scope === "group"
            ? t("groups.playerRemovedFromGroup", { name: pr.name })
            : t("groups.playerRemovedFromStage", { name: pr.name }),
        );
        loadRosters();
      }
    } catch {
      toast.error(t("groups.removeFailed"));
    } finally {
      setRemoving(false);
    }
  };

  // ── IGN filter helpers (same logic as the admin GroupRostersPanel) ────────────
  // Use the shared matchesSearch() helper instead of raw .toLowerCase().includes so
  // the IGN box is punctuation/space/accent-insensitive and folds "fancy font"
  // unicode: typing "ve" finds a stylized name like "V-E" / "Ｖ-Ｅ" / "ᴠᴇ". The
  // helper returns true on an empty query, so the old !query short-circuit is built in.
  const query = search;
  // Player match across IGN (username), full name, and game UID in one call.
  const playerMatches = (p: RosterPlayer) =>
    matchesSearch([p.username, p.full_name, p.uid], query);
  // Team match across team name + tag, OR any player on the team matching.
  const teamMatches = (t: RosterTeam) =>
    matchesSearch([t.team_name, t.team_tag], query) ||
    (t.players ?? []).some(playerMatches);

  // ── Gate + loading states (mirror the leaderboard page order) ─────────────────

  // Permission gate first (no fetches happen without it).
  if (!canView) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("groups.title")} back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("groups.lock.noPermission")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">{t("groups.backToEvents")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resolving) return <FullLoader text={t("groups.loadingEvent")} />;

  // The slug didn't resolve to one of THIS org's events.
  if (notMine) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t("groups.title")} back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconTrophy className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("groups.notMine")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">{t("groups.backToEvents")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <FullLoader text={t("groups.loadingRosters")} />;

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* data-tour anchor: PageHeader does not forward props to the DOM, so wrap it. */}
      <div data-tour="org-event-groups-title">
        <PageHeader
          back
          title={t("groups.title")}
          description={
            data
              ? t("groups.description", {
                  event: data.event_name,
                  type: data.is_solo ? t("groups.solo") : t("groups.team"),
                  count: data.stages.length,
                  stageWord:
                    data.stages.length === 1
                      ? t("groups.stage")
                      : t("groups.stages"),
                })
              : undefined
          }
        />
      </div>

      {/* IGN search: filters teams + players live for the "who is in which group"
          lookup done during a running event. */}
      <div className="relative max-w-sm">
        <IconSearch className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          data-tour="org-event-groups-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("groups.searchPlaceholder")}
          className="pl-8"
        />
      </div>

      {/* ORGANIZER PARITY F1: drag a team from one of a stage's groups into another (team events only).
          The shared admin GroupTeamMover is self-contained: it does its own POST
          /events/get-event-group-rosters/ + /events/seeding/move-team/, so it needs only the event id. */}
      {data && !data.is_solo && <GroupTeamMover eventId={data.event_id} />}

      {/* Empty event (no stages at all). */}
      {(!data || data.stages.length === 0) && (
        <p className="text-muted-foreground italic">
          {t("groups.noStages")}
        </p>
      )}

      {/* Per stage → a Card; inside, a grid of per-group cards. */}
      {data?.stages.map((stage) => (
        <Card
          key={stage.stage_id}
          data-tour="org-event-groups-stages"
          className="bg-card rounded-md border"
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span>{stage.stage_name}</span>
              <Badge
                variant="outline"
                className="capitalize rounded-full px-2 py-0.5 text-xs"
              >
                {stage.stage_status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-2">
            {stage.groups.length === 0 ? (
              <p className="text-muted-foreground italic text-sm md:col-span-2">
                {t("groups.noGroups")}
              </p>
            ) : (
              stage.groups.map((group) => {
                const teams = (group.teams ?? []).filter(teamMatches);
                const players = (group.players ?? []).filter(playerMatches);
                return (
                  <Card key={group.group_id} className="bg-primary/10 gap-0">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                        <span>{group.group_name}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* ORGANIZER PARITY F1: add already-registered teams straight into THIS group.
                              Squad-events only, matching the admin StagesGroupsTab gate. onSuccess
                              re-pulls the whole tree so the new members show at once. */}
                          {!data.is_solo &&
                            data.participant_type === "squad" && (
                              <AddTeamsModal
                                mode="group"
                                targetId={group.group_id}
                                targetName={`${stage.stage_name} › ${group.group_name}`}
                                onSuccess={loadRosters}
                              />
                            )}
                          {/* SOLO events: hand-pick registered players into THIS group. Shared admin
                              modal (English), reused verbatim like AddTeamsModal above. */}
                          {data.is_solo && (
                            <AddSoloPlayersModal
                              mode="group"
                              eventId={data.event_id}
                              targetId={group.group_id}
                              stageId={stage.stage_id}
                              targetName={`${stage.stage_name} › ${group.group_name}`}
                              onSuccess={loadRosters}
                            />
                          )}
                          <span className="text-muted-foreground text-xs">
                            {data.is_solo
                              ? t("groups.playerCount", {
                                  count: group.player_count,
                                })
                              : t("groups.teamCount", {
                                  count: group.team_count,
                                })}
                          </span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-2">
                      {data.is_solo ? (
                        // ── SOLO group: one players table ──
                        players.length === 0 ? (
                          <p className="text-muted-foreground italic text-xs">
                            {t("groups.noPlayers")}
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="h-10">
                                <TableHead className="text-foreground text-xs p-2">
                                  {t("groups.table.ign")}
                                </TableHead>
                                <TableHead className="text-foreground text-xs p-2">
                                  {t("groups.table.uid")}
                                </TableHead>
                                <TableHead className="text-foreground text-xs p-2">
                                  {t("groups.table.status")}
                                </TableHead>
                                <TableHead className="p-2 w-8">
                                  <span className="sr-only">
                                    {t("groups.removePlayer")}
                                  </span>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {players.map((p) => (
                                <TableRow key={p.user_id}>
                                  <TableCell className="text-xs p-2 font-medium">
                                    {p.username}
                                  </TableCell>
                                  <TableCell className="text-xs p-2 text-muted-foreground">
                                    {p.uid || "-"}
                                  </TableCell>
                                  <TableCell className="text-xs p-2 capitalize">
                                    {p.status}
                                  </TableCell>
                                  {/* Per-player remove (from group or stage). Opens the confirm
                                      dialog defined at the bottom of the page. */}
                                  <TableCell className="p-2 text-right">
                                    <button
                                      type="button"
                                      title={t("groups.removePlayer")}
                                      onClick={() =>
                                        setPendingSoloRemove({
                                          groupId: group.group_id,
                                          stageId: stage.stage_id,
                                          userId: p.user_id,
                                          name: p.username,
                                        })
                                      }
                                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <IconTrash size={14} />
                                    </button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )
                      ) : // ── TEAM group: a sub-card per team with a players table ──
                      teams.length === 0 ? (
                        <p className="text-muted-foreground italic text-xs">
                          {t("groups.noTeams")}
                        </p>
                      ) : (
                        teams.map((team) => (
                          <Card
                            key={team.tournament_team_id}
                            className="bg-card gap-0"
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center justify-between gap-2 flex-wrap text-sm">
                                <span className="inline-flex items-center gap-1.5">
                                  {/* Flag beside the group-roster team name (team's country). */}
                                  <CountryFlag country={team.team_country} />
                                  {team.team_name}
                                  {team.team_tag ? ` (${team.team_tag})` : ""}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className="capitalize rounded-full px-2 py-0.5 text-xs"
                                  >
                                    {team.competitor_status}
                                  </Badge>
                                  {/* ORGANIZER PARITY F1: remove this team from the event entirely
                                      (frees the slot; the backend blocks it once the team has match
                                      results). Shared admin modal, reused as-is; onSuccess re-pulls
                                      the tree. */}
                                  <RemoveTeamModal
                                    team_id={team.team_id}
                                    event_id={data.event_id}
                                    name={team.team_name}
                                    showLabel
                                    onSuccess={loadRosters}
                                  />
                                </div>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {team.players.length === 0 ? (
                                <p className="text-muted-foreground italic text-xs">
                                  {t("groups.noPlayers")}
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-10">
                                      <TableHead className="text-foreground text-xs p-2">
                                        {t("groups.table.ign")}
                                      </TableHead>
                                      <TableHead className="text-foreground text-xs p-2">
                                        {t("groups.table.uid")}
                                      </TableHead>
                                      <TableHead className="text-foreground text-xs p-2">
                                        {t("groups.table.status")}
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {team.players.map((p) => (
                                      <TableRow key={p.user_id}>
                                        <TableCell className="text-xs p-2 font-medium">
                                          {p.username}
                                        </TableCell>
                                        <TableCell className="text-xs p-2 text-muted-foreground">
                                          {p.uid || "-"}
                                        </TableCell>
                                        <TableCell className="text-xs p-2 capitalize">
                                          {p.status}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
      ))}

      {/* SOLO remove confirm: pull the player from just this group, or from the whole stage. The
          backend blocks a player who already has entered results (surfaced as a toast). */}
      <AlertDialog
        open={!!pendingSoloRemove}
        onOpenChange={(o) => !o && setPendingSoloRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("groups.removeTitle", { name: pendingSoloRemove?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("groups.removePlayerDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={removing}>
              {t("groups.cancel")}
            </AlertDialogCancel>
            <Button
              variant="outline"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                removeSolo("group");
              }}
            >
              {t("groups.removeFromGroup")}
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                removeSolo("stage");
              }}
            >
              {t("groups.removeFromStage")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
