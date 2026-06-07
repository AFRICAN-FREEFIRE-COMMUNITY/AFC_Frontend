"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import axios from "axios";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/PageHeader";
import { BanModal } from "../_components/BanModal";
import { ITEMS_PER_PAGE } from "@/constants";
import { Textarea } from "@/components/ui/textarea";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import { InfoTip } from "@/components/ui/info-tip";

// ── Ghost Teams (provisional placeholder teams used by Rankings & Tiering) ───
// Shape mirrors the backend serialize_ghost() payload (afc_rankings/admin_ghost.py):
// claim_status can also be "revoked"; the table's else-branch renders it as "Unclaimed".
type GhostClaimStatus = "unclaimed" | "pending" | "claimed" | "revoked";
type GhostPlayer = { id: number; ign: string; slot?: number };
type GhostTeam = {
  ghost_team_id: string;
  team_name: string;
  country: string;
  external_id: string | null;
  claim_status: GhostClaimStatus;
  created_at: string;
  // provisional roster - match results attribute to these slots until a real
  // team claims the ghost, then the slots map onto the claiming team's players.
  players: GhostPlayer[];
};

// blank roster the create dialog seeds - a standard 4-player Free Fire squad
const emptyRoster = (): GhostPlayer[] =>
  Array.from({ length: 4 }, (_, i) => ({ id: i + 1, ign: "" }));

