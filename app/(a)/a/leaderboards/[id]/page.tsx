// "use client";

// import React, { useState, useEffect, use } from "react";
// import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// import {
//   IconTrophy,
//   IconUsers,
//   IconMap,
//   IconSettings,
//   IconPencil,
//   IconEdit,
// } from "@tabler/icons-react";
// import { env } from "@/lib/env";
// import { useAuth } from "@/contexts/AuthContext";
// import { FullLoader } from "@/components/Loader";
// import { PageHeader } from "@/components/PageHeader";
// import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
// import { Label } from "@/components/ui/label";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { EditScoringModal } from "../_components/EditScoringModal";
// import { AdjustScoreModal } from "../_components/AdjustScoreModal";
// import { MatchMethodSelectionStep } from "../_components/MatchMethodSelectionStep";
// import { ManualMatchResultStep } from "../_components/ManualMatchResultStep";
// import { FileUploadStep } from "../_components/FileUploadStep";
// import { ImageUploadStep } from "../_components/ImageUploadStep";

// type Params = { id: string };
// type MatchView = "method" | "manual" | "image_upload" | "room_file_upload";

// export default function IndividualLeaderboardPage({
//   params,
// }: {
//   params: Promise<Params>;
// }) {
//   const resolvedParams = use(params);
//   const { id } = resolvedParams;
//   const { token } = useAuth();

//   const [eventData, setEventData] = useState<any>(null);
//   const [eventSlug, setEventSlug] = useState<string>("");
//   const [selectedStageId, setSelectedStageId] = useState<string>("");
//   const [selectedGroupId, setSelectedGroupId] = useState<string>("");
//   const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

//   const [openEditModal, setOpenEditModal] = useState(false);
//   const [openAdjustModal, setOpenAdjustModal] = useState(false);

//   const [editingMatch, setEditingMatch] = useState<{
//     match: { match_id: number; match_name: string };
//     view: MatchView;
//   } | null>(null);

//   const fetchLeaderboard = async () => {
//     try {
//       const res = await fetch(
//         `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({ event_id: id }),
//         },
//       );
//       const data = await res.json();
//       setEventData(data);

//       // Try to get the event slug from the response directly
//       const slug = data.event_slug ?? data.slug ?? "";
//       if (slug) {
//         setEventSlug(slug);
//       }

//       if (!selectedStageId && data.stages?.length > 0) {
//         setSelectedStageId(data.stages[0].stage_id.toString());
//         setSelectedGroupId(data.stages[0].groups[0]?.group_id.toString());
//       }
//     } catch (error) {}
//   };

//   // If the leaderboard response doesn't include the slug, look it up from the events list
//   const fetchEventSlug = async () => {
//     try {
//       const res = await fetch(
//         `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
//       );
//       const data = await res.json();
//       const event = (data.events ?? []).find(
//         (e: any) => e.event_id.toString() === id,
//       );
//       if (event?.slug) setEventSlug(event.slug);
//     } catch {}
//   };

//   useEffect(() => {
//     fetchLeaderboard();
//   }, [id, token]);

//   // Run the slug lookup once after eventData loads (if slug wasn't in the leaderboard response)
//   useEffect(() => {
//     if (eventData && !eventSlug) {
//       fetchEventSlug();
//     }
//   }, [eventData]);

//   // Derived helpers
//   const currentStage = eventData?.stages?.find(
//     (s: any) => s.stage_id.toString() === selectedStageId,
//   );
//   const currentGroup = currentStage?.groups?.find(
//     (g: any) => g.group_id.toString() === selectedGroupId,
//   );
//   const currentMatch = currentGroup?.matches?.find(
//     (m: any) => m.match_id.toString() === selectedMatchId,
//   );

//   const [leaderboardTab, setLeaderboardTab] = useState<"team" | "player">("team");

//   const getTableData = () => {
//     if (selectedMatchId === "overall")
//       return currentGroup?.overall_leaderboard || [];
//     const match = currentGroup?.matches?.find(
//       (m: any) => m.match_id.toString() === selectedMatchId,
//     );
//     return match?.stats || [];
//   };

