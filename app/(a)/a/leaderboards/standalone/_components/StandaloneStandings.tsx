"use client";

// ── StandaloneStandings ───────────────────────────────────────────────────────
// The computed-standings table for a standalone leaderboard. Pure presentational:
// it takes the `standings` array the backend already computed (GET
// /leaderboards/standalone/<id>/ -> detail.standings) and renders one row per
// participant. Real entities and ghosts look the same except for a small outline
// badge that flags ghosts (placeholder entities created inline, claimable later).
//
// Columns: Rank (#N) · Participant (+ real/ghost badge) · Played · Kills · Booyahs · Total.
// Sort order is decided server-side (effective_total -> booyahs -> kills -> last placement),
// so we render the array as-is and trust `row.rank`.
//
// CONSUMED BY:
//  - app/(a)/a/leaderboards/standalone/[id]/page.tsx            (the public-ish view page)
//  - app/(a)/a/leaderboards/standalone/create/_components/ReviewStep.tsx (wizard step 4 preview)
//
// Design: AFC table constants — text-xs cells, p-2 padding, h-10 header, text-foreground headers,
// rounded-md bordered Card wrapper, outline rounded-full badges.

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StandaloneStandingRow } from "@/lib/standaloneLeaderboards";

export function StandaloneStandings({
  standings,
}: {
  standings: StandaloneStandingRow[];
}) {
  if (!standings || standings.length === 0) {
    return (
      <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        No standings yet. Add participants and enter at least one map of results.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="h-10">
            <TableHead className="p-2 text-xs text-foreground">Rank</TableHead>
            <TableHead className="p-2 text-xs text-foreground">Participant</TableHead>
            <TableHead className="p-2 text-xs text-foreground text-center">Played</TableHead>
            <TableHead className="p-2 text-xs text-foreground text-center">Kills</TableHead>
            <TableHead className="p-2 text-xs text-foreground text-center">Booyahs</TableHead>
            <TableHead className="p-2 text-xs text-foreground text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((row) => (
            <TableRow key={row.participant.id}>
              {/* Rank shown as #N (AFC convention — hash, not a medal). */}
              <TableCell className="p-2 text-xs font-medium">#{row.rank}</TableCell>
              <TableCell className="p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.participant.name}</span>
                  {row.participant.is_ghost ? (
                    // Ghost = a placeholder entity created inline for someone not on the platform.
                    <Badge
                      variant="outline"
                      className="rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                    >
                      Ghost
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                    >
                      Real
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="p-2 text-xs text-center">{row.played_count}</TableCell>
              <TableCell className="p-2 text-xs text-center">{row.kills}</TableCell>
              <TableCell className="p-2 text-xs text-center">{row.booyahs}</TableCell>
              <TableCell className="p-2 text-xs text-right font-semibold">
                {row.total_points}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
