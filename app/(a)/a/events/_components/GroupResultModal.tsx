"use client";

import React, { useEffect, useState } from "react";
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
import { IconTrophy, IconLoader2 } from "@tabler/icons-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { toast } from "sonner";

interface GroupResultModalProps {
  activeGroup: any; // The group object from the parent component
  stageName: string;
  eventId: number;
}

export const GroupResultModal = ({
  activeGroup,
  stageName,
  eventId,
}: GroupResultModalProps) => {
  const [loading, setLoading] = useState(false);
  const [viewMatchId, setViewMatchId] = useState<string>("overall");

  // This will store ONLY the specific group data found in the big API response
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const { token } = useAuth();

  const fetchLeaderboard = async () => {
    if (!activeGroup?.group_id) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
        { event_id: eventId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // --- FILTER LOGIC ---
      // The API returns the whole event. We need to find the specific group matching activeGroup.group_id
      let foundGroup = null;
      response.data.stages?.forEach((stage: any) => {
        const match = stage.groups?.find(
          (g: any) => g.group_id === activeGroup.group_id
        );
        if (match) foundGroup = match;
      });

      if (foundGroup) {
        setGroupDetails(foundGroup);
      } else {
        toast.error("Group data not found in leaderboard");
      }
    } catch (error: any) {
      toast.error("Failed to load leaderboard details");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when modal is likely to be interacted with or activeGroup changes
  useEffect(() => {
    fetchLeaderboard();
  }, [activeGroup?.group_id]);

  const getStandings = () => {
    if (!groupDetails) return [];

    if (viewMatchId === "overall") {
      return (groupDetails.overall_leaderboard || []).map(
        (entry: any, index: number) => ({
          rank: index + 1,
          username: entry.competitor__user__username,
          kills: entry.total_kills,
          points: entry.total_points,
          isQualified: index < groupDetails.teams_qualifying,
        })
      );
    } else {
      const match = groupDetails.matches?.find(
        (m: any) => m.match_id.toString() === viewMatchId
      );
      if (!match || !match.stats) return [];

      return match.stats
        .map((s: any) => ({
          rank: s.placement,
          username: s.username,
          kills: s.kills,
          points: s.total_points,
          isQualified: false,
        }))
        .sort((a: any, b: any) => a.rank - b.rank);
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

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <IconLoader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm text-muted-foreground">
              Loading standings...
            </p>
          </div>
        ) : (
          <>
            {/* Group Metadata */}
            <div className="bg-primary/5 p-3 rounded-lg flex flex-wrap gap-x-6 gap-y-2 text-[11px] border border-primary/10">
              <p>
                <span className="text-zinc-500 font-bold uppercase mr-1">
                  Advance:
                </span>{" "}
                Top{" "}
                {groupDetails?.teams_qualifying || activeGroup.teams_qualifying}{" "}
                Advance
              </p>
              <p>
                <span className="text-zinc-500 font-bold uppercase mr-1">
                  Matches:
                </span>{" "}
                {groupDetails?.match_count || 0} Total
              </p>
            </div>

            <Select value={viewMatchId} onValueChange={setViewMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall Leaderboard</SelectItem>
                {groupDetails?.matches?.map((m: any) => (
                  <SelectItem key={m.match_id} value={m.match_id.toString()}>
                    Match {m.match_number} ({m.match_map})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 overflow-auto rounded-md border border-zinc-800">
              <Table>
                <TableHeader className="bg-zinc-950 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead className="text-center w-20">Kills</TableHead>
                    <TableHead className="text-center w-20">Points</TableHead>
                    <TableHead className="text-right w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableStandings.length > 0 ? (
                    tableStandings.map((row) => (
                      <TableRow
                        key={row.username}
                        className="hover:bg-zinc-900/50"
                      >
                        <TableCell className="text-center font-bold">
                          #{row.rank}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.username}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.kills}
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {row.points}
                        </TableCell>
                        <TableCell className="text-right">
                          {viewMatchId === "overall" ? (
                            <Badge
                              variant={row.isQualified ? "default" : "outline"}
                              className={cn(
                                "text-[10px] uppercase",
                                row.isQualified
                                  ? "bg-green-600"
                                  : "text-zinc-500"
                              )}
                            >
                              {row.isQualified ? "Qualified" : "Eliminated"}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              Match Stats
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-muted-foreground italic"
                      >
                        No match results found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter className="mt-4 border-t pt-4">
          <DialogClose asChild>
            <Button variant="ghost">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
