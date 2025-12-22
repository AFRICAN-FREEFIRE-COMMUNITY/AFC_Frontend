// "use client";

// import React, { useState, useEffect } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   IconPlus,
//   IconX,
//   IconLoader2,
//   IconSettings,
// } from "@tabler/icons-react";
// import { env } from "@/lib/env";
// import { useAuth } from "@/contexts/AuthContext";
// import { toast } from "sonner";
// import { Card, CardContent } from "@/components/ui/card";
// import { Loader } from "@/components/Loader";

// export const EditScoringModal = ({
//   open,
//   onClose,
//   currentLeaderboard,
//   onSuccess,
// }: any) => {
//   const { token } = useAuth();
//   const [loading, setLoading] = useState(false);
//   const [killPoint, setKillPoint] = useState("0");
//   const [ranks, setRanks] = useState<any[]>([]);

//   // Initialize data when modal opens
//   useEffect(() => {
//     if (currentLeaderboard) {
//       setKillPoint(currentLeaderboard.kill_point.toString());

//       // Convert backend object {"1": 12} to local state array
//       const initialRanks = Object.entries(
//         currentLeaderboard.placement_points || {}
//       )
//         .map(([rank, val]) => ({ id: rank, val: val?.toString() }))
//         .sort((a, b) => parseInt(a.id) - parseInt(b.id));

//       // 🧠 Ensure a minimum of 10 ranks
//       const minRanks = 10;
//       const paddedRanks = [...initialRanks];

//       if (paddedRanks.length < minRanks) {
//         for (let i = paddedRanks.length + 1; i <= minRanks; i++) {
//           paddedRanks.push({
//             id: `new-${i}-${Date.now()}`, // Unique ID for keying
//             val: "0",
//           });
//         }
//       }

//       setRanks(paddedRanks);
//     }
//   }, [currentLeaderboard, open]);

//   const handleUpdate = async () => {
//     setLoading(true);
//     const placementPoints: Record<string, number> = {};

//     // We map using the actual index to ensure sequential keys for the backend
//     ranks.forEach((r, idx) => {
//       placementPoints[(idx + 1).toString()] = parseInt(r.val) || 0;
//     });

//     try {
//       const res = await fetch(
//         `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/update-leaderboard-scoring/`,
//         {
//           method: "PATCH",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             leaderboard_id: currentLeaderboard.leaderboard_id,
//             placement_point: placementPoints,
//             kill_point: parseInt(killPoint),
//           }),
//         }
//       );

//       if (res.ok) {
//         toast.success("Scoring updated!");
//         onSuccess();
//         onClose();
//       }
//     } catch (err) {
//       toast.error("Update failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <Dialog open={open} onOpenChange={onClose}>
//       <DialogContent className="max-w-2xl bg-[#09090b] text-white border-zinc-800">
//         <DialogHeader>
//           <DialogTitle className="flex items-start gap-2">
//             <IconSettings className="size-5" />
//             Edit Scoring: {currentLeaderboard?.leaderboard_name}
//           </DialogTitle>
//         </DialogHeader>

//         <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
//           <div className="space-y-2">
//             <Label>Kill Points</Label>
//             <Input
//               value={killPoint}
//               onChange={(e) => setKillPoint(e.target.value)}
//               className="bg-zinc-900 border-zinc-800"
//             />
//           </div>

//           <div className="space-y-4">
//             <div className="flex justify-between items-center">
//               <Label>Placement Points</Label>
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() =>
//                   setRanks([...ranks, { id: `add-${Date.now()}`, val: "0" }])
//                 }
//                 className="h-7 text-xs border-zinc-800"
//               >
//                 <IconPlus size={12} className="mr-1" /> Add Rank
//               </Button>
//             </div>

//             <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
//               {ranks.map((r, i) => (
//                 <Card className="py-1 group relative" key={r.id}>
//                   <CardContent className="p-2">
//                     <div className="flex justify-between text-[9px] text-zinc-500 uppercase mb-1">
//                       <Label className="text-[9px]">Rank {i + 1}</Label>
//                       {/* Only allow deleting if there are more than 10 ranks */}
//                       {ranks.length > 10 && (
//                         <button
//                           onClick={() =>
//                             setRanks(ranks.filter((_, index) => index !== i))
//                           }
//                           className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-500"
//                         >
//                           <IconX size={10} />
//                         </button>
//                       )}
//                     </div>
//                     <Input
//                       value={r.val}
//                       onChange={(e) => {
//                         const newRanks = [...ranks];
//                         newRanks[i].val = e.target.value;
//                         setRanks(newRanks);
//                       }}
//                       className="h-8"
//                     />
//                   </CardContent>
//                 </Card>
//               ))}
//             </div>
//           </div>
//         </div>

//         <DialogFooter>
//           <Button variant="ghost" onClick={onClose}>
//             Cancel
//           </Button>
//           <Button onClick={handleUpdate} disabled={loading}>
//             {loading ? <Loader text="Saving..." /> : "Save Changes"}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// };

"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconPlus,
  IconX,
  IconLoader2,
  IconSettings,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/Loader";

