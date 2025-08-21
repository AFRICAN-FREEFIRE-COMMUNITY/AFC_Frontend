"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Loader2, AlertCircle } from "lucide-react";
import { addDays } from "date-fns";
import { useTeams, useApiMutation } from "@/hooks/useAdminApi";
import * as adminApi from "@/lib/api/admin";

export const Teams = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [banDateRange, setBanDateRange] = useState({
    from: new Date(),
    to: addDays(new Date(), 7),
  });
  const [banReasons, setBanReasons] = useState<string[]>([]);
  const { toast } = useToast();

  // Build filters object
  const filters = {
    ...(searchTerm && { search: searchTerm }),
    ...(filterTier !== "all" && { tier: filterTier }),
  };

  const {
    data: teams,
    loading,
    error,
    pagination,
    updateParams,
    changePage,
    refetch,
  } = useTeams(filters);

  // API mutations
  const banTeamMutation = useApiMutation(
    ({ id, data }: { id: string; data: any }) =>
      adminApi.teamsApi.ban(id, data),
    {
      successMessage: "Team banned successfully",
      onSuccess: () => {
        refetch();
        setBanModalOpen(false);
        setSelectedTeam(null);
        setBanDateRange({ from: new Date(), to: addDays(new Date(), 7) });
        setBanReasons([]);
      },
    }
  );

  const unbanTeamMutation = useApiMutation(
    (id: string) => adminApi.teamsApi.unban(id),
    {
      successMessage: "Team unbanned successfully",
      onSuccess: () => refetch(),
    }
  );

  // Update filters when search/filter values change
  useEffect(() => {
    updateParams(filters);
  }, [searchTerm, filterTier]);
  const availableBanReasons = [
    {
      id: "conduct",
      label: "Conduct/Toxic Behavior",
      description:
        "Repeated instances of abusive language, harassment, or unsportsmanlike conduct",
    },
    {
      id: "cheating",
      label: "Cheating",
      description:
        "Use of unauthorized software, exploits, or other forms of cheating",
    },
    {
      id: "collusion",
      label: "Collusion",
      description:
        "Cooperating with other teams or players to gain an unfair advantage",
    },
    {
      id: "account_sharing",
      label: "Account Sharing",
      description:
        "Multiple players using the same account or a player using someone else's account",
    },
    {
      id: "confidentiality",
      label: "Breach of Confidentiality",
      description:
        "Sharing confidential information about tournaments, scrims, or other teams",
    },
  ];

  const handleBanTeam = async () => {
    if (!selectedTeam || banReasons.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one reason for the ban.",
        variant: "destructive",
      });
      return;
    }

    try {
      await banTeamMutation.mutate({
        id: selectedTeam.id,
        data: {
          reasons: banReasons,
          startDate: banDateRange.from,
          endDate: banDateRange.to,
        },
      });
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const handleUnbanTeam = async (teamId: string) => {
    try {
      await unbanTeamMutation.mutate(teamId);
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Team Management</h1>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading teams...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-500">
              <AlertCircle className="h-8 w-8" />
              <span className="ml-2">Error: {error}</span>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Total Wins</TableHead>
                    <TableHead>Total Earnings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams && teams.length > 0 ? (
                    teams.map((team: any) => (
                      <TableRow key={team.id}>
                        <TableCell>{team.name}</TableCell>
                        <TableCell>{team.tier}</TableCell>
                        <TableCell>{team.members}</TableCell>
                        <TableCell>{team.totalWins}</TableCell>
                        <TableCell>{team.totalEarnings}</TableCell>
                        <TableCell>
                          {team.isBanned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="mr-2"
                            >
                              <Link href={`/admin/teams/${team.id}`}>View</Link>
                            </Button>
                            <AlertDialog
                              open={banModalOpen}
                              onOpenChange={setBanModalOpen}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant={
                                    team.isBanned ? "secondary" : "destructive"
                                  }
                                  onClick={() => {
                                    setSelectedTeam(team);
                                    setBanModalOpen(true);
                                  }}
                                >
                                  {team.isBanned ? "Unban" : "Ban"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {selectedTeam?.isBanned
                                      ? "Unban Team"
                                      : "Ban Team"}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {selectedTeam?.isBanned
                                      ? `Are you sure you want to unban ${selectedTeam?.name}?`
                                      : `Are you sure you want to ban ${selectedTeam?.name}?`}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                {!selectedTeam?.isBanned && (
                                  <div className="space-y-4 px-4 py-2">
                                    <div>
                                      <Label>Ban Duration</Label>
                                      <DatePickerWithRange
                                        dateRange={banDateRange}
                                        // @ts-ignore
                                        setDateRange={setBanDateRange}
                                      />
                                    </div>
                                    <div>
                                      <Label>Reason(s) for Ban</Label>
                                      <div className="space-y-2 mt-2">
                                        {availableBanReasons.map((reason) => (
                                          <div
                                            key={reason.id}
                                            className="flex items-start space-x-2"
                                          >
                                            <Checkbox
                                              id={reason.id}
                                              checked={banReasons.includes(
                                                reason.id
                                              )}
                                              onCheckedChange={(checked) => {
                                                setBanReasons((prevReasons) =>
                                                  checked
                                                    ? [
                                                        ...prevReasons,
                                                        reason.id,
                                                      ]
                                                    : prevReasons.filter(
                                                        (r) => r !== reason.id
                                                      )
                                                );
                                              }}
                                            />
                                            <div>
                                              <Label
                                                htmlFor={reason.id}
                                                className="font-medium"
                                              >
                                                {reason.label}
                                              </Label>
                                              <p className="text-sm text-muted-foreground">
                                                {reason.description}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={
                                      selectedTeam?.isBanned
                                        ? () => handleUnbanTeam(selectedTeam.id)
                                        : handleBanTeam
                                    }
                                  >
                                    {selectedTeam?.isBanned ? "Unban" : "Ban"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No teams found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}{" "}
                    of {pagination.total} teams
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changePage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changePage(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
