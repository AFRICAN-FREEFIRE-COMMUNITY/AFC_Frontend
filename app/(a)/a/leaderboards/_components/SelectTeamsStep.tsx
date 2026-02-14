// // "use client";

// // import React, { useState, useEffect } from "react";
// // import {
// //   Card,
// //   CardContent,
// //   CardDescription,
// //   CardHeader,
// //   CardTitle,
// // } from "@/components/ui/card";
// // import { Input } from "@/components/ui/input";
// // import { Button } from "@/components/ui/button";
// // import { Label } from "@/components/ui/label";
// // import { Checkbox } from "@/components/ui/checkbox";
// // import { IconSearch, IconLoader2 } from "@tabler/icons-react";
// // import { env } from "@/lib/env";
// // import { useAuth } from "@/contexts/AuthContext";

// // interface Team {
// //   team_id: number;
// //   team_name: string;
// //   members?: any[];
// // }

// // interface Props {
// //   onNext: () => void;
// //   onBack: () => void;
// //   updateData: (data: any) => void;
// //   groupId: string;
// // }

// // export function SelectTeamsStep({
// //   onNext,
// //   onBack,
// //   updateData,
// //   groupId,
// // }: Props) {
// //   const { token } = useAuth();
// //   const [teams, setTeams] = useState<Team[]>([]);
// //   const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
// //   const [searchQuery, setSearchQuery] = useState("");
// //   const [loading, setLoading] = useState(true);

// //   useEffect(() => {
// //     // Fetch teams for the selected group
// //     const fetchTeams = async () => {
// //       try {
// //         setLoading(true);
// //         const res = await fetch(
// //           `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`,
// //           {
// //             headers: {
// //               Authorization: `Bearer ${token}`,
// //             },
// //           },
// //         );
// //         const data = await res.json();
// //         setTeams(data.teams || []);
// //       } catch (error) {
// //         console.error("Error fetching teams:", error);
// //       } finally {
// //         setLoading(false);
// //       }
// //     };

// //     if (groupId) {
// //       fetchTeams();
// //     }
// //   }, [groupId, token]);

// //   const handleToggleTeam = (team: Team) => {
// //     setSelectedTeams((prev) => {
// //       const isSelected = prev.some((t) => t.team_id === team.team_id);
// //       if (isSelected) {
// //         return prev.filter((t) => t.team_id !== team.team_id);
// //       } else {
// //         return [...prev, team];
// //       }
// //     });
// //   };

// //   const handleRemoveTeam = (teamId: number) => {
// //     setSelectedTeams((prev) => prev.filter((t) => t.team_id !== teamId));
// //   };

// //   const filteredTeams = teams.filter((team) =>
// //     team.team_name.toLowerCase().includes(searchQuery.toLowerCase()),
// //   );

// //   const handleContinue = () => {
// //     updateData({ selected_teams: selectedTeams });
// //     onNext();
// //   };

// //   return (
// //     <Card className="gap-0">
// //       <CardHeader>
// //         <CardTitle>Select Teams</CardTitle>
// //         <CardDescription>
// //           Search and choose the teams that will participate in this leaderboard
// //         </CardDescription>
// //       </CardHeader>
// //       <CardContent className="pt-4">
// //         <div className="space-y-4">
// //           {/* Search Input */}
// //           <div className="space-y-2">
// //             <Label>Search Teams</Label>
// //             <div className="relative">
// //               <IconSearch
// //                 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
// //                 size={18}
// //               />
// //               <Input
// //                 placeholder="Search by team name..."
// //                 value={searchQuery}
// //                 onChange={(e) => setSearchQuery(e.target.value)}
// //                 className="pl-10"
// //               />
// //             </div>
// //           </div>

// //           {/* Search Results */}
// //           <div className="space-y-2">
// //             <Label>Search Results</Label>
// //             {loading ? (
// //               <div className="flex items-center justify-center py-8">
// //                 <IconLoader2 className="animate-spin" size={24} />
// //               </div>
// //             ) : (
// //               <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
// //                 {filteredTeams.length === 0 ? (
// //                   <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
// //                     No teams found
// //                   </p>
// //                 ) : (
// //                   filteredTeams.map((team) => {
// //                     const isSelected = selectedTeams.some(
// //                       (t) => t.team_id === team.team_id,
// //                     );
// //                     return (
// //                       <div
// //                         key={team.team_id}
// //                         className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
// //                           isSelected
// //                             ? "border-primary bg-primary/10"
// //                             : "hover:bg-muted/50"
// //                         }`}
// //                         onClick={() => handleToggleTeam(team)}
// //                       >
// //                         <Checkbox checked={isSelected} />
// //                         <span className="text-sm font-medium">
// //                           {team.team_name}
// //                         </span>
// //                       </div>
// //                     );
// //                   })
// //                 )}
// //               </div>
// //             )}
// //           </div>

