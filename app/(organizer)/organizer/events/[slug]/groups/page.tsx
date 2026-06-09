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

import React, { use, useEffect, useState } from "react";
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
import { IconLock, IconTrophy, IconSearch } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { useOrganizer } from "../../../_components/OrganizerContext";

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
  useEffect(() => {
    if (!canView || notMine || resolving) return;
    const load = async () => {
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
    };
    load();
  }, [routeSlug, token, canView, notMine, resolving]);

  // ── IGN filter helpers (same logic as the admin GroupRostersPanel) ────────────
  const query = search.trim().toLowerCase();
  const playerMatches = (p: RosterPlayer) =>
    !query ||
    (p.username ?? "").toLowerCase().includes(query) ||
    (p.full_name ?? "").toLowerCase().includes(query) ||
    (p.uid ?? "").toLowerCase().includes(query);
  const teamMatches = (t: RosterTeam) =>
    !query ||
    (t.team_name ?? "").toLowerCase().includes(query) ||
    (t.team_tag ?? "").toLowerCase().includes(query) ||
    (t.players ?? []).some(playerMatches);

  // ── Gate + loading states (mirror the leaderboard page order) ─────────────────

  // Permission gate first (no fetches happen without it).
  if (!canView) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Groups & Rosters" back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconLock className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              You do not have permission to view rosters for this organization.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">Back to events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resolving) return <FullLoader text="Loading event..." />;

  // The slug didn't resolve to one of THIS org's events.
  if (notMine) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Groups & Rosters" back />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconTrophy className="size-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              We couldn&apos;t find this event under your organization. You can
              only view rosters for your own events.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/organizer/events">Back to events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <FullLoader text="Loading rosters..." />;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <PageHeader
        back
        title="Groups & Rosters"
        description={
          data
            ? `${data.event_name} • ${
                data.is_solo ? "Solo" : "Team"
              } event • ${data.stages.length} ${
                data.stages.length === 1 ? "stage" : "stages"
              }`
            : undefined
        }
      />

      {/* IGN search: filters teams + players live for the "who is in which group"
          lookup done during a running event. */}
      <div className="relative max-w-sm">
        <IconSearch className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by IGN, team, or UID"
          className="pl-8"
        />
      </div>

      {/* Empty event (no stages at all). */}
      {(!data || data.stages.length === 0) && (
        <p className="text-muted-foreground italic">
          No stages defined for this event yet.
        </p>
      )}

      {/* Per stage → a Card; inside, a grid of per-group cards. */}
      {data?.stages.map((stage) => (
        <Card key={stage.stage_id} className="bg-card rounded-md border">
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
                No groups yet, seed this stage first.
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
                        <span className="text-muted-foreground text-xs">
                          {data.is_solo
                            ? `${group.player_count} players`
                            : `${group.team_count} teams`}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 space-y-2">
                      {data.is_solo ? (
                        // ── SOLO group: one players table ──
                        players.length === 0 ? (
                          <p className="text-muted-foreground italic text-xs">
                            No players yet.
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="h-10">
                                <TableHead className="text-foreground text-xs p-2">
                                  IGN
                                </TableHead>
                                <TableHead className="text-foreground text-xs p-2">
                                  UID
                                </TableHead>
                                <TableHead className="text-foreground text-xs p-2">
                                  Status
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
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )
                      ) : // ── TEAM group: a sub-card per team with a players table ──
                      teams.length === 0 ? (
                        <p className="text-muted-foreground italic text-xs">
                          No teams yet.
                        </p>
                      ) : (
                        teams.map((team) => (
                          <Card
                            key={team.tournament_team_id}
                            className="bg-card gap-0"
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="flex items-center justify-between gap-2 flex-wrap text-sm">
                                <span>
                                  {team.team_name}
                                  {team.team_tag ? ` (${team.team_tag})` : ""}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="capitalize rounded-full px-2 py-0.5 text-xs"
                                >
                                  {team.competitor_status}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {team.players.length === 0 ? (
                                <p className="text-muted-foreground italic text-xs">
                                  No players yet.
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-10">
                                      <TableHead className="text-foreground text-xs p-2">
                                        IGN
                                      </TableHead>
                                      <TableHead className="text-foreground text-xs p-2">
                                        UID
                                      </TableHead>
                                      <TableHead className="text-foreground text-xs p-2">
                                        Status
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
    </div>
  );
}
