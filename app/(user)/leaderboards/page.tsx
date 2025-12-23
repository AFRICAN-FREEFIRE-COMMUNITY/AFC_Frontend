"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { IconTrophy, IconUsers, IconMap } from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { Label } from "@/components/ui/label";
import { env } from "@/lib/env";
import { FullLoader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const LeaderboardPage = () => {
  const { token } = useAuth();

  // States
  const [eventsList, setEventsList] = useState<any[]>([]); // List from /get-all-events/
  const [eventDetails, setEventDetails] = useState<any>(null); // Details from /get-all-leaderboard-details-for-event/
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Selection states
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [activeStageId, setActiveStageId] = useState<string>("");
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

  // 1. Initial Load: Fetch list of all events
  useEffect(() => {
    const fetchEventsList = async () => {
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`
        );
        const data = await res.json();
        setEventsList(data.events || []);

        // Auto-select first event if available
        if (data.events?.length > 0) {
          const firstId = data.events[0].event_id.toString();
          handleEventSelect(firstId);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };
    fetchEventsList();
  }, []);

  // 2. Fetch specific Leaderboard details when an event is selected
  const handleEventSelect = async (eventId: string) => {
    setSelectedEventId(eventId);
    setDetailsLoading(true);
    setEventDetails(null); // Reset UI while loading

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: eventId }),
        }
      );

      const data = await res.json();

      // Validate if leaderboard data exists in the response
      if (data && data.stages && data.stages.length > 0) {
        setEventDetails(data);
        const firstStage = data.stages[0];
        setActiveStageId(firstStage.stage_id.toString());
        if (firstStage.groups?.length > 0) {
          setActiveGroupId(firstStage.groups[0].group_id.toString());
        }
        setSelectedMatchId("overall");
      } else {
        // Set a flag to show "No Leaderboard Exists"
        setEventDetails("not_found");
      }
    } catch (error) {
      setEventDetails("not_found");
    } finally {
      setDetailsLoading(false);
    }
  };

  // 3. Handle Stage/Tab Change
  const handleStageChange = (stageId: string) => {
    setActiveStageId(stageId);
    const stage = eventDetails.stages.find(
      (s: any) => s.stage_id.toString() === stageId
    );
    if (stage?.groups?.length > 0) {
      setActiveGroupId(stage.groups[0].group_id.toString());
    }
    setSelectedMatchId("overall");
  };

  // Helper: Derived Selections
  const currentStage =
    eventDetails && eventDetails !== "not_found"
      ? eventDetails.stages?.find(
          (s: any) => s.stage_id.toString() === activeStageId
        )
      : null;

  const currentGroup = currentStage?.groups?.find(
    (g: any) => g.group_id.toString() === activeGroupId
  );

  const getTableData = () => {
    if (selectedMatchId === "overall")
      return currentGroup?.overall_leaderboard || [];
    const match = currentGroup?.matches?.find(
      (m: any) => m.match_id.toString() === selectedMatchId
    );
    return match?.stats || [];
  };

  if (loading) return <FullLoader />;

  return (
    <div className="min-h-screen space-y-8 pb-10">
      <PageHeader
        title="Leaderboards"
        description="Select an event to view rankings"
      />

      {/* Select Field: List of Events */}
      <div className="space-y-2">
        <Label>Filter by Event</Label>
        <Select value={selectedEventId} onValueChange={handleEventSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select an event" />
          </SelectTrigger>
          <SelectContent>
            {eventsList.map((evt) => (
              <SelectItem key={evt.event_id} value={evt.event_id.toString()}>
                {evt.event_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {detailsLoading ? (
        <div className="h-64 flex items-center justify-center">
          <FullLoader />
        </div>
      ) : eventDetails === "not_found" ? (
        <Card className="bg-zinc-900 border-zinc-800 p-20 text-center text-zinc-500">
          No leaderboard configuration exists for this event yet.
        </Card>
      ) : eventDetails ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Header & Tabs */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-4 gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">
                {eventDetails.event_name}
              </h2>
              <p className="text-sm text-muted-foreground uppercase">
                {eventDetails.participant_type} | {currentStage?.stage_name}
              </p>
            </div>

            <Tabs
              value={activeStageId}
              onValueChange={handleStageChange}
              className="w-full md:w-auto"
            >
              <ScrollArea>
                <TabsList>
                  {eventDetails.stages.map((stage: any) => (
                    <TabsTrigger
                      key={stage.stage_id}
                      value={stage.stage_id.toString()}
                    >
                      {stage.stage_name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </Tabs>
          </div>

          {/* Group and Match Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2">
            <div className="space-y-2">
              <Label>
                <IconUsers size={16} /> Group
              </Label>
              <Select
                value={activeGroupId}
                onValueChange={(val) => {
                  setActiveGroupId(val);
                  setSelectedMatchId("overall");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentStage?.groups?.map((group: any) => (
                    <SelectItem
                      key={group.group_id}
                      value={group.group_id.toString()}
                    >
                      {group.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                <IconMap size={16} /> View Filter
              </Label>
              <Select
                value={selectedMatchId}
                onValueChange={setSelectedMatchId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall Leaderboard</SelectItem>
                  {currentGroup?.matches?.map((match: any) => (
                    <SelectItem
                      key={match.match_id}
                      value={match.match_id.toString()}
                    >
                      Match {match.match_number} - {match.match_map}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Statistics Table */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <IconTrophy size={18} className="text-yellow-500" />
              {selectedMatchId === "overall"
                ? "Overall Rankings"
                : "Match Standings"}
            </h3>
            <Card className="overflow-hidden max-h-96 p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Rank</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Kills</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getTableData().length > 0 ? (
                    getTableData().map((row: any, idx: number) => (
                      <RankingRow
                        key={idx}
                        rank={row.placement || idx + 1}
                        name={
                          row.competitor_name ||
                          row.competitor__user__username ||
                          row.username ||
                          `Player ${row.competitor_id}`
                        }
                        kills={row.kills || row.total_kills || 0}
                        points={row.total_pts || row.total_points || 0}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-10 text-muted-foreground italic"
                      >
                        No data recorded for this selection.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const RankingRow = ({ rank, name, kills, points }: any) => (
  <TableRow>
    <TableCell>#{rank}</TableCell>
    <TableCell className="font-medium">{name}</TableCell>
    <TableCell>{kills}</TableCell>
    <TableCell className="text-right font-semibold text-primary">
      {parseFloat(points).toFixed(1)}
    </TableCell>
  </TableRow>
);

export default LeaderboardPage;