// //           {/* Selected Teams */}
// //           {selectedTeams.length > 0 && (
// //             <div className="space-y-2">
// //               <Label>Selected Teams ({selectedTeams.length})</Label>
// //               <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
// //                 {selectedTeams.map((team) => (
// //                   <div
// //                     key={team.team_id}
// //                     className="flex items-center justify-between p-2 bg-background rounded-md"
// //                   >
// //                     <span className="text-sm font-medium">
// //                       {team.team_name}
// //                     </span>
// //                     <Button
// //                       variant="ghost"
// //                       size="sm"
// //                       className="text-destructive hover:text-destructive"
// //                       onClick={() => handleRemoveTeam(team.team_id)}
// //                     >
// //                       Remove
// //                     </Button>
// //                   </div>
// //                 ))}
// //               </div>
// //             </div>
// //           )}
// //         </div>

// //         <div className="flex gap-4 pt-6">
// //           <Button variant="secondary" onClick={onBack}>
// //             Back
// //           </Button>
// //           <Button
// //             onClick={handleContinue}
// //             disabled={selectedTeams.length === 0}
// //           >
// //             Continue to Map Data ({selectedTeams.length} teams selected)
// //           </Button>
// //         </div>
// //       </CardContent>
// //     </Card>
// //   );
// // }

// "use client";

// import React, { useState, useEffect } from "react";
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
// import { IconSearch, IconLoader2 } from "@tabler/icons-react";
// import { env } from "@/lib/env";
// import { useAuth } from "@/contexts/AuthContext";

// interface Member {
//   id: number;
//   uid: string;
//   username: string;
//   management_role: string;
//   in_game_role: string | null;
//   join_date: string;
// }

// interface Team {
//   team_id: number;
//   team_name: string;
//   team_logo: string | null;
//   team_tag: string | null;
//   team_creator: string;
//   team_owner: string;
//   country: string;
//   member_count: number;
//   members?: Member[];
// }

// interface Props {
//   onNext: () => void;
//   onBack: () => void;
//   updateData: (data: any) => void;
//   groupId: string;
// }

// export function SelectTeamsStep({
//   onNext,
//   onBack,
//   updateData,
//   groupId,
// }: Props) {
//   const { token } = useAuth();
//   const [teams, setTeams] = useState<Team[]>([]);
//   const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [fetchingDetails, setFetchingDetails] = useState(false);

//   useEffect(() => {
//     // Fetch all teams
//     const fetchTeams = async () => {
//       try {
//         setLoading(true);
//         const res = await fetch(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`,
//           {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           },
//         );
//         const data = await res.json();
//         setTeams(data.teams || []);
//       } catch (error) {
//         console.error("Error fetching teams:", error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchTeams();
//   }, [token]);

//   const handleToggleTeam = async (team: Team) => {
//     const isSelected = selectedTeams.some((t) => t.team_id === team.team_id);

//     if (isSelected) {
//       // Remove team from selection
//       setSelectedTeams((prev) =>
//         prev.filter((t) => t.team_id !== team.team_id),
//       );
//     } else {
//       // Fetch team details with members before adding
//       try {
//         setFetchingDetails(true);
//         const res = await fetch(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//               Authorization: `Bearer ${token}`,
//             },
//             body: JSON.stringify({ team_name: team.team_name }),
//           },
//         );
//         const data = await res.json();

//         if (data.team) {
//           // Merge the team data with members
//           const teamWithMembers = {
//             ...team,
//             members: data.team.members || [],
//           };
//           setSelectedTeams((prev) => [...prev, teamWithMembers]);
//         }
//       } catch (error) {
//         console.error("Error fetching team details:", error);
//         // Add without members as fallback
//         setSelectedTeams((prev) => [...prev, { ...team, members: [] }]);
//       } finally {
//         setFetchingDetails(false);
//       }
//     }
//   };

//   const handleRemoveTeam = (teamId: number) => {
//     setSelectedTeams((prev) => prev.filter((t) => t.team_id !== teamId));
//   };

//   const filteredTeams = teams.filter((team) =>
//     team.team_name.toLowerCase().includes(searchQuery.toLowerCase()),
//   );

//   const handleContinue = () => {
//     updateData({ selected_teams: selectedTeams });
//     onNext();
//   };

