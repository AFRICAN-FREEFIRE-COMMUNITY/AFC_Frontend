"use client";

import React, { useState, useEffect, use } from "react";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconTrophy,
  IconUsers,
  IconMap,
  IconSettings,
  IconUpload,
  IconPencil,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadResultModal } from "../_components/UploadResultModal";
import { EditScoringModal } from "../_components/EditScoringModal";
import { AdjustScoreModal } from "../_components/AdjustScoreModal";

type Params = { id: string };

export default function IndividualLeaderboardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { token } = useAuth();

  // States
  const [eventData, setEventData] = useState<any>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

  // Modal States
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [openAdjustModal, setOpenAdjustModal] = useState(false);

  // 1. Fetching Logic
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: id }),
        }
      );
      const data = await res.json();
      setEventData(data);

      if (!selectedStageId && data.stages?.length > 0) {
        setSelectedStageId(data.stages[0].stage_id.toString());
        setSelectedGroupId(data.stages[0].groups[0]?.group_id.toString());
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [id, token]);

  // Derived Helpers
  const currentStage = eventData?.stages?.find(
    (s: any) => s.stage_id.toString() === selectedStageId
  );
  const currentGroup = currentStage?.groups?.find(
    (g: any) => g.group_id.toString() === selectedGroupId
  );

  const currentMatch = currentGroup?.matches.find(
    (m: any) => m.match_id.toString() === selectedMatchId
  );

  const getTableData = () => {
    if (selectedMatchId === "overall")
      return currentGroup?.overall_leaderboard || [];
    const match = currentGroup?.matches.find(
      (m: any) => m.match_id.toString() === selectedMatchId
    );
    return match?.stats || [];
  };

  if (!eventData) return <FullLoader />;

  return (
    <div className="space-y-2 pb-20">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <PageHeader
          back
          title={eventData.event_name}
          description={`Solo Tournament • ${eventData.stages.length} Stages`}
        />
        <Button variant="outline" onClick={() => setOpenEditModal(true)}>
          <IconSettings size={16} /> Edit Scoring
        </Button>
      </div>

      <Tabs value={selectedStageId} onValueChange={setSelectedStageId}>
        <ScrollArea>
          <TabsList className="w-full justify-start">
            {eventData.stages.map((s: any) => (
              <TabsTrigger key={s.stage_id} value={s.stage_id.toString()}>
                {s.stage_name}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Tabs>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>
                <IconUsers size={14} /> Group
              </Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Group" />
                </SelectTrigger>
                <SelectContent>
                  {currentStage?.groups.map((g: any) => (
                    <SelectItem key={g.group_id} value={g.group_id.toString()}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                <IconMap size={14} /> View Type
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
                  {currentGroup?.matches.map((m: any) => (
                    <SelectItem key={m.match_id} value={m.match_id.toString()}>
                      Match {m.match_number} ({m.match_map})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-[10px] font-semibold text-primary uppercase">
                Current Kill Points
              </p>
              <p className="text-xl font-bold">
                {currentGroup?.leaderboard?.kill_point || 0}
              </p>
            </div>
          </div>

          <CardTitle className="text-lg flex items-center gap-2">
            <IconTrophy size={18} className="text-yellow-500" />
            Rankings
          </CardTitle>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Competitor</TableHead>
                {selectedMatchId === "overall" && (
                  <TableHead>Matches</TableHead>
                )}
                <TableHead>Kills</TableHead>
                <TableHead className="text-right">Total Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getTableData().map((row: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>#{row.placement || idx + 1}</TableCell>
                  <TableCell className="font-bold">
                    {row.competitor__user__username ||
                      row.username ||
                      "Unknown"}
                  </TableCell>
                  {selectedMatchId === "overall" && (
                    <TableCell className="text-zinc-400">
                      {row.matches_played || currentGroup?.match_count || 0}
                    </TableCell>
                  )}
                  <TableCell>{(row.total_kills || row.kills) ?? "0"}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {(row.total_points || row.total_pts || 0).toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {getTableData().length === 0 && (
            <p className="text-center text-sm text-shadow-muted py-2">
              Nothing found!
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={() => setOpenUploadModal(true)}>
              <IconUpload size={18} /> Upload Result
            </Button>
            {selectedMatchId !== "overall" && (
              <Button
                variant="outline"
                onClick={() => setOpenAdjustModal(true)}
                className="border-zinc-800 hover:bg-zinc-900 gap-2"
              >
                <IconPencil size={18} /> Adjust Scores
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODALS */}
      <UploadResultModal
        open={openUploadModal}
        onClose={() => setOpenUploadModal(false)}
        currentGroup={currentGroup}
      />

      {openAdjustModal && (
        <AdjustScoreModal
          open={openAdjustModal}
          onClose={() => setOpenAdjustModal(false)}
          match={currentMatch}
          onSuccess={fetchLeaderboard}
        />
      )}
      <EditScoringModal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        currentLeaderboard={currentGroup?.leaderboard}
        stageId={selectedStageId} // <--- New prop
        groupId={selectedGroupId} // <--- New prop
        onSuccess={fetchLeaderboard}
      />
    </div>
  );
}
