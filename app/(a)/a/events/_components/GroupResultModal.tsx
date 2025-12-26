"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { IconEdit, IconTrophy, IconMap } from "@tabler/icons-react";

interface GroupResultModalProps {
  activeGroup: any;
  stageName: string;
}

export const GroupResultModal = ({
  activeGroup,
  stageName,
}: GroupResultModalProps) => {
  // 1. State to track if we are viewing "overall" or a specific "match_id"
  const [viewMatchId, setViewMatchId] = useState<string>("overall");

  // 2. Logic to get data based on selection
  const getStandings = () => {
    if (viewMatchId === "overall") {
      // --- AGGREGATION LOGIC (Sum of all matches) ---
      const standings: Record<string, any> = {};
      activeGroup.matches?.forEach((match: any) => {
        if (!match.result_inputted || !match.stats) return;

        match.stats.forEach((stat: any) => {
          const username = stat.competitor__user__username;
          if (!standings[username]) {
            standings[username] = {
              username,
              totalKills: 0,
              totalPoints: 0,
              matchesPlayed: 0,
            };
          }
          standings[username].totalKills += stat.kills || 0;
          standings[username].totalPoints += stat.total_points || 0;
          standings[username].matchesPlayed += 1;
        });
      });

      return Object.values(standings).sort(
        (a, b) => b.totalPoints - a.totalPoints
      );
    } else {
      // --- SINGLE MATCH LOGIC ---
      const match = activeGroup.matches?.find(
        (m: any) => m.match_id.toString() === viewMatchId
      );
      if (!match || !match.stats) return [];

      return match.stats
        .map((s: any) => ({
          username: s.competitor__user__username,
          totalKills: s.kills,
          totalPoints: s.total_points,
          placement: s.placement,
          matchesPlayed: 1,
        }))
        .sort((a, b) => (a.placement || 0) - (b.placement || 0));
    }
  };

  const tableStandings = getStandings();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" type="button" size="md" className="flex-1">
          View Results
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <IconTrophy className="text-yellow-500" size={20} />
              {activeGroup?.group_name} Results
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{stageName}</p>
          </div>
        </DialogHeader>

        {/* Group Metadata */}
        <div className="bg-primary/5 p-3 rounded-lg flex flex-wrap gap-x-6 gap-y-2 text-[11px] border border-primary/10">
          <p>
            <span className="text-zinc-500 uppercase font-bold mr-1">
              Date:
            </span>{" "}
            {formatDate(activeGroup.playing_date)}
          </p>
          <p>
            <span className="text-zinc-500 uppercase font-bold mr-1">
              Qualification:
            </span>{" "}
            Top {activeGroup.teams_qualifying} Advance
          </p>
          <p>
            <span className="text-zinc-500 uppercase font-bold mr-1">
              Status:
            </span>
            <span className="text-primary ml-1 font-bold">
              {viewMatchId === "overall" ? "Consolidated" : "Single Match View"}
            </span>
          </p>
        </div>

        <Select value={viewMatchId} onValueChange={setViewMatchId}>
          <SelectTrigger>
            <SelectValue placeholder="Select View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overall">Overall Standing</SelectItem>
            {activeGroup.matches?.map((m: any) => (
              <SelectItem key={m.match_id} value={m.match_id.toString()}>
                Match {m.match_number} ({m.match_map})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-auto mt-2 rounded-md border">
          <Table>
            <TableHeader className=" sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-14 text-center">Rank</TableHead>
                <TableHead>Competitor</TableHead>
                <TableHead className="text-center w-24">Kills</TableHead>
                <TableHead className="text-right w-24">Points</TableHead>
                <TableHead className="text-right w-32">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableStandings.length > 0 ? (
                tableStandings.map((row, idx) => {
                  // If viewing overall, qualify based on index. If viewing match, show actual placement.
                  const displayRank =
                    viewMatchId === "overall" ? idx + 1 : row.placement;
                  const isQualifying =
                    viewMatchId === "overall" &&
                    idx < activeGroup.teams_qualifying;

                  return (
                    <TableRow
                      key={row.username}
                      className="border-zinc-900 group"
                    >
                      <TableCell className="text-center font-semibold text-muted-foreground">
                        #{displayRank}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.username}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.totalKills}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {row.totalPoints.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {viewMatchId === "overall" ? (
                          <Badge
                            variant={isQualifying ? "default" : "outline"}
                            className={cn(
                              "text-[10px] uppercase tracking-tighter",
                              isQualifying
                                ? "bg-green-600"
                                : "text-zinc-500 border-zinc-800"
                            )}
                          >
                            {isQualifying ? "Qualified" : "Eliminated"}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">
                            Match Stats
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-muted-foreground italic"
                  >
                    {viewMatchId === "overall"
                      ? "No match results found to calculate standings."
                      : "Results for this match haven't been uploaded yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-2 border-t pt-2">
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
          {/* <Button variant="default" className="gap-2 font-bold">
            <IconEdit size={16} /> Export results
          </Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
