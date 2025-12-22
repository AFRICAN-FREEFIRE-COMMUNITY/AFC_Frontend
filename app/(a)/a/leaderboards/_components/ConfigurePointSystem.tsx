// "use client";

// import React, { useState } from "react";
// import { Card, CardContent } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { IconPlus, IconX } from "@tabler/icons-react";

// interface RankPoint {
//   id: number;
//   rank: number;
//   points: string;
// }

// export function ConfigurePointSystem({
//   onNext,
//   onBack,
// }: {
//   onNext: () => void;
//   onBack: () => void;
// }) {
//   // Initial state based on image_db9af1.png
//   const [ranks, setRanks] = useState<RankPoint[]>([
//     { id: 1, rank: 1, points: "15" },
//     { id: 2, rank: 2, points: "12" },
//     { id: 3, rank: 3, points: "10" },
//     { id: 4, rank: 4, points: "8" },
//     { id: 5, rank: 5, points: "6" },
//     { id: 6, rank: 6, points: "4" },
//     { id: 7, rank: 7, points: "3" },
//     { id: 8, rank: 8, points: "2" },
//     { id: 9, rank: 9, points: "1" },
//     { id: 10, rank: 10, points: "1" },
//   ]);

//   const addRank = () => {
//     const newRankNumber = ranks.length + 1;
//     setRanks([...ranks, { id: Date.now(), rank: newRankNumber, points: "0" }]);
//   };

//   const removeRank = (id: number) => {
//     setRanks(ranks.filter((r) => r.id !== id));
//   };

//   const updateRankPoints = (id: number, value: string) => {
//     setRanks(ranks.map((r) => (r.id === id ? { ...r, points: value } : r)));
//   };

//   return (
//     <Card className="bg-[#09090b] border-zinc-800 text-white">
//       <CardContent className="p-8 space-y-10">
//         {/* Header Section */}
//         <div className="flex justify-between items-start">
//           <div className="space-y-1">
//             <h2 className="text-xl font-bold">Configure Point System</h2>
//             <p className="text-sm text-zinc-400">
//               Set up the scoring rules for this leaderboard
//             </p>
//           </div>
//           <Button
//             variant="outline"
//             onClick={addRank}
//             className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs h-8 gap-2"
//           >
//             <IconPlus className="size-3" /> Add Rank
//           </Button>
//         </div>

//         {/* Placement Points Grid (Ref: image_db9af1.png) */}
//         <div className="space-y-4">
//           <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
//             Placement Points
//           </h3>
//           <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
//             {ranks.map((r, index) => (
//               <div key={r.id} className="relative group">
//                 <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-2">
//                   <div className="flex justify-between items-center">
//                     <span className="text-[10px] font-medium text-zinc-500 uppercase">
//                       Rank {index + 1}
//                     </span>
//                     {index >= 5 && (
//                       <button
//                         onClick={() => removeRank(r.id)}
//                         className="text-zinc-600 hover:text-red-400"
//                       >
//                         <IconX className="size-3" />
//                       </button>
//                     )}
//                   </div>
//                   <div className="flex items-baseline gap-2">
//                     <Input
//                       value={r.points}
//                       onChange={(e) => updateRankPoints(r.id, e.target.value)}
//                       className="bg-transparent border-none p-0 h-auto text-xl font-bold focus-visible:ring-0"
//                     />
//                     <span className="text-[10px] text-zinc-500 uppercase">
//                       points
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Performance Metrics Section (Ref: image_dc0c4c.png) */}
//         <div className="space-y-4">
//           <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
//             Performance Metrics
//           </h3>
//           <div className="space-y-3">
//             {[
//               { label: "Kills", desc: "Points awarded per kill", val: "1" },
//               {
//                 label: "Assists",
//                 desc: "Points awarded per assist",
//                 val: "0.5",
//               },
//               {
//                 label: "Damage",
//                 desc: "Points per 1000 damage dealt",
//                 val: "0.5",
//               },
//             ].map((metric) => (
//               <div
//                 key={metric.label}
//                 className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg"
//               >
//                 <div>
//                   <p className="text-sm font-bold">{metric.label}</p>
//                   <p className="text-xs text-zinc-500">{metric.desc}</p>
//                 </div>
//                 <Input
//                   defaultValue={metric.val}
//                   className="w-20 bg-zinc-950 border-zinc-800 text-right font-mono"
//                 />
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Navigation Buttons */}
//         <div className="flex justify-between pt-6 border-t border-zinc-800">
//           <Button variant="ghost" onClick={onBack} className="text-zinc-500">
//             Back
//           </Button>
//           <Button
//             onClick={onNext}
//             className="bg-white text-black hover:bg-zinc-200 px-8 font-bold"
//           >
//             Next: Generate Results
//           </Button>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconX, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { FormDescription } from "@/components/ui/form";
import { Loader } from "@/components/Loader";

export function ConfigurePointSystem({ onNext, onBack, formData }: any) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [killPoint, setKillPoint] = useState("1");
  const [ranks, setRanks] = useState([
    { id: 1, val: "12" },
    { id: 2, val: "9" },
    { id: 3, val: "8" },
    { id: 4, val: "7" },
    { id: 5, val: "6" },
    { id: 6, val: "5" },
    { id: 7, val: "4" },
    { id: 8, val: "3" },
    { id: 9, val: "2" },
    { id: 10, val: "1" },
  ]);

  const handleCreate = async () => {
    setLoading(true);

    // Format placement points as: {"1": 12, "2": 9...}
    const placementPoints: Record<string, number> = {};
    ranks.forEach((r, idx) => {
      placementPoints[(idx + 1).toString()] = parseInt(r.val) || 0;
    });

    const payload = {
      event_id: formData.event_id,
      stage_id: formData.stage_id,
      group_id: formData.group_id,
      leaderboard_method: formData.leaderboard_method,
      file_type: formData.file_type,
      placement_point: placementPoints,
      kill_point: parseInt(killPoint),
    };

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/create-leaderboard/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (res.ok) onNext();
      else alert("Creation failed. Please check IDs.");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Configure Point System</span>{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRanks([...ranks, { id: Date.now(), val: "0" }])}
          >
            <IconPlus size={14} className="mr-2" />{" "}
            <span className="hidden md:inline-block">Add Rank</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-2">
          {ranks.map((r, i) => (
            <Card className="py-1" key={r.id}>
              <CardContent className="p-2">
                <div className="flex justify-between mb-1">
                  <Label>Rank {i + 1}</Label>
                  {i > 9 && (
                    <button
                      onClick={() =>
                        setRanks(ranks.filter((x) => x.id !== r.id))
                      }
                    >
                      <IconX size={12} />
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
                  className=""
                />
                <p className="text-xs text-muted-foreground mt-1.5">Points</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4">
          <div className="space-y-2.5">
            <Label>Kill Points</Label>
            <div>
              <Input
                value={killPoint}
                onChange={(e) => setKillPoint(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Points per kill
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-6">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? <Loader text="Creating..." /> : "Create Leaderboard"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