//   const getPlayerData = () => {
//     if (selectedMatchId === "overall") {
//       const playerMap = new Map<number, any>();
//       for (const match of currentGroup?.matches ?? []) {
//         for (const teamStat of match.stats ?? []) {
//           for (const player of teamStat.players ?? []) {
//             const existing = playerMap.get(player.player_id);
//             if (existing) {
//               existing.total_kills += player.kills;
//               existing.total_damage += player.damage;
//               existing.total_assists += player.assists;
//             } else {
//               playerMap.set(player.player_id, {
//                 player_id: player.player_id,
//                 username: player.username,
//                 team_name: teamStat.team_name ?? "—",
//                 total_kills: player.kills,
//                 total_damage: player.damage,
//                 total_assists: player.assists,
//               });
//             }
//           }
//         }
//       }
//       return [...playerMap.values()].sort((a, b) => b.total_kills - a.total_kills);
//     } else {
//       const players: any[] = [];
//       for (const teamStat of currentMatch?.stats ?? []) {
//         for (const player of teamStat.players ?? []) {
//           players.push({
//             player_id: player.player_id,
//             username: player.username,
//             team_name: teamStat.team_name ?? "—",
//             total_kills: player.kills,
//             total_damage: player.damage,
//             total_assists: player.assists,
//           });
//         }
//       }
//       return players.sort((a, b) => b.total_kills - a.total_kills);
//     }
//   };

//   // Derive participant type from API response ("squad" → "team")
//   const detailsParticipantType: "solo" | "team" =
//     eventData?.participant_type === "solo" ? "solo" : "team";

//   // formData shape expected by ManualMatchResultStep / FileUploadStep
//   const detailsFormData = {
//     event_slug: eventSlug,
//     event_id: id,
//     // Use edit endpoint only when the match already has results
//     completed_match_ids:
//       editingMatch && currentMatch?.result_inputted
//         ? [editingMatch.match.match_id]
//         : [],
//     group_matches: currentGroup?.matches ?? [],
//     competitors_in_group: [],
//     group_leaderboard: currentGroup?.leaderboard ?? null,
//     placement_points: {},
//     kill_point: String(currentGroup?.leaderboard?.kill_point ?? "1"),
//     assist_point: String(currentGroup?.leaderboard?.assist_point ?? "0.5"),
//     damage_point: String(currentGroup?.leaderboard?.damage_point ?? "0.5"),
//     apply_to_all_maps: true,
//     leaderboard_id: currentGroup?.leaderboard?.leaderboard_id ?? null,
//     group_id: selectedGroupId,
//     stage_id: selectedStageId,
//   };

//   const handleStartEditMatch = () => {
//     const m = currentGroup?.matches?.find(
//       (x: any) => x.match_id.toString() === selectedMatchId,
//     );
//     if (!m) return;
//     setEditingMatch({
//       match: {
//         match_id: m.match_id,
//         match_name: `Match ${m.match_number} (${m.match_map})`,
//       },
//       view: "method",
//     });
//   };

//   const handleEditComplete = () => {
//     fetchLeaderboard();
//     setEditingMatch(null);
//   };

//   if (!eventData) return <FullLoader />;

//   return (
//     <div className="space-y-2 pb-20">
//       {/* Header */}
//       <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
//         <PageHeader
//           back={!editingMatch}
//           title={eventData.event_name}
//           description={`${detailsParticipantType === "solo" ? "Solo" : "Team"} Tournament • ${eventData.stages.length} Stages`}
//         />
//         {!editingMatch && (
//           <Button
//             variant="outline"
//             className="w-full md:w-auto"
//             onClick={() => setOpenEditModal(true)}
//           >
//             <IconSettings size={16} /> Edit Scoring
//           </Button>
//         )}
//       </div>

//       {/* Stage tabs — hidden while editing a match */}
//       {!editingMatch && (
//         <Tabs value={selectedStageId} onValueChange={setSelectedStageId}>
//           <ScrollArea>
//             <TabsList className="w-full justify-start">
//               {eventData.stages.map((s: any) => (
//                 <TabsTrigger key={s.stage_id} value={s.stage_id.toString()}>
//                   {s.stage_name}
//                 </TabsTrigger>
//               ))}
//             </TabsList>
//             <ScrollBar orientation="horizontal" />
//           </ScrollArea>
//         </Tabs>
//       )}