//   return (
//     <Card className="gap-0">
//       <CardHeader>
//         <CardTitle>Select Teams</CardTitle>
//         <CardDescription>
//           Search and choose the teams that will participate in this leaderboard
//         </CardDescription>
//       </CardHeader>
//       <CardContent className="pt-4">
//         <div className="space-y-4">
//           {/* Search Input */}
//           <div className="space-y-2">
//             <Label>Search Teams</Label>
//             <div className="relative">
//               <IconSearch
//                 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
//                 size={18}
//               />
//               <Input
//                 placeholder="Search by team name..."
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 className="pl-10"
//               />
//             </div>
//           </div>

//           {/* Search Results */}
//           <div className="space-y-2">
//             <Label>Search Results</Label>
//             {loading ? (
//               <div className="flex items-center justify-center py-8">
//                 <IconLoader2 className="animate-spin" size={24} />
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
//                 {filteredTeams.length === 0 ? (
//                   <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
//                     No teams found
//                   </p>
//                 ) : (
//                   filteredTeams.map((team) => {
//                     const isSelected = selectedTeams.some(
//                       (t) => t.team_id === team.team_id,
//                     );
//                     return (
//                       <div
//                         key={team.team_id}
//                         className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
//                           isSelected
//                             ? "border-primary bg-primary/10"
//                             : "hover:bg-muted/50"
//                         }`}
//                         onClick={() => handleToggleTeam(team)}
//                       >
//                         <Checkbox
//                           checked={isSelected}
//                           disabled={fetchingDetails}
//                         />
//                         <div className="flex items-center gap-2 flex-1">
//                           {team.team_logo && (
//                             <img
//                               src={`${env.NEXT_PUBLIC_BACKEND_API_URL}${team.team_logo}`}
//                               alt={team.team_name}
//                               className="w-6 h-6 rounded-full object-cover"
//                             />
//                           )}
//                           <span className="text-sm font-medium">
//                             {team.team_name}
//                           </span>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//               </div>
//             )}
//           </div>

//           {/* Selected Teams */}
//           {selectedTeams.length > 0 && (
//             <div className="space-y-2">
//               <Label>Selected Teams ({selectedTeams.length})</Label>
//               <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
//                 {selectedTeams.map((team) => (
//                   <div
//                     key={team.team_id}
//                     className="flex items-center justify-between p-2 bg-background rounded-md"
//                   >
//                     <div className="flex items-center gap-2">
//                       {team.team_logo && (
//                         <img
//                           src={`${env.NEXT_PUBLIC_BACKEND_API_URL}${team.team_logo}`}
//                           alt={team.team_name}
//                           className="w-6 h-6 rounded-full object-cover"
//                         />
//                       )}
//                       <div>
//                         <span className="text-sm font-medium">
//                           {team.team_name}
//                         </span>
//                         <p className="text-xs text-muted-foreground">
//                           {team.members?.length || 0} members
//                         </p>
//                       </div>
//                     </div>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       className="text-destructive hover:text-destructive"
//                       onClick={() => handleRemoveTeam(team.team_id)}
//                     >
//                       Remove
//                     </Button>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         <div className="flex gap-4 pt-6">
//           <Button variant="secondary" onClick={onBack}>
//             Back
//           </Button>
//           <Button
//             onClick={handleContinue}
//             disabled={selectedTeams.length === 0 || fetchingDetails}
//           >
//             {fetchingDetails ? (
//               <>
//                 <IconLoader2 className="animate-spin mr-2" size={16} />
//                 Loading team details...
//               </>
//             ) : (
//               `Continue to Map Data (${selectedTeams.length} teams selected)`
//             )}
//           </Button>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

"use client";

import React, { useState, useEffect } from "react";
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
import { IconSearch, IconLoader2 } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

interface TournamentMember {
  player_id: number;
  username: string;
}

interface TournamentTeam {
  tournament_team_id: number;
  team_id: number;
  team_name: string;
  status: string;
  members: TournamentMember[];
}

interface Member {
  id: number;
  uid: string;
  username: string;
  management_role: string;
  in_game_role: string | null;
  join_date: string;
}

interface Team {
  tournament_team_id: number; // ID for this team in the tournament context
  team_id: number;
  team_name: string;
  team_logo: string | null;
  team_tag: string | null;
  team_creator: string;
  team_owner: string;
  country: string;
  member_count: number;
  status: string;
  members?: Member[];
}

interface Props {
  onNext: () => void;
  onBack: () => void;
  updateData: (data: any) => void;
  eventSlug: string; // Changed from groupId to eventSlug
}

