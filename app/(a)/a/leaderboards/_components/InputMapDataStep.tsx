// "use client";

// import React, { useState } from "react";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Checkbox } from "@/components/ui/checkbox";
// import { IconPlus } from "@tabler/icons-react";

// interface Team {
//   team_id: number;
//   team_name: string;
//   members?: any[];
// }

// interface Player {
//   user_id: number;
//   username: string;
// }

// interface PlayerMapData {
//   user_id: number;
//   kills: number;
//   damage: number;
//   assists: number;
//   played: boolean;
// }

// interface TeamMapData {
//   team_id: number;
//   placement: number;
//   played: boolean;
//   players: PlayerMapData[];
// }

// interface MapData {
//   map_name: string;
//   teams: TeamMapData[];
// }

// interface Props {
//   onNext: () => void;
//   onBack: () => void;
//   updateData: (data: any) => void;
//   selectedTeams: Team[];
// }

// export function InputMapDataStep({
//   onNext,
//   onBack,
//   updateData,
//   selectedTeams,
// }: Props) {
//   const [maps, setMaps] = useState<MapData[]>([
//     {
//       map_name: "Bermuda",
//       teams: selectedTeams.map((team) => ({
//         team_id: team.team_id,
//         placement: 0,
//         played: true,
//         players:
//           team.members?.map((member) => ({
//             user_id: member.user_id,
//             kills: 0,
//             damage: 0,
//             assists: 0,
//             played: true,
//           })) || [],
//       })),
//     },
//   ]);

//   const [selectedMapIndex, setSelectedMapIndex] = useState(0);

//   const addMap = () => {
//     const newMap: MapData = {
//       map_name: `Map ${maps.length + 1}`,
//       teams: selectedTeams.map((team) => ({
//         team_id: team.team_id,
//         placement: 0,
//         played: true,
//         players:
//           team.members?.map((member) => ({
//             user_id: member.user_id,
//             kills: 0,
//             damage: 0,
//             assists: 0,
//             played: true,
//           })) || [],
//       })),
//     };
//     setMaps([...maps, newMap]);
//     setSelectedMapIndex(maps.length);
//   };

//   const updateMapName = (index: number, name: string) => {
//     const newMaps = [...maps];
//     newMaps[index].map_name = name;
//     setMaps(newMaps);
//   };

//   const updateTeamPlacement = (
//     mapIndex: number,
//     teamId: number,
//     placement: number,
//   ) => {
//     const newMaps = [...maps];
//     const teamIndex = newMaps[mapIndex].teams.findIndex(
//       (t) => t.team_id === teamId,
//     );
//     if (teamIndex !== -1) {
//       newMaps[mapIndex].teams[teamIndex].placement = placement;
//       setMaps(newMaps);
//     }
//   };

//   const updatePlayerData = (
//     mapIndex: number,
//     teamId: number,
//     userId: number,
//     field: keyof PlayerMapData,
//     value: number | boolean,
//   ) => {
//     const newMaps = [...maps];
//     const teamIndex = newMaps[mapIndex].teams.findIndex(
//       (t) => t.team_id === teamId,
//     );
//     if (teamIndex !== -1) {
//       const playerIndex = newMaps[mapIndex].teams[teamIndex].players.findIndex(
//         (p) => p.user_id === userId,
//       );
//       if (playerIndex !== -1) {
//         newMaps[mapIndex].teams[teamIndex].players[playerIndex][field] =
//           value as never;
//         setMaps(newMaps);
//       }
//     }
//   };

//   const handleContinue = () => {
//     updateData({ map_data: maps });
//     onNext();
//   };

//   const currentMap = maps[selectedMapIndex];

//   return (
//     <Card className="gap-0">
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <span>Input Map Data</span>
//           <Button variant="outline" size="sm" onClick={addMap}>
//             <IconPlus size={14} className="mr-2" />
//             <span className="hidden md:inline-block">Add Map</span>
//           </Button>
//         </CardTitle>
//         <CardDescription>
//           Enter placement and kills for each team on each map. You can input
//           data for multiple maps at once.
//         </CardDescription>
//       </CardHeader>
//       <CardContent className="pt-4">
//         {/* Map Tabs */}
//         <div className="space-y-4">
//           <div className="space-y-2">
//             <Label>Select Maps to View/Edit</Label>
//             <div className="flex gap-2 overflow-x-auto pb-2">
//               {maps.map((map, index) => (
//                 <Button
//                   key={index}
//                   variant={selectedMapIndex === index ? "default" : "outline"}
//                   size="sm"
//                   onClick={() => setSelectedMapIndex(index)}
//                   className="whitespace-nowrap"
//                 >
//                   {map.map_name}
//                 </Button>
//               ))}
//             </div>
//           </div>

