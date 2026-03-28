"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FullLoader, Loader } from "@/components/Loader";
import { formatMoneyInput } from "@/lib/utils";
import { env } from "@/lib/env";
import { ITEMS_PER_PAGE } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import Link from "next/link";
import {
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconUserPlus,
  IconSword,
  IconCrown,
  IconTrophy,
} from "@tabler/icons-react";
import { Ban, ShieldCheck, CheckCircle2, TrendingUp } from "lucide-react";

interface Player {
  user_id: number;
  name: string;
  team_name: string | null;
  total_kills: number;
  total_wins: number;
  total_mvps: number;
  status: "active" | "banned";
  role: string;
}

const PlayerBanModal = ({
  player,
  onSuccess,
}: {
  player: Player;
  onSuccess: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const isBanned = player.status === "banned";

  const handleBan = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/ban-player/`,
          { user_id: player.user_id },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Player banned successfully");
        setOpen(false);
        onSuccess();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to ban player");
      }
    });
  };

  const handleUnban = () => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/unban-player/`,
          { user_id: player.user_id },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message || "Player unbanned successfully");
        setOpen(false);
        onSuccess();
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Failed to unban player");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isBanned ? "outline" : "destructive"}
          size="sm"
          className={
            isBanned
              ? "border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700"
              : ""
          }
        >
          {isBanned ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-1" /> Unban
            </>
          ) : (
            <>
              <Ban className="h-4 w-4 mr-1" /> Ban
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[400px]">
        {isBanned ? (
          <div className="text-center py-2">
            <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-green-600" />
            </div>
            <DialogTitle className="text-xl">Unban Player</DialogTitle>
            <DialogDescription className="mt-1">
              Are you sure you want to unban <b>{player.name}</b>? They will
              regain full platform access immediately.
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleUnban}
                disabled={pending}
              >
                {pending ? (
                  <Loader text="Unbanning..." />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
              <Ban className="h-7 w-7 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Ban Player</DialogTitle>
            <DialogDescription className="mt-1">
              Are you sure you want to ban <b>{player.name}</b>? They will lose
              access to the platform.
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleBan}
                disabled={pending}
              >
                {pending ? <Loader text="Banning..." /> : "Confirm Ban"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const page = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPlayers = async () => {
    try {
      const res = await axios(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-all-players/`,
      );
      setPlayers(res.data.users || []);
    } catch {
      toast.error("Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Derived stats
  const totalPlayers = players.length;
  const activePlayers = players.filter((p) => p.status === "active").length;
  const bannedPlayers = players.filter((p) => p.status === "banned").length;
  const avgKills =
    totalPlayers > 0
      ? (
          players.reduce((sum, p) => sum + p.total_kills, 0) / totalPlayers
        ).toFixed(2)
      : "0.00";

  const topMvp = players.reduce(
    (top, p) => (p.total_mvps > (top?.total_mvps ?? -1) ? p : top),
    null as Player | null,
  );
  const topWins = players.reduce(
    (top, p) => (p.total_wins > (top?.total_wins ?? -1) ? p : top),
    null as Player | null,
  );

  // Unique team names for filter
  const teamOptions = useMemo(() => {
    const names = players
      .map((p) => p.team_name)
      .filter((t): t is string => !!t);
    return Array.from(new Set(names)).sort();
  }, [players]);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesTeam =
        filterTeam === "all"
          ? true
          : filterTeam === "none"
            ? !p.team_name
            : p.team_name === filterTeam;
      const matchesStatus =
        filterStatus === "all" || p.status === filterStatus;
      return matchesSearch && matchesTeam && matchesStatus;
    });
  }, [players, searchTerm, filterTeam, filterStatus]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTeam, filterStatus]);

  if (loading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader back title="Player Management" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-2">
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <IconUsers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalPlayers)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Overall registered players
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Players
            </CardTitle>
            <IconUserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(activePlayers)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently not banned
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Banned Players
            </CardTitle>
            <IconUserX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatMoneyInput(bannedPlayers)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently banned from platform
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Kills per Player
            </CardTitle>
            <IconSword className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgKills}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Average kills across all players
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Top MVP Player
            </CardTitle>
            <IconCrown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topMvp?.total_mvps ? topMvp.name : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {topMvp?.total_mvps
                ? `With ${topMvp.total_mvps} MVPs`
                : "No MVPs recorded yet"}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Top Wins Player
            </CardTitle>
            <IconTrophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topWins?.total_wins ? topWins.name : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {topWins?.total_wins
                ? `With ${topWins.total_wins} Wins`
                : "No wins recorded yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <Input
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="w-full md:w-52">
            <SelectValue placeholder="Filter by team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            <SelectItem value="none">No Team</SelectItem>
            {teamOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="gap-0">
        <CardHeader>
          <CardTitle>
            Players{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({filtered.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Kills</TableHead>
                <TableHead>Wins</TableHead>
                <TableHead>MVPs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No players found
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((player) => (
                  <TableRow key={player.user_id}>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {player.team_name ?? "—"}
                    </TableCell>
                    <TableCell>{formatMoneyInput(player.total_kills)}</TableCell>
                    <TableCell>{formatMoneyInput(player.total_wins)}</TableCell>
                    <TableCell>{formatMoneyInput(player.total_mvps)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          player.status === "active" ? "default" : "destructive"
                        }
                      >
                        {player.status === "active" ? "Active" : "Banned"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/a/players/${player.user_id}`}>
                            View
                          </Link>
                        </Button>
                        <PlayerBanModal
                          player={player}
                          onSuccess={fetchPlayers}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1,
                    )
                    .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push("ellipsis");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={currentPage === p}
                            onClick={() => setCurrentPage(p as number)}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
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
    </div>
  );
};

export default page;
