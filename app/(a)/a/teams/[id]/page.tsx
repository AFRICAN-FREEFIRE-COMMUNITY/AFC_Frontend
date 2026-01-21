// "use client";

// import { useState, useEffect, useTransition, use } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { ArrowLeft } from "lucide-react";
// import { Badge } from "@/components/ui/badge";
// // import { useToast } from "@/components/ui/use-toast";

// import axios from "axios";
// import { env } from "@/lib/env";
// import { toast } from "sonner";
// import { FullLoader } from "@/components/Loader";
// import { BanModal } from "../../_components/BanModal";
// import { PageHeader } from "@/components/PageHeader";
// import { Separator } from "@/components/ui/separator";
// import { NothingFound } from "@/components/NothingFound";

// type Params = Promise<{
//   id: string;
// }>;

// const page = ({ params }: { params: Params }) => {
//   const { id } = use(params);
//   const router = useRouter();
//   // const { toast } = useToast();
//   const [teamData, setTeamData] = useState<any>(null);
//   const [isLoading, setIsLoading] = useState<any>(true);
//   const [banModalOpen, setBanModalOpen] = useState<any>(false);
//   const [banDuration, setBanDuration] = useState<any>(7);
//   const [banReasons, setBanReasons] = useState<string[]>([]);

//   const [pending, startTransition] = useTransition();
//   const [teamDetails, setTeamDetails] = useState<any>();

//   useEffect(() => {
//     if (!id) return; // Don't run if id is not available yet

//     startTransition(async () => {
//       try {
//         const decodedId = decodeURIComponent(id);
//         const res = await axios.post(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
//           { team_name: decodedId }
//         );
//         setTeamDetails(res.data.team);
//       } catch (error: any) {
//         toast.error(error.response.data.message);
//       }
//     });
//   }, [id]);

//   if (pending) return <FullLoader />;

//   if (teamDetails)
//     return (
//       <div>
//         <div className="flex justify-between items-center mb-4">
//           <PageHeader title={`${teamDetails.team_name} Details`} back />
//           <BanModal
//             isBanned={teamDetails.is_banned}
//             teamName={teamDetails.team_name}
//             team_id={teamDetails.team_id}
//           />
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
//           <Card>
//             <CardHeader>
//               <CardTitle>Team Overview</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-3 font-medium text-sm">
//                 <p>Tier: {teamDetails.team_tier}</p>
//                 <Separator />
//                 <p>
//                   Total Wins:{" "}
//                   {teamDetails.total_wins ? teamDetails.total_wins : 0}
//                 </p>{" "}
//                 <Separator />
//                 <p>
//                   Total Losses:{" "}
//                   {teamDetails.total_losses ? teamDetails.total_losses : 0}
//                 </p>{" "}
//                 <Separator />
//                 <p>
//                   Win Rate: {teamDetails.win_rate ? teamDetails.win_rate : 0}
//                 </p>{" "}
//                 <Separator />
//                 <p>
//                   Total Earnings:$
//                   {teamDetails.total_earnings ? teamDetails.total_earnings : 0}
//                 </p>{" "}
//                 <Separator />
//                 <p>
//                   Average Kills:{" "}
//                   {teamDetails.average_kills ? teamDetails.average_kills : 0}
//                 </p>{" "}
//                 <Separator />
//                 <p>
//                   Average Placement:{" "}
//                   {teamDetails.average_placement
//                     ? teamDetails.average_placement
//                     : 0}
//                 </p>{" "}
//                 <Separator />
//                 <div className="flex items-center justify-start gap-2">
//                   <p>Status:</p>
//                   {teamDetails.isBanned ? (
//                     <Badge variant="destructive">Banned</Badge>
//                   ) : (
//                     <Badge variant="secondary">Active</Badge>
//                   )}
//                 </div>
//                 {teamDetails.is_banned && (
//                   <>
//                     <Separator />
//                     <p>Ban Reason: {teamDetails.ban_reason}</p>
//                   </>
//                 )}
//               </div>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <CardTitle>Team Members</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Name</TableHead>
//                     <TableHead>Role</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {teamDetails?.members?.map((member: any) => (
//                     <TableRow key={member.id}>
//                       <TableCell>{member.username}</TableCell>
//                       <TableCell className="capitalize">
//                         {member.in_game_role}
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//               {teamDetails?.members === undefined && (
//                 <NothingFound text="No team member yet" />
//               )}
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <CardTitle>Tournament Performance</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Tournament</TableHead>
//                     <TableHead>Placement</TableHead>
//                     <TableHead>Earnings</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {teamDetails?.tournament_performance?.map(
//                     (tournament: any, index: any) => (
//                       <TableRow key={index}>
//                         <TableCell>{tournament.name}</TableCell>
//                         <TableCell>{tournament.placement}</TableCell>
//                         <TableCell>{tournament.earnings}</TableCell>
//                       </TableRow>
//                     )
//                   )}
//                 </TableBody>
//               </Table>
//               {teamDetails?.tournament_performance === undefined && (
//                 <NothingFound text="No performance metrics yet" />
//               )}
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <CardTitle>Recent Matches</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Opponent</TableHead>
//                     <TableHead>Result</TableHead>
//                     <TableHead>Score</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {teamDetails?.recent_matches?.map(
//                     (match: any, index: any) => (
//                       <TableRow key={index}>
//                         <TableCell>{match.opponent}</TableCell>
//                         <TableCell>{match.result}</TableCell>
//                         <TableCell>{match.score}</TableCell>
//                       </TableRow>
//                     )
//                   )}
//                 </TableBody>
//               </Table>
//               {teamDetails?.recent_matches === undefined && (
//                 <NothingFound text="No matches yet" />
//               )}
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     );
// };