export function SelectTeamsStep({
  onNext,
  onBack,
  updateData,
  eventSlug,
}: Props) {
  const { token } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  console.log("first", eventSlug);

  useEffect(() => {
    // Fetch tournament teams from event details
    const fetchTournamentTeams = async () => {
      try {
        setLoading(true);
        console.log("tomiwa");
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-event-details/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ slug: eventSlug }),
          },
        );
        const data = await res.json();

        console.log(data);

        // Extract tournament_teams from event_details
        const tournamentTeams = data.event_details?.tournament_teams || [];

        // Fetch full team details for each tournament team
        const teamsWithDetails = await Promise.all(
          tournamentTeams.map(async (tournamentTeam: TournamentTeam) => {
            try {
              const teamRes = await fetch(
                `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ team_name: tournamentTeam.team_name }),
                },
              );
              const teamData = await teamRes.json();

              if (teamData.team) {
                // Merge tournament team data with full team details
                return {
                  ...teamData.team,
                  tournament_team_id: tournamentTeam.tournament_team_id,
                  status: tournamentTeam.status,
                };
              }
            } catch (error) {
              console.error(
                `Error fetching details for team ${tournamentTeam.team_name}:`,
                error,
              );
            }

            // Fallback: return tournament team data as-is
            return {
              tournament_team_id: tournamentTeam.tournament_team_id,
              team_id: tournamentTeam.team_id,
              team_name: tournamentTeam.team_name,
              status: tournamentTeam.status,
              team_logo: null,
              team_tag: null,
              team_creator: "",
              team_owner: "",
              country: "",
              member_count: tournamentTeam.members?.length || 0,
              members: tournamentTeam.members?.map((m) => ({
                id: m.player_id,
                uid: "",
                username: m.username,
                management_role: "",
                in_game_role: null,
                join_date: "",
              })),
            };
          }),
        );

        setTeams(teamsWithDetails.filter(Boolean) as Team[]);
      } catch (error) {
        console.error("Error fetching tournament teams:", error);
      } finally {
        setLoading(false);
      }
    };

    if (eventSlug) {
      fetchTournamentTeams();
    }
  }, [eventSlug, token]);

  const handleToggleTeam = (team: Team) => {
    const isSelected = selectedTeams.some(
      (t) => t.tournament_team_id === team.tournament_team_id,
    );

    if (isSelected) {
      // Remove team from selection
      setSelectedTeams((prev) =>
        prev.filter((t) => t.tournament_team_id !== team.tournament_team_id),
      );
    } else {
      // Team already has members from initial fetch, just add it
      setSelectedTeams((prev) => [...prev, team]);
    }
  };

  const handleRemoveTeam = (tournamentTeamId: number) => {
    setSelectedTeams((prev) =>
      prev.filter((t) => t.tournament_team_id !== tournamentTeamId),
    );
  };

  const filteredTeams = teams.filter((team) =>
    team.team_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleContinue = () => {
    updateData({ selected_teams: selectedTeams });
    onNext();
  };

  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>Select Teams</CardTitle>
        <CardDescription>
          Search and choose the teams that will participate in this leaderboard
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label>Search Teams</Label>
            <div className="relative">
              <IconSearch
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <Input
                placeholder="Search by team name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-2">
            <Label>Search Results</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="animate-spin" size={24} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                {filteredTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-4">
                    No teams found
                  </p>
                ) : (
                  filteredTeams.map((team) => {
                    const isSelected = selectedTeams.some(
                      (t) => t.tournament_team_id === team.tournament_team_id,
                    );
                    return (
                      <div
                        key={team.tournament_team_id}
                        className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => handleToggleTeam(team)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex items-center gap-2 flex-1">
                          {team.team_logo && (
                            <img
                              src={`${env.NEXT_PUBLIC_BACKEND_API_URL}${team.team_logo}`}
                              alt={team.team_name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          )}
                          <span className="text-sm font-medium">
                            {team.team_name}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Selected Teams */}
          {selectedTeams.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Teams ({selectedTeams.length})</Label>
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                {selectedTeams.map((team) => (
                  <div
                    key={team.tournament_team_id}
                    className="flex items-center justify-between p-2 bg-background rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      {team.team_logo && (
                        <img
                          src={`${env.NEXT_PUBLIC_BACKEND_API_URL}${team.team_logo}`}
                          alt={team.team_name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <span className="text-sm font-medium">
                          {team.team_name}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {team.members?.length || 0} members
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveTeam(team.tournament_team_id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-6">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={selectedTeams.length === 0}
          >
            Continue to Map Data ({selectedTeams.length} teams selected)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