//       {/* ── Normal leaderboard view ── */}
//       {!editingMatch && (
//         <Card>
//           <CardContent className="space-y-4">
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
//               <div className="space-y-2">
//                 <Label>
//                   <IconUsers size={14} /> Group
//                 </Label>
//                 <Select
//                   value={selectedGroupId}
//                   onValueChange={setSelectedGroupId}
//                 >
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select Group" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {currentStage?.groups.map((g: any) => (
//                       <SelectItem
//                         key={g.group_id}
//                         value={g.group_id.toString()}
//                       >
//                         {g.group_name}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="space-y-2">
//                 <Label>
//                   <IconMap size={14} /> View Type
//                 </Label>
//                 <Select
//                   value={selectedMatchId}
//                   onValueChange={setSelectedMatchId}
//                 >
//                   <SelectTrigger>
//                     <SelectValue />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="overall">Overall Leaderboard</SelectItem>
//                     {currentGroup?.matches?.map((m: any) => (
//                       <SelectItem
//                         key={m.match_id}
//                         value={m.match_id.toString()}
//                       >
//                         Match {m.match_number} ({m.match_map})
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
//                 <p className="text-[10px] font-semibold text-primary uppercase">
//                   Current Kill Points
//                 </p>
//                 <p className="text-xl font-bold">
//                   {currentGroup?.leaderboard?.kill_point || 0}
//                 </p>
//               </div>
//             </div>

//             <CardTitle className="text-lg flex items-center gap-2">
//               <IconTrophy size={18} className="text-yellow-500" />
//               Rankings
//             </CardTitle>

//             {detailsParticipantType === "solo" ? (
//               /* ── Solo: single player table, no tabs ── */
//               <>
//                 <Table>
//                   <TableHeader>
//                     <TableRow>
//                       <TableHead>Rank</TableHead>
//                       <TableHead>Player</TableHead>
//                       {selectedMatchId === "overall" && (
//                         <TableHead>Matches</TableHead>
//                       )}
//                       <TableHead>Kills</TableHead>
//                       <TableHead className="text-right">Total Pts</TableHead>
//                     </TableRow>
//                   </TableHeader>
//                   <TableBody>
//                     {getTableData().map((row: any, idx: number) => (
//                       <TableRow key={idx}>
//                         <TableCell>#{idx + 1}</TableCell>
//                         <TableCell className="font-bold">
//                           {row.competitor__user__username || row.username || "Unknown"}
//                         </TableCell>
//                         {selectedMatchId === "overall" && (
//                           <TableCell className="text-zinc-400">
//                             {row.matches_played || 0}
//                           </TableCell>
//                         )}
//                         <TableCell>
//                           {(row.total_kills || row.kills) ?? "0"}
//                         </TableCell>
//                         <TableCell className="text-right font-bold text-primary">
//                           {(row.total_points || row.total_pts || 0).toFixed(1)}
//                         </TableCell>
//                       </TableRow>
//                     ))}
//                   </TableBody>
//                 </Table>
//                 {getTableData().length === 0 && (
//                   <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
//                     No result found!
//                   </div>
//                 )}
//               </>
//             ) : (
//               /* ── Team: two tabs ── */
//               <Tabs value={leaderboardTab} onValueChange={(v) => setLeaderboardTab(v as "team" | "player")}>
//                 <TabsList className="grid w-full grid-cols-2">
//                   <TabsTrigger value="team">Team Leaderboard</TabsTrigger>
//                   <TabsTrigger value="player">Player Leaderboard</TabsTrigger>
//                 </TabsList>