// export default page;

import { Metadata } from "next";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { TeamDetailsClient } from "../_components/TeamDetailsClient";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Shared data fetcher for team details
 * Supports optional authentication via cookies
 */
async function getTeamData(teamName: string, token?: string) {
  try {
    const decodedName = decodeURIComponent(teamName);

    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ team_name: decodedName }),
        cache: "no-store", // Always fetch fresh data for team stats
      },
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch team details:",
        response.status,
        response.statusText,
      );
      return null;
    }

    const data = await response.json();
    return data.team;
  } catch (error) {
    console.error("Error fetching team details:", error);
    return null;
  }
}

// --- SEO GENERATION ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // Read token from cookies for authenticated requests
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const team = await getTeamData(id, token);

  if (!team) {
    return {
      title: "Team Not Found | AFC",
      description: "The requested team could not be found.",
    };
  }

  // Create rich description
  const winRate = team.win_rate ? `${team.win_rate}% win rate` : "New team";
  const earnings = team.total_earnings
    ? `$${team.total_earnings} in earnings`
    : "No earnings yet";
  const description = `${team.team_name} - ${team.team_tier} tier team with ${winRate} and ${earnings}. View full stats and tournament history.`;

  return {
    title: `${team.team_name} - Team Profile | AFC`,
    description: description,
    openGraph: {
      title: `${team.team_name} - Team Profile`,
      description: description,
      type: "profile",
      images: team.team_logo
        ? [
            {
              url: team.team_logo.startsWith("http")
                ? team.team_logo
                : `${env.NEXT_PUBLIC_URL || ""}${team.team_logo}`,
              width: 400,
              height: 400,
              alt: `${team.team_name} logo`,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary",
      title: `${team.team_name} - Team Profile`,
      description: description,
      images: team.team_logo
        ? [
            team.team_logo.startsWith("http")
              ? team.team_logo
              : `${env.NEXT_PUBLIC_URL || ""}${team.team_logo}`,
          ]
        : [],
    },
  };
}

// --- PAGE RENDER ---
export default async function Page({ params }: Props) {
  const { id } = await params;

  // Read token from cookies for authenticated requests
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const team = await getTeamData(id, token);

  // If the team doesn't exist, trigger the Next.js 404 page
  if (!team) {
    notFound();
  }

  return <TeamDetailsClient teamId={id} initialData={team} />;
}