//           {/* Current Map Editor */}
//           {currentMap && (
//             <div className="space-y-4">
//               {/* Map Name */}
//               <div className="space-y-2">
//                 <Label>Map Name</Label>
//                 <Input
//                   value={currentMap.map_name}
//                   onChange={(e) =>
//                     updateMapName(selectedMapIndex, e.target.value)
//                   }
//                   placeholder="e.g., Bermuda, Kalahari, etc."
//                 />
//               </div>

//               {/* Teams Data */}
//               {currentMap.teams.map((teamData) => {
//                 const team = selectedTeams.find(
//                   (t) => t.team_id === teamData.team_id,
//                 );
//                 if (!team) return null;

//                 return (
//                   <Card key={teamData.team_id} className="py-1">
//                     <CardContent className="p-4">
//                       <div className="space-y-4">
//                         {/* Team Header */}
//                         <div className="flex items-center justify-between">
//                           <h3 className="font-semibold">{team.team_name}</h3>
//                         </div>

//                         {/* Team Placement */}
//                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                           <div className="space-y-2">
//                             <Label>Placement on {currentMap.map_name}</Label>
//                             <Input
//                               type="number"
//                               min="0"
//                               value={teamData.placement || ""}
//                               onChange={(e) =>
//                                 updateTeamPlacement(
//                                   selectedMapIndex,
//                                   teamData.team_id,
//                                   parseInt(e.target.value) || 0,
//                                 )
//                               }
//                             />
//                           </div>
//                         </div>

//                         {/* Players */}
//                         {teamData.players.length > 0 && (
//                           <div className="space-y-2">
//                             <Label>
//                               Players & Kills on {currentMap.map_name}
//                             </Label>
//                             <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
//                               {teamData.players.map((playerData) => {
//                                 const player = team.members?.find(
//                                   (m) => m.user_id === playerData.user_id,
//                                 );
//                                 return (
//                                   <div
//                                     key={playerData.user_id}
//                                     className="flex items-center gap-2 p-2 border rounded-md"
//                                   >
//                                     <Checkbox
//                                       checked={playerData.played}
//                                       onCheckedChange={(checked) =>
//                                         updatePlayerData(
//                                           selectedMapIndex,
//                                           teamData.team_id,
//                                           playerData.user_id,
//                                           "played",
//                                           !!checked,
//                                         )
//                                       }
//                                     />
//                                     <div className="flex-1">
//                                       <p className="text-sm font-medium">
//                                         {player?.username ||
//                                           `Player ${playerData.user_id}`}
//                                       </p>
//                                     </div>
//                                     <Input
//                                       type="number"
//                                       min="0"
//                                       placeholder="Kills"
//                                       className="w-20"
//                                       value={playerData.kills || ""}
//                                       onChange={(e) =>
//                                         updatePlayerData(
//                                           selectedMapIndex,
//                                           teamData.team_id,
//                                           playerData.user_id,
//                                           "kills",
//                                           parseInt(e.target.value) || 0,
//                                         )
//                                       }
//                                       disabled={!playerData.played}
//                                     />
//                                   </div>
//                                 );
//                               })}
//                             </div>
//                           </div>
//                         )}
//                       </div>
//                     </CardContent>
//                   </Card>
//                 );
//               })}
//             </div>
//           )}
//         </div>

//         <div className="flex justify-between pt-6">
//           <Button variant="ghost" onClick={onBack}>
//             Back
//           </Button>
//           <Button onClick={handleContinue}>
//             Continue to Generate Leaderboard (2 teams selected)
//           </Button>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { IconPlus } from "@tabler/icons-react";
import { env } from "@/lib/env";

interface Member {
  id: number;
  uid: string;
  username: string;
  management_role: string;
  in_game_role: string | null;
  join_date: string;
}

interface Team {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  members?: Member[];
}

interface PlayerMapData {
  id: number; // This is the member id from the team
  uid: string;
  username: string;
  kills: number;
  damage: number;
  assists: number;
  played: boolean;
}

interface TeamMapData {
  team_id: number;
  placement: number;
  played: boolean;
  players: PlayerMapData[];
}

interface MapData {
  map_name: string;
  teams: TeamMapData[];
}

interface Props {
  onNext: () => void;
  onBack: () => void;
  updateData: (data: any) => void;
  selectedTeams: Team[];
}

