"use client";

import { useEffect, useState, useTransition } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FullLoader } from "@/components/Loader";

// Mock data for teams
const teamsData = [
  {
    id: "1",
    name: "Team Alpha",
    logo: "/team-alpha-logo.png",
    members: 5,
    tier: 1,
    isBanned: false,
  },
  {
    id: "2",
    name: "Team Beta",
    logo: "/team-beta-logo.png",
    members: 4,
    tier: 2,
    isBanned: false,
  },
  {
    id: "3",
    name: "Team Gamma",
    logo: "/team-gamma-logo.png",
    members: 5,
    tier: 1,
    isBanned: true,
  },
  // Add more mock data as needed
];

export function Teams() {
  const [search, setSearch] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  const [pending, startTransition] = useTransition();
  const [teams, setTeams] = useState<any>();

  const filteredTeams = teamsData.filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase())
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
      } catch (error: any) {
        toast.error(error?.response?.data.message);
      }
    });
  }, []);

  const handleApply = (teamId: any) => {
    // In a real application, you would send this request to your backend
    console.log(
      `Applying to team ${teamId} with message: ${applicationMessage}`
    );
    // toast({
    //   title: "Application Sent",
    //   description: "Your application has been sent to the team owner.",
    // });
    setApplicationMessage("");
    setSelectedTeam(null);
  };

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams &&
          teams?.map((team: any) => (
            <Card
              key={team.team_name}
              className={`card-hover ${
                team.is_banned ? "border-destructive" : ""
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={team.team_logo}
                      alt={`${team.team_name} logo`}
                    />
                    <AvatarFallback>{team.team_name[0]}</AvatarFallback>
                  </Avatar>
                  {team.team_name}
                  {team.is_banned && (
                    <Badge variant="destructive">BANNED</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Members: {team.team_members ? team.team_members : 0}</p>
                <p>Tier: {team.team_tier}</p>
                <div className="flex justify-between mt-4">
                  <Button className="button-gradient" asChild>
                    <Link href={`/teams/${team.team_name}`}>View Team</Link>
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedTeam(team)}
                        disabled={team.is_banned || team.team_members >= 6}
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
                          onClick={() => handleApply(selectedTeam?.id)}
                        >
                          Send Application
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