export const EditScoringModal = ({
  open,
  onClose,
  currentLeaderboard, // Contains leaderboard_id, leaderboard_name, kill_point, placement_points
  stageId, // Pass this from IndividualLeaderboardPage
  groupId, // Pass this from IndividualLeaderboardPage
  onSuccess,
}: any) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [killPoint, setKillPoint] = useState("0");
  const [leaderboardName, setLeaderboardName] = useState("");
  const [ranks, setRanks] = useState<any[]>([]);

  // Initialize data when modal opens
  useEffect(() => {
    if (currentLeaderboard) {
      setKillPoint(currentLeaderboard.kill_point?.toString() || "0");
      setLeaderboardName(currentLeaderboard.leaderboard_name || "");

      const initialRanks = Object.entries(
        currentLeaderboard.placement_points || {}
      )
        .map(([rank, val]) => ({ id: rank, val: val?.toString() }))
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));

      const minRanks = 10;
      const paddedRanks = [...initialRanks];

      if (paddedRanks.length < minRanks) {
        for (let i = paddedRanks.length + 1; i <= minRanks; i++) {
          paddedRanks.push({
            id: `new-${i}-${Date.now()}`,
            val: "0",
          });
        }
      }
      setRanks(paddedRanks);
    }
  }, [currentLeaderboard, open]);

  const handleUpdate = async () => {
    setLoading(true);

    // 1. Construct the placement_points object
    const placementPointsObj: Record<string, number> = {};
    ranks.forEach((r, idx) => {
      placementPointsObj[(idx + 1).toString()] = parseInt(r.val) || 0;
    });

    // 2. Initialize FormData
    const submissionData = new FormData();

    // 3. Append all fields as required by your endpoint
    submissionData.append(
      "leaderboard_id",
      currentLeaderboard.leaderboard_id.toString()
    );
    submissionData.append("stage_id", stageId.toString());
    submissionData.append("group_id", groupId.toString());
    // submissionData.append("new_name", leaderboardName);

    // IMPORTANT: Stringify the object so it can be passed in FormData
    submissionData.append(
      "placement_points",
      JSON.stringify(placementPointsObj)
    );

    submissionData.append("kill_point", killPoint);

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-leaderboard/`,
        {
          method: "POST", // Adjust to PATCH if your backend strictly requires it
          headers: {
            // Note: DO NOT set 'Content-Type': 'application/json'
            // The browser must set the multipart boundary automatically
            Authorization: `Bearer ${token}`,
          },
          body: submissionData,
        }
      );

      if (res.ok) {
        toast.success("Leaderboard updated successfully!");
        onSuccess();
        onClose();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Update failed");
      }
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("An error occurred while saving");
    } finally {
      setLoading(false);
    }
  };

  //   const handleUpdate = async () => {
  //     setLoading(true);

  //     // 1. Transform array into the required "placement_points" object
  //     const placementPointsObj: Record<string, number> = {};
  //     ranks.forEach((r, idx) => {
  //       placementPointsObj[(idx + 1).toString()] = parseInt(r.val) || 0;
  //     });

  //     // 2. Construct payload matching your endpoint
  //     const payload = {
  //       leaderboard_id: currentLeaderboard.leaderboard_id.toString(),
  //       stage_id: stageId.toString(),
  //       group_id: groupId.toString(),
  //       new_name: leaderboardName, // Current name or modified name
  //       placement_points: placementPointsObj,
  //       kill_point: killPoint.toString(),
  //     };

  //     try {
  //       const res = await fetch(
  //         `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/edit-leaderboard/`,
  //         {
  //           method: "POST", // endpoint uses POST for editing based on your previous examples
  //           headers: {
  //             "Content-Type": "application/json",
  //             Authorization: `Bearer ${token}`,
  //           },
  //           body: JSON.stringify(payload),
  //         }
  //       );

  //       if (res.ok) {
  //         toast.success("Leaderboard updated successfully!");
  //         onSuccess();
  //         onClose();
  //       } else {
  //         const errorData = await res.json();
  //         toast.error(errorData.message || "Update failed");
  //       }
  //     } catch (err) {
  //       console.error(err);
  //       toast.error("An error occurred while saving");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#09090b] text-white border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSettings className="size-5" />
            Edit Leaderboard Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Optional: Edit Name */}
          {/* <div className="space-y-2">
            <Label className="text-zinc-500 uppercase text-[10px] font-bold">
              Leaderboard Name
            </Label>
            <Input
              value={leaderboardName}
              onChange={(e) => setLeaderboardName(e.target.value)}
              className="bg-zinc-900 border-zinc-800"
            />
          </div> */}

          <div className="space-y-2">
            <Label className="text-zinc-500 uppercase text-[10px] font-bold">
              Kill Points
            </Label>
            <Input
              value={killPoint}
              onChange={(e) => setKillPoint(e.target.value)}
              className="bg-zinc-900 border-zinc-800"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-zinc-500 uppercase text-[10px] font-bold">
                Placement Points
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRanks([...ranks, { id: `add-${Date.now()}`, val: "0" }])
                }
                className="h-7 text-xs border-zinc-800"
              >
                <IconPlus size={12} className="mr-1" /> Add Rank
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ranks.map((r, i) => (
                <Card
                  className="py-1 group relative bg-zinc-900 border-zinc-800"
                  key={r.id}
                >
                  <CardContent className="p-2">
                    <div className="flex justify-between text-[9px] text-zinc-500 uppercase mb-1">
                      <Label className="text-[9px]">Rank {i + 1}</Label>
                      {ranks.length > 10 && (
                        <button
                          onClick={() =>
                            setRanks(ranks.filter((_, index) => index !== i))
                          }
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-500"
                        >
                          <IconX size={10} />
                        </button>
                      )}
                    </div>
                    <Input
                      value={r.val}
                      onChange={(e) => {
                        const newRanks = [...ranks];
                        newRanks[i].val = e.target.value;
                        setRanks(newRanks);
                      }}
                      className="h-8 bg-zinc-950 border-zinc-800"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {loading ? <Loader text="Saving..." /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