export function InputMapDataStep({
  onNext,
  onBack,
  updateData,
  selectedTeams,
}: Props) {
  const [maps, setMaps] = useState<MapData[]>([
    {
      map_name: "Bermuda",
      teams: selectedTeams.map((team) => ({
        team_id: team.team_id,
        placement: 0,
        played: true,
        players:
          team.members?.map((member) => ({
            id: member.id,
            uid: member.uid,
            username: member.username,
            kills: 0,
            damage: 0,
            assists: 0,
            played: true,
          })) || [],
      })),
    },
  ]);

  const [selectedMapIndex, setSelectedMapIndex] = useState(0);

  const addMap = () => {
    const newMap: MapData = {
      map_name: `Map ${maps.length + 1}`,
      teams: selectedTeams.map((team) => ({
        team_id: team.team_id,
        placement: 0,
        played: true,
        players:
          team.members?.map((member) => ({
            id: member.id,
            uid: member.uid,
            username: member.username,
            kills: 0,
            damage: 0,
            assists: 0,
            played: true,
          })) || [],
      })),
    };
    setMaps([...maps, newMap]);
    setSelectedMapIndex(maps.length);
  };

  const updateMapName = (index: number, name: string) => {
    const newMaps = [...maps];
    newMaps[index].map_name = name;
    setMaps(newMaps);
  };

  const updateTeamPlacement = (
    mapIndex: number,
    teamId: number,
    placement: number,
  ) => {
    const newMaps = [...maps];
    const teamIndex = newMaps[mapIndex].teams.findIndex(
      (t) => t.team_id === teamId,
    );
    if (teamIndex !== -1) {
      newMaps[mapIndex].teams[teamIndex].placement = placement;
      setMaps(newMaps);
    }
  };

  const updatePlayerData = (
    mapIndex: number,
    teamId: number,
    playerId: number,
    field: keyof PlayerMapData,
    value: number | boolean,
  ) => {
    const newMaps = [...maps];
    const teamIndex = newMaps[mapIndex].teams.findIndex(
      (t) => t.team_id === teamId,
    );
    if (teamIndex !== -1) {
      const playerIndex = newMaps[mapIndex].teams[teamIndex].players.findIndex(
        (p) => p.id === playerId,
      );
      if (playerIndex !== -1) {
        newMaps[mapIndex].teams[teamIndex].players[playerIndex][field] =
          value as never;
        setMaps(newMaps);
      }
    }
  };

  const handleContinue = () => {
    updateData({ map_data: maps });
    onNext();
  };

  const currentMap = maps[selectedMapIndex];

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Input Map Data</span>
          <Button variant="outline" size="sm" onClick={addMap}>
            <IconPlus size={14} className="mr-2" />
            <span className="hidden md:inline-block">Add Map</span>
          </Button>
        </CardTitle>
        <CardDescription>
          Enter placement and kills for each team on each map. You can input
          data for multiple maps at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Map Tabs */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Maps to View/Edit</Label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {maps.map((map, index) => (
                <Button
                  key={index}
                  variant={selectedMapIndex === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMapIndex(index)}
                  className="whitespace-nowrap"
                >
                  {map.map_name}
                </Button>
              ))}
            </div>
          </div>

          {/* Current Map Editor */}
          {currentMap && (
            <div className="space-y-4">
              {/* Map Name */}
              <div className="space-y-2">
                <Label>Map Name</Label>
                <Input
                  value={currentMap.map_name}
                  onChange={(e) =>
                    updateMapName(selectedMapIndex, e.target.value)
                  }
                  placeholder="e.g., Bermuda, Kalahari, etc."
                />
              </div>

              {/* Teams Data */}
              {currentMap.teams.map((teamData) => {
                const team = selectedTeams.find(
                  (t) => t.team_id === teamData.team_id,
                );
                if (!team) return null;

                return (
                  <Card key={teamData.team_id} className="py-1">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        {/* Team Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {team.team_logo && (
                              <img
                                src={`${env.NEXT_PUBLIC_BACKEND_API_URL}${team.team_logo}`}
                                alt={team.team_name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            )}
                            <h3 className="font-semibold">{team.team_name}</h3>
                          </div>
                        </div>

                        {/* Team Placement */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Placement on {currentMap.map_name}</Label>
                            <Input
                              type="number"
                              min="0"
                              value={teamData.placement || ""}
                              onChange={(e) =>
                                updateTeamPlacement(
                                  selectedMapIndex,
                                  teamData.team_id,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Players */}
                        {teamData.players.length > 0 && (
                          <div className="space-y-2">
                            <Label>
                              Players & Kills on {currentMap.map_name}
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {teamData.players.map((playerData) => {
                                return (
                                  <div
                                    key={playerData.id}
                                    className="flex items-center gap-2 p-2 border rounded-md"
                                  >
                                    <Checkbox
                                      checked={playerData.played}
                                      onCheckedChange={(checked) =>
                                        updatePlayerData(
                                          selectedMapIndex,
                                          teamData.team_id,
                                          playerData.id,
                                          "played",
                                          !!checked,
                                        )
                                      }
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">
                                        {playerData.username}
                                      </p>
                                    </div>
                                    <Input
                                      type="number"
                                      min="0"
                                      placeholder="Kills"
                                      className="w-20"
                                      value={playerData.kills || ""}
                                      onChange={(e) =>
                                        updatePlayerData(
                                          selectedMapIndex,
                                          teamData.team_id,
                                          playerData.id,
                                          "kills",
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                      disabled={!playerData.played}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-6">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue}>
            Continue to Generate Leaderboard (2 teams selected)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
