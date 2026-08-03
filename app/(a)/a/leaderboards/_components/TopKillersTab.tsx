"use client";

// ── TopKillersTab (owner 2026-07-05, complaint H) ────────────────────────────────
// The "Top Killers" tab on the event leaderboard edit page (admin) and the organizer event-leaderboard
// page. A READ-ONLY ranking of players by SUMMED KILLS across the event (or a COMBINED selection of
// whole stages + individual groups). Sibling of MvpTab.tsx: same layout, same scope + Download bar
// (PlayerBoardControls), but ranked by kills (ties fall to damage then assists) instead of per-map MVPs.
//
// CONNECTS TO: GET events/<event_id>/top-killers/?group_ids=&stage_ids= (afc_tournament_and_scrims/
// views_mvp.py, compute_top_killers). Gate = _broadcast_gate (AFC event admin OR org can_edit_events),
// the SAME gate MvpTab / the MVP endpoint use. Mounted by app/(a)/a/leaderboards/[id]/edit/page.tsx
// (TabsContent value="top_killers") and the organizer leaderboard page. Admin surface - English, matching
// the MvpTab convention (a reused admin component keeps its English copy on the organizer page too).
//
// This board + the MVP board share ONE overlay renderer (the "mvp" / "top_killers" branches in
// app/overlay/view/[token]/[overlayId]/page.tsx), which reuses the leaderboard combine/render path.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
// Live refresh (owner 2026-07-02, matching MvpTab): site-wide heartbeat re-pulls the read-only ranking.
import { useLiveTick } from "@/hooks/useLiveTick";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconLoader2, IconTargetArrow } from "@tabler/icons-react";
// Client for the top-killers endpoint (lib/overlay.ts). Same PlayerRankingRow shape MvpTab consumes.
import { fetchTopKillers, type PlayerRankingRow } from "@/lib/overlay";
// Shared scope (whole event / combine) + "Download through a design" bar. See PlayerBoardControls.
import { PlayerBoardControls } from "./PlayerBoardControls";

export default function TopKillersTab({
  eventId,
  // organizationId scopes the Download dialog's design library (null = AFC-native). Passed by the admin
  // editor (eventData.organization_id) and the organizer page (their org id). Mirrors MvpTab.
  organizationId = null,
}: {
  eventId: number | string;
  organizationId?: number | null;
}) {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<PlayerRankingRow[]>([]);
  // COMBINE scope held in a ref so `load` stays stable; a scope change re-fetches in the background.
  const scopeRef = useRef<{ groupIds: number[]; stageIds: number[] }>({
    groupIds: [],
    stageIds: [],
  });
  const scopeInit = useRef(false);

  // Load the ranking over the current combine scope. `background` (a tick / scope-change refresh) skips
  // the spinner + error toast, so a heartbeat never flashes the panel - mirrors MvpTab's load().
  const load = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      try {
        const s = scopeRef.current;
        const res = await fetchTopKillers(eventId, {
          groupIds: s.groupIds,
          stageIds: s.stageIds,
        });
        setPlayers(res.players ?? []);
      } catch (err: any) {
        if (!background) {
          toast.error(
            err?.response?.data?.message || "Could not load the top killers.",
          );
        }
      } finally {
        if (!background) setLoading(false);
      }
    },
    [eventId],
  );

  // Site-wide heartbeat: re-pull the ranking in the background (tick 0 = the normal first load).
  const tick = useLiveTick();
  useEffect(() => {
    load(tick > 0);
  }, [tick, load]);

  // Scope reported up from PlayerBoardControls. The first call is the initial whole-event selection,
  // already covered by the mount load, so it is skipped; later changes re-fetch in the background.
  const handleScope = useCallback(
    (s: { groupIds: number[]; stageIds: number[] }) => {
      scopeRef.current = s;
      if (!scopeInit.current) {
        scopeInit.current = true;
        return;
      }
      load(true);
    },
    [load],
  );

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <IconLoader2 className="size-4 animate-spin" />
        Loading top killers...
      </div>
    );
  }

  const top = players[0];

  return (
    <div className="space-y-4">
      {/* ── Scope + Download the board through a design (owner 2026-07-05, complaint H). ── */}
      <PlayerBoardControls
        eventId={eventId}
        organizationId={organizationId}
        kind="top_killers"
        onScopeChange={handleScope}
      />

      <Card className="overflow-hidden p-0">
        {/* Headline: the top killer. */}
        {top ? (
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              {top.esports_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={top.esports_image}
                  alt=""
                  className="size-12 rounded-md border object-cover"
                />
              ) : null}
              <div>
                <p className="text-gold flex items-center gap-1.5 text-sm font-bold">
                  <IconTargetArrow className="size-4" />
                  Top killer: {top.in_game_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {top.team_name ? `${top.team_name} · ` : ""}
                  <b>{top.kills} kills</b> · {top.damage} damage · {top.assists} assists ·{" "}
                  {top.matches} matches
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {players.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center text-sm">
            No player match stats recorded for this event yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground h-10 p-2">#</TableHead>
                <TableHead className="text-foreground h-10 p-2">Player</TableHead>
                <TableHead className="text-foreground h-10 p-2">Team</TableHead>
                <TableHead className="text-foreground h-10 p-2 text-center">Kills</TableHead>
                <TableHead className="text-foreground h-10 p-2 text-center">Damage</TableHead>
                <TableHead className="text-foreground h-10 p-2 text-center">Assists</TableHead>
                <TableHead className="text-foreground h-10 p-2 text-center">Matches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p, i) => (
                <TableRow key={p.user_id} className="text-xs">
                  <TableCell className={`p-2 font-bold ${i === 0 ? "text-gold" : ""}`}>
                    #{i + 1}
                  </TableCell>
                  <TableCell className="p-2">{p.in_game_name}</TableCell>
                  <TableCell className="p-2">{p.team_name || "-"}</TableCell>
                  <TableCell className={`p-2 text-center font-bold ${i === 0 ? "text-gold" : ""}`}>
                    {p.kills}
                  </TableCell>
                  <TableCell className="p-2 text-center">{p.damage}</TableCell>
                  <TableCell className="p-2 text-center">{p.assists}</TableCell>
                  <TableCell className="p-2 text-center">{p.matches}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {players.length > 0 ? (
          <div className="border-t p-3">
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
              Ranked by total kills (ties fall to damage, then assists)
            </Badge>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
