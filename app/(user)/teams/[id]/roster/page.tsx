"use client";

import { useState, useEffect, useTransition, use } from "react";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { FullLoader, Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { UserX, AlertTriangle, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatWord } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

interface MemberUpdate {
  member_id: number;
  management_role: string;
  in_game_role: string;
}

type Params = Promise<{
  id: string;
}>;

export default function page({ params }: { params: Params }) {
  const { id } = use(params);

  const router = useRouter();
  const { token, user } = useAuth();

  const [teamDetails, setTeamDetails] = useState<any>();
  const [pending, startTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();
  const [kickPending, startKickTransition] = useTransition();
  const [roleChanges, setRoleChanges] = useState<Map<number, MemberUpdate>>(
    new Map()
  );
  const [kickModalOpen, setKickModalOpen] = useState(false);
  const [memberToKick, setMemberToKick] = useState<any>(null);

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

  const openKickModal = (member: any) => {
    setMemberToKick(member);
    setKickModalOpen(true);
  };

  const handleKickMember = async () => {
    if (!memberToKick) return;

    startKickTransition(async () => {
      try {
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/kick-team-member/`,
          {
            team_id: teamDetails?.team_id.toString(),
            member_id: memberToKick.id.toString(),
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        toast.success(
          `${memberToKick.username} has been removed from the team`
        );
        setKickModalOpen(false);
        setMemberToKick(null);

        // Refresh team details
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodeURIComponent(id) }
        );
        setTeamDetails(res.data.team);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to kick member");
      }
    });
  };

  // Check if a member is the team owner or creator (cannot be kicked)
  const isOwnerOrCreator = (member: any) => {
    return (
      member.username === teamDetails?.team_owner ||
      member.username === teamDetails?.team_creator
    );
  };

  // Check if current user is the one being displayed (cannot kick yourself)
  const isSelf = (member: any) => {
    return member.username === user?.in_game_name;
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
        toast.error(
          error?.response?.data?.message || "Failed to update roster"
        );
      }
    });
  };

  if (pending) return <FullLoader text="details" />;

  if (teamDetails)
    return (
      <div>
        <PageHeader title={`Manage Roster: ${teamDetails.team_name}`} back />
        <Card>
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
                        {isOwnerOrCreator(member) ? (
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="h-3 w-3" />
                            {member.username === teamDetails?.team_owner
                              ? "Owner"
                              : "Creator"}
                          </Badge>
                        ) : isSelf(member) ? (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            You
                          </Badge>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openKickModal(member)}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Kick
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-center justify-center justify-between mt-4">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => router.push(`/teams/${id}`)}
                disabled={savePending}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={savePending}
              >
                {savePending ? "Saving..." : "Save Changes"}
                {roleChanges.size > 0 && ` (${roleChanges.size})`}
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Kick Member Modal */}
        <Dialog open={kickModalOpen} onOpenChange={setKickModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <UserX className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Remove Member</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {memberToKick && (
              <div className="py-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={memberToKick.avatar} />
                    <AvatarFallback className="text-lg">
                      {memberToKick.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{memberToKick.username}</p>
                    <div className="flex gap-2 mt-1">
                      {memberToKick.in_game_role && (
                        <Badge variant="outline" className="text-xs">
                          {formatWord(memberToKick.in_game_role)}
                        </Badge>
                      )}
                      {memberToKick.management_role && (
                        <Badge variant="secondary" className="text-xs">
                          {formatWord(memberToKick.management_role)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Are you sure?</p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                      {memberToKick.username} will be removed from{" "}
                      <strong>{teamDetails?.team_name}</strong> and will need to
                      request to join again or receive a new invite.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setKickModalOpen(false);
                  setMemberToKick(null);
                }}
                disabled={kickPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleKickMember}
                disabled={kickPending}
              >
                {kickPending ? (
                  <Loader text="Removing..." />
                ) : (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Remove from Team
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
}
