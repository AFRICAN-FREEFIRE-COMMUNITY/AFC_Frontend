"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import { BanModal } from "../../_components/BanModal";
import { PageHeader } from "@/components/PageHeader";
import { Separator } from "@/components/ui/separator";
import { NothingFound } from "@/components/NothingFound";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import {
  IconUserMinus,
  IconUserPlus,
  IconAlertTriangle,
} from "@tabler/icons-react";

const MANAGEMENT_ROLES = [
  { value: "member", label: "Member" },
  { value: "vice_captain", label: "Vice Captain" },
  { value: "team_captain", label: "Team Captain" },
  { value: "coach", label: "Coach" },
  { value: "manager", label: "Manager" },
  { value: "analyst", label: "Analyst" },
];

type TeamDetailsClientProps = {
  teamId: string;
  initialData?: any;
};

export function TeamDetailsClient({
  teamId,
  initialData,
}: TeamDetailsClientProps) {
  const { token, isAdminByRoleOrRoles } = useAuth();
  const [teamDetails, setTeamDetails] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  // Remove member state
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Add member state
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState("member");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!initialData && teamId && token) {
      fetchTeamDetails();
    }
  }, [teamId, token, initialData]);

  // Debounced player search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/admin-search-players/?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        setSearchResults(data.players || []);
      } catch {
        toast.error("Failed to search players");
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, token]);

  const fetchTeamDetails = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const decodedId = decodeURIComponent(teamId);
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ team_name: decodedId }),
        },
      );
      if (!response.ok) throw new Error("Failed to fetch team details");
      const data = await response.json();
      setTeamDetails(data.team);
    } catch (error: any) {
      toast.error(error.message || "Failed to load team details");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/admin-remove-member/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            team_id: teamDetails.team_id,
            member_id: removeTarget.id,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setRemoveTarget(null);
      fetchTeamDetails();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedPlayer) return;
    setIsAdding(true);
    try {
      const memberCount =
        teamDetails.total_members ?? teamDetails.members?.length ?? 0;
      const body: Record<string, any> = {
        team_id: teamDetails.team_id,
        player_id: selectedPlayer.user_id,
        management_role: selectedRole,
      };
      if (selectedPlayer.current_team) body.force_move = true;
      if (memberCount >= 8) body.override_limit = true;

      const res = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/admin-add-member/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      closeAddDialog();
      fetchTeamDetails();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const closeAddDialog = () => {
    setAddOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedPlayer(null);
    setSelectedRole("member");
  };

  if (loading) return <FullLoader />;

  if (!teamDetails) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Team Not Found</h1>
        <p className="text-muted-foreground">
          The team you&apos;re looking for doesn&apos;t exist or has been
          removed.
        </p>
      </div>
    );
  }

  const memberCount =
    teamDetails.total_members ?? teamDetails.members?.length ?? 0;
  const isTeamFull = memberCount >= 8;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <PageHeader title={`${teamDetails.team_name} Details`} back />
        <BanModal
          is_banned={teamDetails.is_banned}
          teamName={teamDetails.team_name}
          team_id={teamDetails.team_id}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Team Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Team Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 font-medium text-sm">
              <p>Tier: {teamDetails.team_tier}</p>
              <Separator />
              <p>Total Wins: {teamDetails.total_wins || 0}</p>
              <Separator />
              <p>Total Losses: {teamDetails.total_losses || 0}</p>
              <Separator />
              <p>Win Rate: {teamDetails.win_rate || 0}%</p>
              <Separator />
              <p>Total Earnings: ${teamDetails.total_earnings || 0}</p>
              <Separator />
              <p>Average Kills: {teamDetails.average_kills || 0}</p>
              <Separator />
              <p>Average Placement: {teamDetails.average_placement || 0}</p>
              <Separator />
              <div className="flex items-center justify-start gap-2">
                <p>Status:</p>
                {teamDetails.is_banned ? (
                  <Badge variant="destructive">Banned</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
              {teamDetails.is_banned && (
                <>
                  <Separator />
                  <p>Ban Reason: {teamDetails.ban_reason}</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Team Members ({memberCount})</CardTitle>
              {isAdminByRoleOrRoles && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddOpen(true)}
                >
                  <IconUserPlus className="size-4 mr-1.5" />
                  Add Member
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {teamDetails?.members && teamDetails.members.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    {isAdminByRoleOrRoles && (
                      <TableHead className="w-12" />
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.members.map((member: any) => {
                    const isOwner =
                      member.username === teamDetails.team_owner;
                    return (
                      <TableRow key={member.id || member.username}>
                        <TableCell>
                          <span>{member.username}</span>
                          {isOwner && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs"
                            >
                              Owner
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {member.in_game_role ||
                            member.management_role ||
                            "Member"}
                        </TableCell>
                        {isAdminByRoleOrRoles && (
                          <TableCell>
                            {!isOwner && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setRemoveTarget(member)}
                              >
                                <IconUserMinus className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No team members yet" />
            )}
          </CardContent>
        </Card>

        {/* Tournament Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Tournament Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {teamDetails?.tournament_performance &&
            teamDetails.tournament_performance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.tournament_performance.map(
                    (tournament: any, index: number) => (
                      <TableRow key={tournament.id || index}>
                        <TableCell>{tournament.name}</TableCell>
                        <TableCell>#{tournament.placement}</TableCell>
                        <TableCell>${tournament.earnings || 0}</TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No performance metrics yet" />
            )}
          </CardContent>
        </Card>

        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {teamDetails?.recent_matches &&
            teamDetails.recent_matches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opponent</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamDetails.recent_matches.map(
                    (match: any, index: number) => (
                      <TableRow key={match.id || index}>
                        <TableCell>{match.opponent}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              match.result === "Win"
                                ? "default"
                                : match.result === "Loss"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {match.result}
                          </Badge>
                        </TableCell>
                        <TableCell>{match.score}</TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            ) : (
              <NothingFound text="No matches yet" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Remove Member Confirmation ── */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to remove{" "}
              <strong>{removeTarget?.username}</strong> from{" "}
              <strong>{teamDetails.team_name}</strong> as an admin action.
              The player will be notified and can be re-added at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add Member Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && closeAddDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member to {teamDetails.team_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Over-limit warning */}
            {isTeamFull && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  This team already has{" "}
                  <strong>{memberCount} members</strong>, exceeding the normal
                  8-member limit. Adding a member will override this cap.
                </span>
              </div>
            )}

            {/* Player search / selected */}
            {!selectedPlayer ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Search Player</p>
                <Input
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {searchLoading && (
                  <div className="flex justify-center py-2">
                    <Spinner className="size-5" />
                  </div>
                )}

                {!searchLoading && searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                    {searchResults.map((player) => (
                      <button
                        key={player.user_id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => {
                          setSelectedPlayer(player);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                      >
                        <p className="font-medium">{player.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.email}
                        </p>
                        {player.current_team && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            On team: {player.current_team.team_name}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {!searchLoading &&
                  searchQuery.length >= 2 &&
                  searchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No players found.
                    </p>
                  )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Selected Player</p>
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {selectedPlayer.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPlayer.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setSelectedPlayer(null)}
                    >
                      Change
                    </Button>
                  </div>

                  {/* Force-move warning */}
                  {selectedPlayer.current_team && (
                    <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-700 dark:text-yellow-400">
                      <IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        This player is currently on{" "}
                        <strong>
                          {selectedPlayer.current_team.team_name}
                        </strong>
                        . Confirming will remove them from that team first.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Role picker */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Management Role</p>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGEMENT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeAddDialog}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedPlayer || isAdding}
            >
              {isAdding ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
