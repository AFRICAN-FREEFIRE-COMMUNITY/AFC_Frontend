"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";

interface MemberUpdate {
  member_id: number;
  management_role: string;
  in_game_role: string;
}

export function ManageRoster({ id }: { id: string }) {
  const router = useRouter();
  const { token } = useAuth();

  const [teamDetails, setTeamDetails] = useState<any>();
  const [pending, startTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();
  const [roleChanges, setRoleChanges] = useState<Map<number, MemberUpdate>>(
    new Map()
  );

  useEffect(() => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodedId }
        );
        setTeamDetails(res.data.team);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  }, [id]);

  useEffect(() => {
    // In a real app, fetch team data based on params.id
    // setTeamData(fetchedTeamData)
  }, []);

  const handleRoleChange = (
    memberId: number,
    roleType: "inGameRole" | "managementRole",
    newRole: string
  ) => {
    setRoleChanges((prevChanges) => {
      const newChanges = new Map(prevChanges);
      const existingChange = newChanges.get(memberId);

      // Find the current member to get their current roles
      const currentMember = teamDetails?.members?.find(
        (m: any) => m.id === memberId
      );

      if (currentMember) {
        const update: MemberUpdate = {
          member_id: memberId,
          management_role:
            roleType === "managementRole"
              ? newRole
              : existingChange?.management_role ||
                currentMember.management_role,
          in_game_role:
            roleType === "inGameRole"
              ? newRole
              : existingChange?.in_game_role || currentMember.in_game_role,
        };

        newChanges.set(memberId, update);
      }

      return newChanges;
    });
  };

  const handleKickMember = async (memberId: number) => {
    if (!confirm("Are you sure you want to kick this member from the team?")) {
      return;
    }

    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/kick-team-member/`,
        {
          team_id: teamDetails?.team_id.toString(),
          member_id: memberId.toString(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Member kicked successfully!");

      // Refresh team details
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
        { team_name: decodeURIComponent(id) }
      );
      setTeamDetails(res.data.team);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to kick member");
    }
  };

  const handleSave = async () => {
    if (roleChanges.size === 0) {
      toast.info("No changes to save");
      return;
    }

    startSaveTransition(async () => {
      try {
        const updates = Array.from(roleChanges.values());

        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/manage-team-roster/`,
          {
            team_id: teamDetails?.team_id,
            updates,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        toast.success("Team roster updated successfully!");
        setRoleChanges(new Map()); // Clear changes after successful save
        router.push(`/teams/${id}`);
      } catch (error: any) {
        console.log(error);

        toast.error(
          error?.response?.data?.message || "Failed to update roster"
        );
      }
    });
  };

  if (pending) return <FullLoader text="details" />;

  console.log(teamDetails);

  if (teamDetails)
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Manage Roster: {teamDetails.team_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>In-game Role</TableHead>
                  <TableHead>Management Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamDetails?.members?.map((member: any) => {
                  const pendingChange = roleChanges.get(member.id);
                  const currentInGameRole =
                    pendingChange?.in_game_role || member.in_game_role;
                  const currentManagementRole =
                    pendingChange?.management_role || member.management_role;

                  return (
                    <TableRow key={member.id}>
                      <TableCell>{member.username}</TableCell>
                      <TableCell>
                        <Select
                          key={`in-game-${member.id}`}
                          value={currentInGameRole}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, "inGameRole", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rusher">Rusher</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="grenader">Grenader</SelectItem>
                            <SelectItem value="sniper">Sniper</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          key={`management-${member.id}`}
                          value={currentManagementRole}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, "managementRole", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="team_owner">
                              Team Owner
                            </SelectItem>
                            <SelectItem value="team_captain">
                              Team Captain
                            </SelectItem>
                            <SelectItem value="vice_captain">
                              Vice Captain
                            </SelectItem>
                            <SelectItem value="coach">Coach</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          onClick={() => handleKickMember(member.id)}
                        >
                          Kick
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/teams/${id}`)}
                disabled={savePending}
              >
                Back
              </Button>
              <Button onClick={handleSave} disabled={savePending}>
                {savePending ? "Saving..." : "Save Changes"}
                {roleChanges.size > 0 && ` (${roleChanges.size})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
}
