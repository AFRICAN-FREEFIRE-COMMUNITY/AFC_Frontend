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

// Mock team data
const mockTeamData = {
  id: "1",
  name: "Team Alpha",
  members: [],
};

export function ManageRoster({ id }: { id: string }) {
  const router = useRouter();
  const [teamData, setTeamData] = useState(mockTeamData);

  const [teamDetails, setTeamDetails] = useState<any>();
  const [pending, startTransition] = useTransition();

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
    memberId: string,
    roleType: "inGameRole" | "managementRole",
    newRole: string
  ) => {
    // setTeamData((prevData) => {
    //   const updatedMembers = prevData.members.map((member) => {
    //     if (member.id === memberId) {
    //       return { ...member, [roleType]: newRole };
    //     }
    //     // If setting a new Team Captain or Team Owner, remove the role from other members
    //     if (
    //       roleType === "managementRole" &&
    //       (newRole === "Team Captain" || newRole === "Team Owner")
    //     ) {
    //       return {
    //         ...member,
    //         managementRole:
    //           member.managementRole === newRole
    //             ? "None"
    //             : member.managementRole,
    //       };
    //     }
    //     return member;
    //   });
    //   return { ...prevData, members: updatedMembers };
    // });
  };

  const handleKickMember = async (memberId: string) => {
    // // In a real app, you would make an API call to remove the member
    // try {
    //   // Simulating an API call
    //   await new Promise((resolve) => setTimeout(resolve, 1000));
    //   setTeamData((prevData) => ({
    //     ...prevData,
    //     members: prevData.members.filter((member) => member.id !== memberId),
    //   }));
    //   toast({
    //     title: "Member removed",
    //     description: "The team member has been removed successfully.",
    //   });
    // } catch (error) {
    //   toast({
    //     title: "Error",
    //     description:
    //       "An error occurred while removing the team member. Please try again.",
    //     variant: "destructive",
    //   });
    // }
  };

  const handleSave = async () => {
    // try {
    //   // Simulating an API call
    //   await new Promise((resolve) => setTimeout(resolve, 1000));
    //   toast({
    //     title: "Changes saved",
    //     description: "The team roster has been updated successfully.",
    //   });
    //   router.push(`/teams/${params.id}`);
    // } catch (error) {
    //   toast({
    //     title: "Error",
    //     description:
    //       "An error occurred while saving changes. Please try again.",
    //     variant: "destructive",
    //   });
    // }
  };

  if (pending) return <FullLoader text="details" />;

  if (teamDetails)
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Manage Roster: {teamData.name}</CardTitle>
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
                {teamDetails?.members?.map((member: any) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.username}</TableCell>
                    <TableCell>
                      <Select
                        value={member.in_game_role}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, "inGameRole", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rusher">Rusher</SelectItem>
                          <SelectItem value="grenade">Grenade</SelectItem>
                          <SelectItem value="sniper">Sniper</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.management_role}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, "managementRole", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">None</SelectItem>
                          <SelectItem value="Team Captain">
                            Team Captain
                          </SelectItem>
                          <SelectItem value="Team Owner">Team Owner</SelectItem>
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
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/teams/${id}`)}
              >
                Back
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
}
