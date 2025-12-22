// "use client";

// import React, { useState, useEffect, use } from "react";
// import { Card, CardContent, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { IconTrophy, IconUsers, IconMap } from "@tabler/icons-react";
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
// import { UploadResultModal } from "../_components/UploadResultModal";

// type Params = {
//   id: string;
// };

// export default function IndividualLeaderboardPage({
//   params,
// }: {
//   params: Promise<Params>;
// }) {
//   const resolvedParams = use(params);
//   const { id } = resolvedParams;
//   const [openUploadModal, setOpenUploadModal] = useState(false);
//   const [eventData, setEventData] = useState<any>(null);
//   const [selectedStageId, setSelectedStageId] = useState<string>("");
//   const [selectedGroupId, setSelectedGroupId] = useState<string>("");
//   const [selectedMatchId, setSelectedMatchId] = useState<string>("overall");

//   const { token } = useAuth();

//   // 1. Fetch Event Data
//   useEffect(() => {
//     const fetchLeaderboard = async () => {
//       try {
//         const res = await fetch(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//               Authorization: `Bearer ${token}`,
//             },
//             body: JSON.stringify({ event_id: id || "53" }),
//           }
//         );
//         const data = await res.json();
//         setEventData(data);

//         // Auto-select first stage and group
//         if (data.stages?.length > 0) {
//           setSelectedStageId(data.stages[0].stage_id.toString());
//           if (data.stages[0].groups?.length > 0) {
//             setSelectedGroupId(data.stages[0].groups[0].group_id.toString());
//           }
//         }
//       } catch (error) {
//         console.log(error);
//         console.error("Failed to fetch leaderboard details", error);
//       }
//     };
//     fetchLeaderboard();
//   }, [id]);

//   console.log(eventData);

//   // Derived Data Helpers
//   const currentStage = eventData?.stages?.find(
//     (s: any) => s.stage_id.toString() === selectedStageId
//   );
//   const currentGroup = currentStage?.groups?.find(
//     (g: any) => g.group_id.toString() === selectedGroupId
//   );
//   const currentLeaderboard = currentGroup?.leaderboard;

//   // 📊 Logic to determine which data to show in the table
//   const getTableData = () => {
//     if (selectedMatchId === "overall") {
//       // Use the overall_leaderboard array from the group object
//       return currentGroup?.overall_leaderboard || [];
//     } else {
//       // Find the specific match and return its stats array
//       const match = currentGroup?.matches.find(
//         (m: any) => m.match_id.toString() === selectedMatchId
//       );
//       return match?.stats || [];
//     }
//   };

//   const tableData = getTableData();

//   if (!eventData) return <FullLoader />;

//   return (
//     <div className="space-y-6">
//       {/* Page Header */}
//       <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
//         <PageHeader
//           back
//           title={eventData.event_name}
//           description={
//             <>
//               Participant Type:{" "}
//               <span className="capitalize">{eventData.participant_type}</span>
//             </>
//           }
//         />

//         <Button className="w-full md:w-auto">Edit Configuration</Button>
//       </div>

//       <Tabs
//         value={selectedStageId}
//         onValueChange={setSelectedStageId}
//         className="w-full"
//       >
//         <ScrollArea>
//           <TabsList className="w-full">
//             {eventData.stages.map((stage: any) => (
//               <TabsTrigger
//                 key={stage.stage_id}
//                 value={stage.stage_id.toString()}
//               >
//                 {stage.stage_name}
//               </TabsTrigger>
//             ))}
//           </TabsList>{" "}
//           <ScrollBar orientation="horizontal" />
//         </ScrollArea>
//       </Tabs>

