"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { FullLoader, Loader } from "@/components/Loader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";

const page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pending, startTransition] = useTransition();
  const [discordConnected, setDiscordConnected] = useState(false);
  const { user, token } = useAuth();

  const checkDiscordConnection = async () => {
    if (!token) return;

    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/is-discord-account-connected/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setDiscordConnected(res.data.connected);
    } catch (error) {
      console.error("Error checking Discord status:", error);
    }
  };

  useEffect(() => {
    if (user && token) {
      checkDiscordConnection();
    }
  }, [user, token]);

  useEffect(() => {
    const discordStatus = searchParams.get("discord");

    if (discordStatus) {
      setTimeout(() => {
        if (discordStatus === "connected") {
          setDiscordConnected(true);
          toast.success("Discord account linked successfully!");
        } else {
          setDiscordConnected(false);
          toast.error(
            searchParams.get("message") || "Discord connection failed.",
          );
        }

        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete("discord");
        newSearchParams.delete("step");
        router.replace(
          `${window.location.pathname}?${newSearchParams.toString()}`,
          { scroll: false },
        );
      }, 50);
    }
  }, [searchParams, router]);

  const handleDiscordConnect = () => {
    // Construct the URL to your backend endpoint
    const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/connect-discord-account?session_token=${token}`;

    // Redirect the browser to start the OAuth flow
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!user) return <FullLoader />;

  return (
    <div>
      <PageHeader back title={`Player Profile`} />
      {user.is_banned && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Account Banned</AlertTitle>
          <AlertDescription>This account has been banned.</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <h2 className="text-2xl font-semibold text-center mb-2">
              {user.full_name}
            </h2>
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
            <div className="grid w-full gap-2">
              <Button className="w-full" asChild>
                <Link href="/profile/edit">Edit Profile</Link>
              </Button>
              <Button
                disabled={pending || discordConnected}
                onClick={handleDiscordConnect}
                variant={"secondary"}
                className="w-full"
              >
                {discordConnected ? (
                  "Connected to discord"
                ) : pending ? (
                  <Loader text="Connecting..." />
                ) : (
                  "Connect to discord"
                )}
              </Button>
            </div>
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
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_kills}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wins</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_wins}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MVPs</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_mvps}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Booyahs</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_booyahs}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tournaments</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_tournaments_played}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scrims</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {user?.stats.total_scrims_played}
                    </p>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="relative">
                    <ComingSoon />
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent
                value="achievements"
                className="relative overflow-hidden"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Achievement</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="relative">
                    <ComingSoon />
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default page;
