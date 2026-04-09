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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  IconTrophy,
  IconCrosshair,
  IconAward,
  IconClipboardList,
} from "@tabler/icons-react";
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

export const ProfileContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pending, startTransition] = useTransition();
  const [discordConnected, setDiscordConnected] = useState(false);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
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

  const handleDiscordDisconnect = async () => {
    if (!token) return;

    startTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/disconnect-discord-account/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        setDiscordConnected(false);
        toast.success("Discord account disconnected.");
      } catch (error) {
        console.error("Error disconnecting Discord:", error);
        toast.error("Failed to disconnect Discord. Please try again.");
      }
    });
  };

  useEffect(() => {
    if (user && token) {
      checkDiscordConnection();
      setLoadingApplications(true);
      axios
        .get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-my-applications/`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((res) => setMyApplications(res.data))
        .catch(() => toast.error("Failed to load your applications."))
        .finally(() => setLoadingApplications(false));
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
            searchParams.get("message") ||
              "This account is already in use by another user.",
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
              {/* <Button
                disabled={pending}
                onClick={
                  discordConnected
                    ? handleDiscordDisconnect
                    : handleDiscordConnect
                }
                variant={discordConnected ? "destructive" : "secondary"} // Change color to red if connected
                className="w-full"
              >
                {pending ? (
                  <Loader
                    text={
                      discordConnected ? "Disconnecting..." : "Connecting..."
                    }
                  />
                ) : discordConnected ? (
                  `Disconnect Discord (${user.discord_username})`
                ) : (
                  "Connect to Discord"
                )}
              </Button> */}

              {discordConnected ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader text="Disconnecting..." />
                      ) : (
                        `Disconnect - ${user.discord_username}`
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will disconnect your Discord account from your
                        player profile. You will lose access to Discord-linked
                        features until you reconnect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDiscordDisconnect}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  disabled={pending}
                  onClick={handleDiscordConnect}
                  variant="secondary"
                  className="w-full"
                >
                  {pending ? (
                    <Loader text="Connecting..." />
                  ) : (
                    "Connect to Discord"
                  )}
                </Button>
              )}
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
                  <TabsTrigger value="applications">My Applications</TabsTrigger>
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

              <TabsContent value="applications">
                {loadingApplications ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : myApplications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <IconClipboardList className="h-10 w-10 opacity-40" />
                    <p className="text-sm font-medium">No applications yet</p>
                    <p className="text-xs">
                      Apply to teams from the Player Market
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myApplications.map((app) => {
                      const statusColors: Record<string, string> = {
                        PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                        SHORTLISTED: "bg-cyan-900/20 text-cyan-400 border-cyan-800",
                        INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
                        ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
                        TRIAL_EXTENDED: "bg-purple-900/20 text-purple-400 border-purple-800",
                        REJECTED: "bg-red-900/20 text-red-400 border-red-800",
                      };
                      return (
                        <div
                          key={app.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{app.team}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Applied {formatDate(app.applied_at)}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap shrink-0">
                            {/* Performance mini-stats */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <IconTrophy className="h-3 w-3 text-yellow-400" />
                                {app.tournament_wins}
                              </span>
                              <span className="flex items-center gap-1">
                                <IconCrosshair className="h-3 w-3 text-red-400" />
                                {app.total_tournament_kills}
                              </span>
                              <span className="flex items-center gap-1">
                                <IconAward className="h-3 w-3 text-blue-400" />
                                {app.tournament_finals_appearances}
                              </span>
                            </div>

                            <Badge
                              variant="outline"
                              className={`text-xs ${statusColors[app.status] ?? ""}`}
                            >
                              {app.status.replace("_", " ")}
                            </Badge>

                            {app.contact_unlocked && (
                              <Badge
                                variant="outline"
                                className="text-xs text-green-400 border-green-800"
                              >
                                Contact Unlocked
                              </Badge>
                            )}

                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/player-markets/applications/${app.id}`}>
                                View
                              </Link>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