//                 {/* ── Team Leaderboard ── */}
//                 <TabsContent value="team" className="mt-4">
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead>Rank</TableHead>
//                         <TableHead>Team</TableHead>
//                         {selectedMatchId === "overall" && (
//                           <TableHead>Matches</TableHead>
//                         )}
//                         {selectedMatchId === "overall" && (
//                           <TableHead>Booyahs</TableHead>
//                         )}
//                         <TableHead>Kills</TableHead>
//                         <TableHead className="text-right">Total Pts</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {getTableData().map((row: any, idx: number) => (
//                         <TableRow key={idx}>
//                           <TableCell>#{idx + 1}</TableCell>
//                           <TableCell className="font-bold">
//                             {row.team_name || row.username || "Unknown"}
//                           </TableCell>
//                           {selectedMatchId === "overall" && (
//                             <TableCell className="text-zinc-400">
//                               {row.matches_played || 0}
//                             </TableCell>
//                           )}
//                           {selectedMatchId === "overall" && (
//                             <TableCell className="text-zinc-400">
//                               {row.total_booyah ?? 0}
//                             </TableCell>
//                           )}
//                           <TableCell>
//                             {(row.total_kills || row.kills) ?? "0"}
//                           </TableCell>
//                           <TableCell className="text-right font-bold text-primary">
//                             {(row.total_points || row.total_pts || 0).toFixed(1)}
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                   {getTableData().length === 0 && (
//                     <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
//                       No result found!
//                     </div>
//                   )}
//                 </TabsContent>

//                 {/* ── Player Leaderboard ── */}
//                 <TabsContent value="player" className="mt-4">
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead>Rank</TableHead>
//                         <TableHead>Player</TableHead>
//                         <TableHead>Team</TableHead>
//                         <TableHead className="text-right">Kills</TableHead>
//                         <TableHead className="text-right">Damage</TableHead>
//                         <TableHead className="text-right">Assists</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {getPlayerData().map((player: any, idx: number) => (
//                         <TableRow key={player.player_id}>
//                           <TableCell className="text-muted-foreground">
//                             #{idx + 1}
//                           </TableCell>
//                           <TableCell className="font-bold">
//                             {player.username}
//                           </TableCell>
//                           <TableCell className="text-muted-foreground text-sm">
//                             {player.team_name}
//                           </TableCell>
//                           <TableCell className="text-right font-bold text-primary">
//                             {player.total_kills}
//                           </TableCell>
//                           <TableCell className="text-right">
//                             {player.total_damage}
//                           </TableCell>
//                           <TableCell className="text-right">
//                             {player.total_assists}
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                   {getPlayerData().length === 0 && (
//                     <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
//                       No player data available!
//                     </div>
//                   )}
//                 </TabsContent>
//               </Tabs>
//             )}

//             {/* Action buttons */}
//             <div className="flex gap-2 flex-wrap">
//               {selectedMatchId !== "overall" && (
//                 <Button onClick={handleStartEditMatch}>
//                   <IconEdit size={18} /> Edit Match Results
//                 </Button>
//               )}
//               {selectedMatchId !== "overall" && (
//                 <Button
//                   variant="outline"
//                   onClick={() => setOpenAdjustModal(true)}
//                   className="border-zinc-800 hover:bg-zinc-900 gap-2"
//                 >
//                   <IconPencil size={18} /> Adjust Scores
//                 </Button>
//               )}
//             </div>
//           </CardContent>
//         </Card>
//       )}

//       {/* ── Edit sub-views (inline, replacing the card) ── */}

//       {editingMatch?.view === "method" && (
//         <MatchMethodSelectionStep
//           matchName={editingMatch.match.match_name}
//           onSelect={(method) =>
//             setEditingMatch({ ...editingMatch, view: method as MatchView })
//           }
//           onBack={() => setEditingMatch(null)}
//         />
//       )}

//       {editingMatch?.view === "manual" && (
//         <ManualMatchResultStep
//           match={editingMatch.match}
//           formData={detailsFormData}
//           participantTypeOverride={detailsParticipantType}
//           initialStats={currentMatch?.stats ?? []}
//           onComplete={handleEditComplete}
//           onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
//         />
//       )}

//       {editingMatch?.view === "image_upload" && (
//         <ImageUploadStep
//           onNext={handleEditComplete}
//           onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
//         />
//       )}

//       {editingMatch?.view === "room_file_upload" && (
//         <FileUploadStep
//           match={editingMatch.match}
//           formData={detailsFormData}
//           participantTypeOverride={detailsParticipantType}
//           onNext={handleEditComplete}
//           onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
//         />
//       )}

//       {/* ── Modals ── */}
//       {openAdjustModal && (
//         <AdjustScoreModal
//           open={openAdjustModal}
//           onClose={() => setOpenAdjustModal(false)}
//           match={currentMatch}
//           onSuccess={fetchLeaderboard}
//         />
//       )}

//       <EditScoringModal
//         open={openEditModal}
//         onClose={() => setOpenEditModal(false)}
//         currentLeaderboard={currentGroup?.leaderboard}
//         stageId={selectedStageId}
//         groupId={selectedGroupId}
//         onSuccess={fetchLeaderboard}
//       />
//     </div>
//   );
// }

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconTrophy,
  IconUsers,
  IconMap,
  IconSettings,
  IconPencil,
  IconEdit,
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
import { EditScoringModal } from "../_components/EditScoringModal";
import { AdjustScoreModal } from "../_components/AdjustScoreModal";
import { MatchMethodSelectionStep } from "../_components/MatchMethodSelectionStep";
import { ManualMatchResultStep } from "../_components/ManualMatchResultStep";
import { FileUploadStep } from "../_components/FileUploadStep";
import { ImageUploadStep } from "../_components/ImageUploadStep";

type Params = { id: string };
type MatchView = "method" | "manual" | "image_upload" | "room_file_upload";

export default function IndividualLeaderboardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { token } = useAuth();

  const [eventData, setEventData] = useState<any>(null);
  const [eventSlug, setEventSlug] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

  const [openEditModal, setOpenEditModal] = useState(false);
  const [openAdjustModal, setOpenAdjustModal] = useState(false);

  const [editingMatch, setEditingMatch] = useState<{
    match: { match_id: number; match_name: string };
    view: MatchView;
  } | null>(null);

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
        },
      );
      const data = await res.json();
      setEventData(data);

      // Try to get the event slug from the response directly
      const slug = data.event_slug ?? data.slug ?? "";
      if (slug) {
        setEventSlug(slug);
      }

      if (!selectedStageId && data.stages?.length > 0) {
        setSelectedStageId(data.stages[0].stage_id.toString());
        setSelectedGroupId(data.stages[0].groups[0]?.group_id.toString());
      }
    } catch (error) {}
  };

  // If the leaderboard response doesn't include the slug, look it up from the events list
  const fetchEventSlug = async () => {
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
      );
      const data = await res.json();
      const event = (data.events ?? []).find(
        (e: any) => e.event_id.toString() === id,
      );
      if (event?.slug) setEventSlug(event.slug);
    } catch {}
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [id, token]);

  // Run the slug lookup once after eventData loads (if slug wasn't in the leaderboard response)
  useEffect(() => {
    if (eventData && !eventSlug) {
      fetchEventSlug();
    }
  }, [eventData]);

  // When the selected stage changes, reset group and match to the first defaults
  useEffect(() => {
    if (!selectedStageId || !eventData) return;
    const stage = eventData.stages?.find(
      (s: any) => s.stage_id.toString() === selectedStageId,
    );
    const firstGroup = stage?.groups?.[0];
    setSelectedGroupId(firstGroup?.group_id?.toString() ?? "");
    setSelectedMatchId("overall");
  }, [selectedStageId]);

  // When the selected group changes, reset match to overall
  useEffect(() => {
    if (!selectedGroupId) return;
    setSelectedMatchId("overall");
  }, [selectedGroupId]);

  // Derived helpers
  const currentStage = eventData?.stages?.find(
    (s: any) => s.stage_id.toString() === selectedStageId,
  );
  const currentGroup = currentStage?.groups?.find(
    (g: any) => g.group_id.toString() === selectedGroupId,
  );
  const currentMatch = currentGroup?.matches?.find(
    (m: any) => m.match_id.toString() === selectedMatchId,
  );

  const [leaderboardTab, setLeaderboardTab] = useState<"team" | "player">(
    "team",
  );

  const getTableData = () => {
    if (selectedMatchId === "overall")
      return currentGroup?.overall_leaderboard || [];
    const match = currentGroup?.matches?.find(
      (m: any) => m.match_id.toString() === selectedMatchId,
    );
    return match?.stats || [];
  };

  const getPlayerData = () => {
    if (selectedMatchId === "overall") {
      const playerMap = new Map<number, any>();
      for (const match of currentGroup?.matches ?? []) {
        for (const teamStat of match.stats ?? []) {
          for (const player of teamStat.players ?? []) {
            const existing = playerMap.get(player.player_id);
            if (existing) {
              existing.total_kills += player.kills;
              existing.total_damage += player.damage;
              existing.total_assists += player.assists;
            } else {
              playerMap.set(player.player_id, {
                player_id: player.player_id,
                username: player.username,
                team_name: teamStat.team_name ?? "—",
                total_kills: player.kills,
                total_damage: player.damage,
                total_assists: player.assists,
              });
            }
          }
        }
      }
      return [...playerMap.values()].sort(
        (a, b) => b.total_kills - a.total_kills,
      );
    } else {
      const players: any[] = [];
      for (const teamStat of currentMatch?.stats ?? []) {
        for (const player of teamStat.players ?? []) {
          players.push({
            player_id: player.player_id,
            username: player.username,
            team_name: teamStat.team_name ?? "—",
            total_kills: player.kills,
            total_damage: player.damage,
            total_assists: player.assists,
          });
        }
      }
      return players.sort((a, b) => b.total_kills - a.total_kills);
    }
  };

  // Derive participant type from API response ("squad" → "team")
  const detailsParticipantType: "solo" | "team" =
    eventData?.participant_type === "solo" ? "solo" : "team";

  // formData shape expected by ManualMatchResultStep / FileUploadStep
  const detailsFormData = {
    event_slug: eventSlug,
    event_id: id,
    // Use edit endpoint only when the match already has results
    completed_match_ids:
      editingMatch && currentMatch?.result_inputted
        ? [editingMatch.match.match_id]
        : [],
    group_matches: currentGroup?.matches ?? [],
    competitors_in_group: [],
    group_leaderboard: currentGroup?.leaderboard ?? null,
    placement_points: {},
    kill_point: String(currentGroup?.leaderboard?.kill_point ?? "1"),
    assist_point: String(currentGroup?.leaderboard?.assist_point ?? "0.5"),
    damage_point: String(currentGroup?.leaderboard?.damage_point ?? "0.5"),
    apply_to_all_maps: true,
    leaderboard_id: currentGroup?.leaderboard?.leaderboard_id ?? null,
    group_id: selectedGroupId,
    stage_id: selectedStageId,
  };

  const handleStartEditMatch = () => {
    const m = currentGroup?.matches?.find(
      (x: any) => x.match_id.toString() === selectedMatchId,
    );
    if (!m) return;
    setEditingMatch({
      match: {
        match_id: m.match_id,
        match_name: `Match ${m.match_number} (${m.match_map})`,
      },
      view: "method",
    });
  };

  const handleEditComplete = () => {
    fetchLeaderboard();
    setEditingMatch(null);
  };

  if (!eventData) return <FullLoader />;

  return (
    <div className="space-y-2 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-2 mb-4">
        <PageHeader
          back={!editingMatch}
          title={eventData.event_name}
          description={`${detailsParticipantType === "solo" ? "Solo" : "Team"} Tournament • ${eventData.stages.length} Stages`}
        />
        {!editingMatch && (
          <Button
            variant="outline"
            className="w-full md:w-auto"
            onClick={() => setOpenEditModal(true)}
          >
            <IconSettings size={16} /> Edit Scoring
          </Button>
        )}
      </div>

      {/* Stage tabs — hidden while editing a match */}
      {!editingMatch && (
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
      )}

      {/* ── Normal leaderboard view ── */}
      {!editingMatch && (
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
                      <SelectItem
                        key={g.group_id}
                        value={g.group_id.toString()}
                      >
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
                    {currentGroup?.matches?.map((m: any) => (
                      <SelectItem
                        key={m.match_id}
                        value={m.match_id.toString()}
                      >
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

            {detailsParticipantType === "solo" ? (
              /* ── Solo: single player table, no tabs ── */
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Player</TableHead>
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
                        <TableCell>#{idx + 1}</TableCell>
                        <TableCell className="font-bold">
                          {row.competitor__user__username ||
                            row.username ||
                            "Unknown"}
                        </TableCell>
                        {selectedMatchId === "overall" && (
                          <TableCell className="text-zinc-400">
                            {row.matches_played || 0}
                          </TableCell>
                        )}
                        <TableCell>
                          {(row.total_kills || row.kills) ?? "0"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {(row.total_points || row.total_pts || 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {getTableData().length === 0 && (
                  <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
                    No result found!
                  </div>
                )}
              </>
            ) : (
              /* ── Team: two tabs ── */
              <Tabs
                value={leaderboardTab}
                onValueChange={(v) => setLeaderboardTab(v as "team" | "player")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="team">Team Leaderboard</TabsTrigger>
                  <TabsTrigger value="player">Player Leaderboard</TabsTrigger>
                </TabsList>

                {/* ── Team Leaderboard ── */}
                <TabsContent value="team" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Team</TableHead>
                        {selectedMatchId === "overall" && (
                          <TableHead>Matches</TableHead>
                        )}
                        {selectedMatchId === "overall" && (
                          <TableHead>Booyahs</TableHead>
                        )}
                        <TableHead>Kills</TableHead>
                        <TableHead className="text-right">Total Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getTableData().map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>#{idx + 1}</TableCell>
                          <TableCell className="font-bold">
                            {row.team_name || row.username || "Unknown"}
                          </TableCell>
                          {selectedMatchId === "overall" && (
                            <TableCell className="text-zinc-400">
                              {row.matches_played || 0}
                            </TableCell>
                          )}
                          {selectedMatchId === "overall" && (
                            <TableCell className="text-zinc-400">
                              {row.total_booyah ?? 0}
                            </TableCell>
                          )}
                          <TableCell>
                            {(row.total_kills || row.kills) ?? "0"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {(row.total_points || row.total_pts || 0).toFixed(
                              1,
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {getTableData().length === 0 && (
                    <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
                      No result found!
                    </div>
                  )}
                </TabsContent>

                {/* ── Player Leaderboard ── */}
                <TabsContent value="player" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Kills</TableHead>
                        <TableHead className="text-right">Damage</TableHead>
                        <TableHead className="text-right">Assists</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPlayerData().map((player: any, idx: number) => (
                        <TableRow key={player.player_id}>
                          <TableCell className="text-muted-foreground">
                            #{idx + 1}
                          </TableCell>
                          <TableCell className="font-bold">
                            {player.username}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {player.team_name}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {player.total_kills}
                          </TableCell>
                          <TableCell className="text-right">
                            {player.total_damage}
                          </TableCell>
                          <TableCell className="text-right">
                            {player.total_assists}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {getPlayerData().length === 0 && (
                    <div className="text-center py-14 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
                      No player data available!
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {selectedMatchId !== "overall" && (
                <Button onClick={handleStartEditMatch}>
                  <IconEdit size={18} /> Edit Match Results
                </Button>
              )}
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
      )}

      {/* ── Edit sub-views (inline, replacing the card) ── */}

      {editingMatch?.view === "method" && (
        <MatchMethodSelectionStep
          matchName={editingMatch.match.match_name}
          onSelect={(method) =>
            setEditingMatch({ ...editingMatch, view: method as MatchView })
          }
          onBack={() => setEditingMatch(null)}
        />
      )}

      {editingMatch?.view === "manual" && (
        <ManualMatchResultStep
          match={editingMatch.match}
          formData={detailsFormData}
          participantTypeOverride={detailsParticipantType}
          initialStats={currentMatch?.stats ?? []}
          onComplete={handleEditComplete}
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
      )}

      {editingMatch?.view === "image_upload" && (
        <ImageUploadStep
          onNext={handleEditComplete}
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
      )}

      {editingMatch?.view === "room_file_upload" && (
        <FileUploadStep
          match={editingMatch.match}
          formData={detailsFormData}
          participantTypeOverride={detailsParticipantType}
          onNext={handleEditComplete}
          onBack={() => setEditingMatch({ ...editingMatch, view: "method" })}
        />
      )}

      {/* ── Modals ── */}
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
        stageId={selectedStageId}
        groupId={selectedGroupId}
        onSuccess={fetchLeaderboard}
      />
    </div>
  );
}