//       <Card>
//         <CardContent className="space-y-8">
//           {/* Filters Row */}
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-2">
//             <div className="space-y-2">
//               <Label>
//                 <IconUsers className="size-4" />
//                 Group
//               </Label>
//               <Select
//                 value={selectedGroupId}
//                 onValueChange={setSelectedGroupId}
//               >
//                 <SelectTrigger>
//                   <SelectValue placeholder="Select Group" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {currentStage?.groups.map((group: any) => (
//                     <SelectItem
//                       key={group.group_id}
//                       value={group.group_id.toString()}
//                     >
//                       {group.group_name}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             <div className="space-y-2">
//               <Label>
//                 <IconMap className="size-4" />
//                 Match / Map
//               </Label>
//               <Select
//                 value={selectedMatchId}
//                 onValueChange={setSelectedMatchId}
//               >
//                 <SelectTrigger>
//                   <SelectValue placeholder="Overall Leaderboard" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="overall">Overall Leaderboard</SelectItem>
//                   {currentGroup?.matches.map((match: any) => (
//                     <SelectItem
//                       key={match.match_id}
//                       value={match.match_id.toString()}
//                     >
//                       Match {match.match_number} - {match.match_map}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             <div className="flex items-end">
//               <div className="p-3 bg-zinc-100/50 border-zinc-200 dark:bg-zinc-900/50 border dark:border-zinc-800 rounded-lg w-full">
//                 <p className="text-xs text-muted-foreground uppercase font-semibold">
//                   Kill Points
//                 </p>
//                 <p className="text-lg font-semibold">
//                   {currentLeaderboard?.kill_point || 0}{" "}
//                   <span className="text-xs font-normal text-muted-foreground">
//                     per kill
//                   </span>
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Statistics Table */}
//           <Card className="border-0 p-0">
//             <CardContent className="p-0 space-y-2">
//               <CardTitle>Ranking</CardTitle>
//               <div className="border rounded-md overflow-hidden">
//                 <Table className="w-full text-sm text-left">
//                   <TableHeader>
//                     <TableRow>
//                       <TableHead className="px-6 py-4">Rank</TableHead>
//                       <TableHead className="px-6 py-4">Team / Player</TableHead>
//                       <TableHead className="px-6 py-4">Matches</TableHead>
//                       <TableHead className="px-6 py-4">Total Kills</TableHead>
//                       <TableHead className="px-6 py-4 text-right">
//                         Total Points
//                       </TableHead>
//                     </TableRow>
//                   </TableHeader>
//                   <TableBody>
//                     {tableData.length > 0 ? (
//                       tableData.map((row: any, index: number) => (
//                         <TableRow
//                           key={index}
//                           className="hover:bg-muted/30 transition-colors"
//                         >
//                           <TableCell className="px-6 py-4 font-medium text-muted-foreground">
//                             #{row.placement || index + 1}
//                           </TableCell>
//                           <TableCell className="px-6 py-4 font-bold text-foreground">
//                             {row.competitor__user__username ||
//                               row.competitor_name ||
//                               `ID: ${row.competitor_id}`}
//                           </TableCell>
//                           <TableCell className="px-6 py-4">
//                             {row.kills ?? "--"}
//                           </TableCell>
//                           <TableCell className="px-6 py-4 font-bold text-primary">
//                             {row.kills ?? "--"}
//                           </TableCell>
//                           <TableCell className="px-6 py-4 text-right font-bold text-primary">
//                             {(row.total_points || row.total_pts || 0).toFixed(
//                               1
//                             )}
//                           </TableCell>
//                         </TableRow>
//                       ))
//                     ) : (
//                       <TableRow>
//                         <TableCell
//                           colSpan={4}
//                           className="h-32 text-center text-muted-foreground italic"
//                         >
//                           No results available for this selection.
//                         </TableCell>
//                       </TableRow>
//                     )}
//                   </TableBody>
//                 </Table>
//               </div>
//             </CardContent>
//           </Card>

//           <Button onClick={() => setOpenUploadModal(true)}>
//             Upload result
//           </Button>
//         </CardContent>
//       </Card>
//       {openUploadModal && (
//         <UploadResultModal
//           open={openUploadModal}
//           onClose={() => setOpenUploadModal(false)}
//           currentGroup={currentGroup}
//         />
//       )}
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconTrophy,
  IconUsers,
  IconMap,
  IconSettings,
  IconUpload,
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

  console.log(eventData);

  // Modal States
  const [openUploadModal, setOpenUploadModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);

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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <PageHeader
          back
          title={eventData.event_name}
          description={`Solo Tournament • ${eventData.stages.length} Stages`}
        />
        <Button
          variant="outline"
          onClick={() => setOpenEditModal(true)}
          className="border-zinc-800 hover:bg-zinc-900 gap-2"
        >
          <IconSettings size={16} /> Edit Scoring
        </Button>
      </div>

      <Tabs value={selectedStageId} onValueChange={setSelectedStageId}>
        <TabsList className="w-full justify-start bg-zinc-900/50">
          {eventData.stages.map((s: any) => (
            <TabsTrigger key={s.stage_id} value={s.stage_id.toString()}>
              {s.stage_name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="bg-[#09090b] border-zinc-800">
        <CardContent className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-500 flex items-center gap-2">
                <IconUsers size={14} /> Group
              </Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Select Group" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  {currentStage?.groups.map((g: any) => (
                    <SelectItem key={g.group_id} value={g.group_id.toString()}>
                      {g.group_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-500 flex items-center gap-2">
                <IconMap size={14} /> View Type
              </Label>
              <Select
                value={selectedMatchId}
                onValueChange={setSelectedMatchId}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="overall">Overall Leaderboard</SelectItem>
                  {currentGroup?.matches.map((m: any) => (
                    <SelectItem key={m.match_id} value={m.match_id.toString()}>
                      Match {m.match_number} ({m.match_map})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <p className="text-[10px] font-bold text-blue-500 uppercase">
                Current Kill Points
              </p>
              <p className="text-xl font-bold">
                {currentGroup?.leaderboard?.kill_point || 0}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <IconTrophy size={18} className="text-yellow-500" />
              Rankings
            </CardTitle>
            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
              <Table>
                <TableHeader className="bg-zinc-900/50">
                  <TableRow className="border-zinc-800">
                    <TableHead>Rank</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Kills</TableHead>
                    <TableHead className="text-right">Total Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getTableData().map((row: any, idx: number) => (
                    <TableRow
                      key={idx}
                      className="border-zinc-900 hover:bg-zinc-900/30"
                    >
                      <TableCell className="font-mono text-zinc-500">
                        #{row.placement || idx + 1}
                      </TableCell>
                      <TableCell className="font-bold">
                        {row.competitor__user__username || "Unknown"}
                      </TableCell>
                      <TableCell>{row.kills ?? "--"}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {(row.total_points || row.total_pts || 0).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <Button
            onClick={() => setOpenUploadModal(true)}
            className="bg-white text-black font-bold gap-2"
          >
            <IconUpload size={18} /> Upload Result
          </Button>
        </CardContent>
      </Card>

      {/* MODALS */}
      <UploadResultModal
        open={openUploadModal}
        onClose={() => setOpenUploadModal(false)}
        currentGroup={currentGroup}
      />

      <EditScoringModal
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        currentLeaderboard={currentGroup?.leaderboard}
        onSuccess={fetchLeaderboard}
      />
    </div>
  );
}
