"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { FullLoader } from "@/components/Loader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/PageHeader";

const page = () => {
  const router = useRouter();
  // Mock user data - in a real app, this would come from an API or context
  const [userProfile, setUserProfile] = useState({
    name: "John Doe",
    username: "FireKing",
    uid: "123456789",
    team: "Team Alpha",
    avatar: "/placeholder.svg",
    role: "moderator", // or "super_admin" or "user"
    isBanned: true,
    banReason: "Violation of tournament rules",
    stats: {
      kills: 1500,
      wins: 50,
      mvps: 10,
      booyahs: 30,
      tournamentsParticipated: 15,
      scrimsParticipated: 25,
      rank: 1,
    },
    teamHistory: [
      { name: "Team Alpha", from: "2023-01-01", to: "Present" },
      { name: "Team Beta", from: "2022-06-01", to: "2022-12-31" },
      { name: "Team Gamma", from: "2022-01-01", to: "2022-05-31" },
    ],
    achievements: [
      { name: "Tournament MVP", date: "2023-05-15" },
      { name: "Highest Kill Streak", date: "2023-03-20" },
      { name: "Rookie of the Year", date: "2022-12-31" },
    ],
  });

  const adminCapabilities = {
    moderator: [
      "Update tournament and scrim results",
      "Edit leaderboards",
      "Create and manage news and announcements",
      "View overall performance of all teams and players",
      "View and publish rankings for teams and players",
      "View and manage team tiers",
      "View detailed information for any tournament",
      "Ban teams or players",
      "Upload screenshots for leaderboard generation",
    ],
    super_admin: [
      "Full access to all features and data",
      "Assign moderator roles to other users",
      "Perform all actions that a moderator can",
    ],
  };

  const { user } = useAuth();

  if (!user) return <FullLoader />;

  return (
    <div>
      <PageHeader back title={`Player Profile: ${user.full_name}`} />
      {user.isBanned && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Banned</AlertTitle>
          <AlertDescription>
            This account has been banned. Reason: {user.banReason}
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center">
            <Avatar className="w-32 h-32 mb-4">
              <AvatarImage
                src={user.profile_pic || DEFAULT_PROFILE_PICTURE}
                alt={`${user.full_name}'s picture`}
                className="object-cover"
              />
              <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold mb-2">{user.full_name}</h2>
            <p className="text-sm text-muted-foreground mb-2">
              @{user.in_game_name}
            </p>
            <p className="mb-2 text-sm">UID: {user.uid}</p>
            {user.team && (
              <p className="mb-4 text-sm">Team: {user.team || null}</p>
            )}
            {user.role !== "user" && (
              <Badge className="mb-4" variant="secondary">
                Role: <span className="capitalize">{user.role}</span>
              </Badge>
            )}
            <Button className="w-full" asChild>
              <Link href="/profile/edit">Edit Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Player Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <ScrollArea>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="history">Team History</TabsTrigger>
                  <TabsTrigger value="achievements">Achievements</TabsTrigger>
                  {user.role === "admin" && (
                    <TabsTrigger value="admin">Admin Capabilities</TabsTrigger>
                  )}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Kills</p>
                    <p className="text-lg md:text-xl font-semibold">0</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wins</p>
                    <p className="text-lg md:text-xl font-semibold">0</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MVPs</p>
                    <p className="text-lg md:text-xl font-semibold">0</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Booyahs</p>
                    <p className="text-lg md:text-xl font-semibold">0</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tournaments</p>
                    <p className="text-lg md:text-xl font-semibold">0</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scrims</p>
                    <p className="text-lg md:text-xl font-semibold">0</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Current Rank
                    </p>
                    <p className="text-lg md:text-xl font-semibold">0</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="history" className="relative overflow-hidden">
                {/* Blur Overlay */}
                <div className="absolute inset-0 backdrop-blur-sm bg-background/50 z-10 flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userProfile.teamHistory.map((team, index) => (
                      <TableRow key={index}>
                        <TableCell>{team.name}</TableCell>
                        <TableCell>{team.from}</TableCell>
                        <TableCell>{team.to}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent
                value="achievements"
                className="relative overflow-hidden"
              >
                {/* Blur Overlay */}
                <div className="absolute inset-0 backdrop-blur-sm bg-background/50 z-10 flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Achievement</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userProfile.achievements.map((achievement, index) => (
                      <TableRow key={index}>
                        <TableCell>{achievement.name}</TableCell>
                        <TableCell>{achievement.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              {userProfile.role !== "user" && (
                <TabsContent value="admin" className="relative overflow-hidden">
                  {/* Blur Overlay */}
                  <div className="absolute inset-0 backdrop-blur-sm bg-background/50 z-10 flex items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      Coming Soon
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-4">
                    Admin Capabilities
                  </h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {adminCapabilities[
                      userProfile.role as keyof typeof adminCapabilities
                    ].map((capability, index) => (
                      <li key={index}>{capability}</li>
                    ))}
                  </ul>
                  {userProfile.role === "moderator" ||
                  userProfile.role === "super_admin" ? (
                    <Button asChild className="mt-4">
                      <Link href="/admin/dashboard">Go to Admin Dashboard</Link>
                    </Button>
                  ) : null}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default page;
