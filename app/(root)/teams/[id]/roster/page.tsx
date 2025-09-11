"use client";

import { useState, useEffect } from "react";
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
import { toast } from "@/components/ui/use-toast";

// Mock team data
const mockTeamData = {
  id: "1",
  name: "Team Alpha",
  members: [],
};

export default function ManageRosterPage() {
  const params = useParams();
  const router = useRouter();
  const [teamData, setTeamData] = useState(mockTeamData);

  useEffect(() => {
    // In a real app, fetch team data based on params.id
    // setTeamData(fetchedTeamData)
  }, []);

  const handleRoleChange = (
    memberId: string,
    roleType: "inGameRole" | "managementRole",
    newRole: string
  ) => {
    setTeamData((prevData) => {
      const updatedMembers = prevData.members.map((member) => {
        if (member.id === memberId) {
          return { ...member, [roleType]: newRole };
        }
        // If setting a new Team Captain or Team Owner, remove the role from other members
        if (
          roleType === "managementRole" &&
          (newRole === "Team Captain" || newRole === "Team Owner")
        ) {
          return {
            ...member,
            managementRole:
              member.managementRole === newRole
                ? "None"
                : member.managementRole,
          };
        }
        return member;
      });
      return { ...prevData, members: updatedMembers };
    });
  };

  const handleKickMember = async (memberId: string) => {
    // In a real app, you would make an API call to remove the member
    try {
      // Simulating an API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setTeamData((prevData) => ({
        ...prevData,
        members: prevData.members.filter((member) => member.id !== memberId),
      }));

      toast({
        title: "Member removed",
        description: "The team member has been removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          "An error occurred while removing the team member. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    try {
      // Simulating an API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast({
        title: "Changes saved",
        description: "The team roster has been updated successfully.",
      });
      router.push(`/teams/${params.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description:
          "An error occurred while saving changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
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
                {teamData.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>
                      <Select
                        value={member.inGameRole}
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
                        value={member.managementRole}
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
                onClick={() => router.push(`/teams/${params.id}`)}
              >
                Back
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
