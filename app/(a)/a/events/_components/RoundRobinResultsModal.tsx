"use client";

// ── Round-Robin standings modal (sub-project B) ─────────────────────────────────
//
// Stage-level standings for a Battle-Royale Round-Robin stage. Calls
// POST /events/get-round-robin-standings/ { event_id, stage_id } which returns:
//   { groups, game_days:[{day, lobbies}], per_day:{ "<day>": [rows] }, cumulative:[rows] }
// Each standings row: { team_name, effective_total, total_kills, total_booyah, games_played }.
// The backend keeps the sort authoritative (effective_total + tiebreakers), so — like
// GroupResultModal — we render rows in server order and never re-sort here.
//
// A Cumulative ↔ Day segmented toggle (shadcn pill Tabs) switches between the
// across-the-stage table (default) and a single game-day's table. Reuses the same
// Table/Badge styling as GroupResultModal for design parity.

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { IconTrophy, IconLoader2 } from "@tabler/icons-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { toast } from "sonner";

// A single standings row as returned by the endpoint (raw points table — no crown).
interface StandingRow {
  team_name: string;
  effective_total: number;
  total_kills: number;
  total_booyah: number;
  games_played: number;
}

interface RoundRobinStandings {
  groups?: any[];
  game_days?: Array<{ day: number; lobbies?: any[] }>;
  per_day?: Record<string, StandingRow[]>;
  cumulative?: StandingRow[];
}

interface RoundRobinResultsModalProps {
  eventId: number;
  stageId: number;
  stageName: string;
  className?: string;
}

export const RoundRobinResultsModal = ({
  eventId,
  stageId,
  stageName,
  className,
}: RoundRobinResultsModalProps) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RoundRobinStandings | null>(null);
  // "cumulative" or a specific game-day key (the day number as a string).
  const [view, setView] = useState<"cumulative" | "day">("cumulative");
  const [activeDay, setActiveDay] = useState<string>("");

  const fetchStandings = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-round-robin-standings/`,
        { event_id: eventId, stage_id: stageId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload: RoundRobinStandings = response.data;
      setData(payload);
      // Default the day selector to the first day that has rows.
      const dayKeys = Object.keys(payload.per_day || {});
      if (dayKeys.length > 0) setActiveDay(dayKeys[0]);
    } catch (error: any) {
      toast.error("Failed to load round-robin standings");
    } finally {
      setLoading(false);
    }
  };

  // Fetch once when the modal mounts (cheap, single endpoint).
  useEffect(() => {
    if (stageId) fetchStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId]);

  // Rows for the active view — kept in server order (authoritative sort).
  const rows: StandingRow[] =
    view === "cumulative"
      ? data?.cumulative || []
      : data?.per_day?.[activeDay] || [];

  const dayKeys = Object.keys(data?.per_day || {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          type="button"
          size="sm"
          className={cn(className)}
        >
          Round-Robin Standings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <IconTrophy className="text-yellow-500" size={20} />
              Round-Robin Standings
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{stageName}</p>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <IconLoader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm text-muted-foreground">
              Loading standings...
            </p>
          </div>
        ) : (
          <>
            {/* Cumulative ↔ Day segmented toggle (shadcn pill Tabs). */}
            <div className="flex flex-wrap items-center gap-3">
              <Tabs
                value={view}
                onValueChange={(v) => setView(v as "cumulative" | "day")}
              >
                <TabsList>
                  <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
                  <TabsTrigger value="day" disabled={dayKeys.length === 0}>
                    Day
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Day picker — only relevant in the Day view. */}
              {view === "day" && dayKeys.length > 0 && (
                <Select value={activeDay} onValueChange={setActiveDay}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayKeys.map((day) => (
                      <SelectItem key={day} value={day}>
                        Game Day {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex-1 overflow-auto rounded-md border border-zinc-800">
              <Table>
                <TableHeader className="bg-zinc-950 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center w-20">Kills</TableHead>
                    <TableHead className="text-center w-20">Booyahs</TableHead>
                    <TableHead className="text-center w-20">Games</TableHead>
                    <TableHead className="text-center w-20">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((row, index) => (
                      <TableRow
                        key={`${row.team_name}-${index}`}
                        className="hover:bg-zinc-900/50"
                      >
                        <TableCell className="text-center font-bold">
                          #{index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.team_name}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.total_kills}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.total_booyah}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {row.games_played}
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {row.effective_total}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-32 text-center text-muted-foreground italic"
                      >
                        No standings yet for this view.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footnote: cumulative is a raw points table (no Champion-Point crown —
                that still applies per-lobby, see the per-group results). */}
            <p className="text-[10px] text-muted-foreground italic">
              Cumulative is a raw points table across every game-day lobby this team
              played. Sorted by the backend (points, then tiebreakers).
            </p>
          </>
        )}

        <DialogFooter className="mt-2 border-t pt-4">
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
