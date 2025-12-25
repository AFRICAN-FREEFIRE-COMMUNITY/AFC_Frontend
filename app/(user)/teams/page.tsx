"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { FullLoader, Loader } from "@/components/Loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";

function page() {
  const [search, setSearch] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const { user, token } = useAuth();

  const [pending, startTransition] = useTransition();
  const [teams, setTeams] = useState<any[]>([]);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [appliedTeams, setAppliedTeams] = useState<Set<number>>(new Set());

  // Filter teams based on search input
  const filteredTeams = teams.filter((team) =>
    team.team_name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`
        );

        if (res.statusText === "OK") {
          setTeams(res.data.teams);
        } else {
          toast.error("Oops! An error occurred");
        }

        const resCurrent = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (resCurrent.statusText === "OK") {
          setMyTeam(resCurrent.data.team);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data.message);
      }
    });
  }, [token]);

  const [pendingRequest, startRequestTransition] = useTransition();

  const handleApply = (teamId: any) => {
    startRequestTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/send-join-request/`,
          { team_id: teamId, message: applicationMessage },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(res.data.message);

        // Add team to applied teams set
        setAppliedTeams((prev) => new Set(prev).add(teamId));

        // Close the dialog
        setDialogOpen(false);

        // Reset selected team and message
        setSelectedTeam(null);
        setApplicationMessage("");
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  if (pending) return <FullLoader />;

  return (
    <div>
      <div className="flex items-start mb-4 md:items-center justify-between gap-2 flex-col md:flex-row">
        <PageHeader
          title="Teams"
          description="Explore and manage Freefire teams"
        />
        <Button className="w-full md:w-auto" asChild>
          <Link href="/teams/create">Create Team</Link>
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </div>

      <Tabs defaultValue="all-teams" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="all-teams">All Teams</TabsTrigger>
          <TabsTrigger value="my-team">My Team</TabsTrigger>
        </TabsList>

        <TabsContent value="all-teams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Teams</CardTitle>
              <CardDescription>
                View and manage all teams in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {filteredTeams.length > 0 ? (
                  filteredTeams.map((team: any) => (
                    <Card
                      key={team.team_name}
                      className={`card-hover gap-1.5 ${
                        team.is_banned ? "border-destructive" : ""
                      }`}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 capitalize">
                          <Avatar className="w-10 h-10">
                            <AvatarImage
                              src={team.team_logo}
                              alt={`${team.team_name} logo`}
                              className="object-cover"
                            />
                            <AvatarFallback>{team.team_name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="uppercase text-lg md:text-xl">
                            {team.team_name}
                          </span>
                          {team.is_banned && (
                            <Badge variant="destructive">BANNED</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm md:text-base">
                        <p>
                          Members: {team.member_count ? team.member_count : 0}
                        </p>
                        <p>Tier: {team.team_tier}</p>
                        <div className="flex gap-2 justify-between mt-6">
                          <Button
                            variant={"gradient"}
                            className="button-gradient flex-1"
                            asChild
                          >
                            <Link href={`/teams/${team.team_name}`}>
                              View Team
                            </Link>
                          </Button>
                          {team.team_owner !== user?.in_game_name && (
                            <Dialog
                              open={
                                dialogOpen &&
                                selectedTeam?.team_id === team.team_id
                              }
                              onOpenChange={(open) => {
                                setDialogOpen(open);
                                if (!open) {
                                  setSelectedTeam(null);
                                  setApplicationMessage("");
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setSelectedTeam(team);
                                    setDialogOpen(true);
                                  }}
                                  className="flex-1"
                                  disabled={
                                    team.is_banned ||
                                    team.member_count >= 6 ||
                                    appliedTeams.has(team.team_id)
                                  }
                                >
                                  {appliedTeams.has(team.team_id)
                                    ? "Applied"
                                    : "Apply to Join"}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Apply to Join {selectedTeam?.team_name}
                                  </DialogTitle>
                                  <DialogDescription>
                                    Send a message to the team owner with your
                                    application.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div>
                                    <Label
                                      htmlFor="application-message"
                                      className="mb-2.5"
                                    >
                                      Message
                                    </Label>
                                    <Textarea
                                      id="application-message"
                                      value={applicationMessage}
                                      onChange={(e) =>
                                        setApplicationMessage(e.target.value)
                                      }
                                      placeholder="Tell the team owner why you want to join..."
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    type="submit"
                                    disabled={pendingRequest}
                                    onClick={() =>
                                      handleApply(selectedTeam?.team_id)
                                    }
                                  >
                                    {pendingRequest ? (
                                      <Loader />
                                    ) : (
                                      "Send Application"
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    {search
                      ? "No teams found matching your search."
                      : "No teams available."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="my-team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Team</CardTitle>
              <CardDescription>View and manage my team</CardDescription>
            </CardHeader>
            <CardContent>
              {myTeam ? (
                <Card
                  className={`card-hover gap-1.5 ${
                    myTeam.is_banned ? "border-destructive" : ""
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Avatar className="w-10 h-10">
                        <AvatarImage
                          src={myTeam.team_logo}
                          alt={`${myTeam.team_name} logo`}
                          className="object-cover"
                        />
                        <AvatarFallback>{myTeam.team_name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="uppercase text-lg md:text-xl">
                        {myTeam.team_name}
                      </span>
                      {myTeam.is_banned && (
                        <Badge variant="destructive">BANNED</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm md:text-base">
                    <p>
                      Members: {myTeam.member_count ? myTeam.member_count : 0}
                    </p>
                    <p>Tier: {myTeam.team_tier}</p>
                    <div className="flex justify-between mt-4">
                      <Button variant={"gradient"} className="w-full" asChild>
                        <Link href={`/teams/${myTeam.team_name}`}>
                          View Team
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  You are not currently part of any team.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default page;