const page = () => {
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [teams, setTeams] = useState<any>();
  const [rankingTeams, setRankingTeams] = useState(false);

  // ── Ghost Teams (LIVE - afc_rankings ghost-teams admin API) ──────────────
  const MIN_REASON = 10;
  const [ghostTeams, setGhostTeams] = useState<GhostTeam[]>([]);
  const [ghostLoading, setGhostLoading] = useState(true);
  const [createGhostOpen, setCreateGhostOpen] = useState(false);
  const [ghostName, setGhostName] = useState("");
  const [ghostCountry, setGhostCountry] = useState("");
  const [ghostExternalId, setGhostExternalId] = useState("");
  const [ghostPlayers, setGhostPlayers] = useState<GhostPlayer[]>(emptyRoster);
  const [ghostCreateReason, setGhostCreateReason] = useState("");
  const [creatingGhost, setCreatingGhost] = useState(false);
  const [deleteGhost, setDeleteGhost] = useState<GhostTeam | null>(null);
  const [ghostDeleteReason, setGhostDeleteReason] = useState("");
  const [deletingGhost, setDeletingGhost] = useState(false);

  const namedGhostPlayers = ghostPlayers.filter((p) => p.ign.trim().length > 0);
  // a ghost team must have a name, country, >=1 rostered player, and a >=10-char audit reason
  const ghostFormReady =
    ghostName.trim().length > 0 &&
    ghostCountry.trim().length > 0 &&
    namedGhostPlayers.length > 0 &&
    ghostCreateReason.trim().length >= MIN_REASON;

  const setGhostPlayerIgn = (id: number, ign: string) =>
    setGhostPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ign } : p)));
  const addGhostPlayer = () =>
    setGhostPlayers((prev) => [
      ...prev,
      { id: prev.reduce((m, p) => Math.max(m, p.id), 0) + 1, ign: "" },
    ]);
  const removeGhostPlayer = (id: number) =>
    setGhostPlayers((prev) =>
      prev.length <= 1 ? prev : prev.filter((p) => p.id !== id),
    );

  // live ghost-teams admin API (afc_rankings); ghost teams are provisional
  // placeholders that hold tournament results until a real team claims them.
  const fetchGhostTeams = async () => {
    setGhostLoading(true);
    try {
      const res = await rankingsAdminApi.ghostList();
      setGhostTeams(res?.results ?? []);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to load ghost teams",
      );
    } finally {
      setGhostLoading(false);
    }
  };

  useEffect(() => {
    fetchGhostTeams();
  }, []);

  const handleCreateGhost = async () => {
    if (!ghostFormReady || creatingGhost) return;
    const roster = namedGhostPlayers.map((p) => ({ ign: p.ign.trim() }));
    setCreatingGhost(true);
    try {
      await rankingsAdminApi.createGhost({
        team_name: ghostName.trim(),
        country: ghostCountry.trim(),
        external_id: ghostExternalId.trim() || undefined,
        players: roster,
        reason: ghostCreateReason.trim(),
      });
      toast.success(
        `Ghost team created with ${roster.length} player${roster.length > 1 ? "s" : ""}`,
      );
      setGhostName("");
      setGhostCountry("");
      setGhostExternalId("");
      setGhostPlayers(emptyRoster());
      setGhostCreateReason("");
      setCreateGhostOpen(false);
      fetchGhostTeams();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to create ghost team",
      );
    } finally {
      setCreatingGhost(false);
    }
  };

  const handleDeleteGhost = async () => {
    if (!deleteGhost || deletingGhost) return;
    if (ghostDeleteReason.trim().length < MIN_REASON) return;
    setDeletingGhost(true);
    try {
      await rankingsAdminApi.deleteGhost(deleteGhost.ghost_team_id, {
        reason: ghostDeleteReason.trim(),
      });
      toast.success("Ghost team deleted");
      setDeleteGhost(null);
      setGhostDeleteReason("");
      fetchGhostTeams();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to delete ghost team",
      );
    } finally {
      setDeletingGhost(false);
    }
  };

  const fetchTeams = async () => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`,
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
  };

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-all-teams/`,
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

  const filteredTeams = useMemo(() => {
    if (!teams) return [];

    return teams.filter((team: any) => {
      const matchesSearch = team.team_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesTier =
        filterTier === "all" || String(team.team_tier) === filterTier;

      return matchesSearch && matchesTier;
    });
  }, [teams, searchTerm, filterTier]);

  const totalPages = Math.ceil(filteredTeams.length / ITEMS_PER_PAGE);
  const paginatedTeams = filteredTeams.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTier]);

  const handleRankTeams = async () => {
    setRankingTeams(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/rank-teams-into-tiers/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Teams ranked into tiers successfully!");
      fetchTeams();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to rank teams.");
    } finally {
      setRankingTeams(false);
    }
  };

  if (pending) return <FullLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
          title={
            <span className="inline-flex items-center">
              Team Management
              <InfoTip id="teams._page" className="ml-1.5" />
            </span>
          }
        />
        {/* ⓘ sits beside the rank-teams action (sibling, not nested in the button). */}
        <div className="flex items-center gap-1">
          <Button onClick={handleRankTeams} disabled={rankingTeams} variant="outline" size="sm">
            {rankingTeams ? "Ranking..." : "Rank Teams into Tiers"}
          </Button>
          <InfoTip id="teams.rank_into_tiers" />
        </div>
      </div>

      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-col md:flex-row w-full items-start md:items-center gap-2">
          <Input
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-full md:w-40">
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

      <Card className="gap-0">
        <CardHeader>
          {/* Section ⓘ sits inline with the card title (sibling of the text). */}
          <CardTitle className="flex items-center">
            Teams
            <InfoTip id="teams.list._section" className="ml-1.5" />
          </CardTitle>
        </CardHeader>
        <CardContent className="mt-2">
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
              {paginatedTeams.length > 0 ? (
                paginatedTeams.map((team: any) => (
                  <TableRow key={team.team_name}>
                    <TableCell>{team.team_name}</TableCell>
                    <TableCell>{team.team_tier}</TableCell>
                    <TableCell>
                      {team.member_count ? team.member_count : 0}
                    </TableCell>
                    <TableCell>
                      {team.total_wins ? team.total_wins : 0}
                    </TableCell>
                    <TableCell>
                      ${team.total_earnings ? team.total_earnings : 0}
                    </TableCell>
                    <TableCell>
                      {team.is_banned ? (
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
                          <Link href={`/a/teams/${team.team_name}`}>View</Link>
                        </Button>
                        <BanModal
                          is_banned={team.is_banned}
                          teamName={team.team_name}
                          team_id={team.team_id}
                          onSuccess={fetchTeams}
                        />
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="hidden md:block text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTeams.length)}{" "}
                of {filteredTeams.length}
              </p>
              <Pagination className="w-full md:w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1,
                    )
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            isActive={currentPage === page}
                            onClick={() => setCurrentPage(page)}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ghost Teams - live afc_rankings ghost-teams admin (create / delete, reason-gated) ── */}
      <Card className="gap-0 mt-4">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* Section ⓘ inline with the Ghost Teams heading. */}
              <CardTitle className="flex items-center">
                Ghost Teams
                <InfoTip id="teams.ghost._section" className="ml-1.5" />
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Provisional placeholder teams for tournament results before a
                real team claims them. Used by Rankings &amp; Tiering.
              </p>
            </div>
            {/* ⓘ sits beside the create action (sibling of the button). */}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateGhostOpen(true)}
              >
                Create ghost team
              </Button>
              <InfoTip id="rankings.ghost.create" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ghostLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading ghost teams...
                  </TableCell>
                </TableRow>
              ) : ghostTeams.length > 0 ? (
                ghostTeams.map((ghost) => (
                  <TableRow key={ghost.ghost_team_id}>
                    <TableCell>{ghost.team_name}</TableCell>
                    <TableCell>{ghost.country}</TableCell>
                    <TableCell>{ghost.external_id ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        title={ghost.players.map((p) => p.ign).join(", ")}
                      >
                        {ghost.players.length}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ghost.created_at
                        ? ghost.created_at.slice(0, 10)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {ghost.claim_status === "claimed" ? (
                        <Badge
                          variant="outline"
                          className="border-green-600/60 text-green-400"
                        >
                          Claimed
                        </Badge>
                      ) : ghost.claim_status === "pending" ? (
                        <Badge
                          variant="outline"
                          className="border-orange-500/40 text-orange-400"
                        >
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Unclaimed</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {ghost.claim_status === "claimed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Claimed ghost teams cannot be deleted"
                        >
                          Delete
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setGhostDeleteReason("");
                            setDeleteGhost(ghost);
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No ghost teams
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create ghost team dialog */}
      <Dialog open={createGhostOpen} onOpenChange={setCreateGhostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create ghost team</DialogTitle>
            <DialogDescription>
              Add a provisional placeholder team. It starts unclaimed and can be
              claimed by a real team later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ghost-name">Team name</Label>
              <Input
                id="ghost-name"
                value={ghostName}
                onChange={(e) => setGhostName(e.target.value)}
                placeholder="e.g. Provisional Falcons"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ghost-country">Country</Label>
              <Input
                id="ghost-country"
                value={ghostCountry}
                onChange={(e) => setGhostCountry(e.target.value)}
                placeholder="e.g. Nigeria"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ghost-external-id">
                External ID{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="ghost-external-id"
                value={ghostExternalId}
                onChange={(e) => setGhostExternalId(e.target.value)}
                placeholder="e.g. FF-2031"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Ghost players{" "}
                  <span className="text-muted-foreground">(at least one)</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={addGhostPlayer}
                >
                  + Add player
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                In-game names for the provisional roster. Match results attribute
                to these slots until a real team claims the ghost.
              </p>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {ghostPlayers.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Input
                      value={p.ign}
                      onChange={(e) => setGhostPlayerIgn(p.id, e.target.value)}
                      placeholder={`Player ${i + 1} in-game name`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={ghostPlayers.length <= 1}
                      onClick={() => removeGhostPlayer(p.id)}
                      aria-label={`Remove player ${i + 1}`}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ghost-create-reason">
                Reason{" "}
                <span className="text-orange-400">(required, logged)</span>
              </Label>
              <Textarea
                id="ghost-create-reason"
                value={ghostCreateReason}
                onChange={(e) => setGhostCreateReason(e.target.value)}
                placeholder="Why is this ghost team being created? (logged to the ranking audit trail)"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {ghostCreateReason.trim().length}/{MIN_REASON} characters minimum
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGhostOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!ghostFormReady || creatingGhost}
              onClick={handleCreateGhost}
            >
              {creatingGhost ? "Creating..." : "Create ghost team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete ghost team confirm */}
      <AlertDialog
        open={!!deleteGhost}
        onOpenChange={(v) => {
          if (!v) {
            setDeleteGhost(null);
            setGhostDeleteReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete ghost team?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-semibold text-foreground">
                {deleteGhost?.team_name}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ghost-delete-reason">
              Reason <span className="text-orange-400">(required, logged)</span>
            </Label>
            <Textarea
              id="ghost-delete-reason"
              value={ghostDeleteReason}
              onChange={(e) => setGhostDeleteReason(e.target.value)}
              placeholder="Why is this ghost team being deleted? (logged to the ranking audit trail)"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              {ghostDeleteReason.trim().length}/{MIN_REASON} characters minimum
            </p>
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteGhost(null);
                setGhostDeleteReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                ghostDeleteReason.trim().length < MIN_REASON || deletingGhost
              }
              onClick={handleDeleteGhost}
            >
              {deletingGhost ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
export default page;
