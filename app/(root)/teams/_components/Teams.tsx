"use client";

import { useEffect, useState, useTransition } from "react";
import Layout from "@/components/Layout";
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
import { useToast } from "@/components/ui/use-toast";
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

export function Teams() {
  const [search, setSearch] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const { user, token } = useAuth();

  const [pending, startTransition] = useTransition();
  const [teams, setTeams] = useState<any[]>([]);
  const [myTeam, setMyTeam] = useState<any>(null);

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
          { team_id: teamId, message: "" },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(res.data.message);
        console.log(res.data);
        setSelectedTeam(null);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  };

  console.log(selectedTeam);

  if (pending) return <FullLoader />;

  return (
    <div className="container mx-auto px-4">
      <PageHeader
        title="Teams"
        description="Explore and manage Freefire teams"
        action={
          <Button asChild>
            <Link href="/teams/create">Create Team</Link>
          </Button>
        }
      />

      <div className="mb-6">
        <Input
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Tabs defaultValue="all-teams" className="space-y-4">
        <TabsList>
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTeams.length > 0 ? (
                  filteredTeams.map((team: any) => (
                    <Card
                      key={team.team_name}
                      className={`card-hover ${
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
                          <span className="uppercase">{team.team_name}</span>
                          {team.is_banned && (
                            <Badge variant="destructive">BANNED</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p>
                          Members: {team.member_count ? team.member_count : 0}
                        </p>
                        <p>Tier: {team.team_tier}</p>
                        <div className="flex justify-between mt-4">
                          <Button className="button-gradient" asChild>
                            <Link href={`/teams/${team.team_name}`}>
                              View Team
                            </Link>
                          </Button>
                          {team.team_owner !== user?.in_game_name && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  onClick={() => setSelectedTeam(team)}
                                  disabled={
                                    team.is_banned || team.team_members >= 6
                                  }
                                >
                                  Apply to Join
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
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label
                                      htmlFor="application-message"
                                      className="text-right"
                                    >
                                      Message
                                    </Label>
                                    <Textarea
                                      id="application-message"
                                      value={applicationMessage}
                                      onChange={(e) =>
                                        setApplicationMessage(e.target.value)
                                      }
                                      className="col-span-3"
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
                  className={`card-hover ${
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
                      {myTeam.team_name}
                      {myTeam.is_banned && (
                        <Badge variant="destructive">BANNED</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>
                      Members: {myTeam.team_members ? myTeam.team_members : 0}
                    </p>
                    <p>Tier: {myTeam.team_tier}</p>
                    <div className="flex justify-between mt-4">
                      <Button className="button-gradient" asChild>
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
