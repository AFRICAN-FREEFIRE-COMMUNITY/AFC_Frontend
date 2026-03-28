"use client";

import React, { useEffect, useState, useTransition, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader, Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Ban, ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react";
import { formatMoneyInput } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface PlayerDetails {
  player_id: number;
  name: string;
  team: string | null;
  kdr: number;
  avg_damage: number;
  win_rate: number;
  total_kills: number;
  total_wins: number;
  total_mvps: number;
  scrims_kills: number;
  tournaments_kills: number;
  scrims_wins: number;
  tournaments_wins: number;
  scrim_booyah: number;
  tournament_booyah: number;
  status?: "active" | "banned";
  in_game_role?: string;
  email?: string;
  phone?: string;
  discord_username?: string;
  location?: string;
  uid?: string;
  country?: string;
  total_tournaments?: number;
  total_scrims?: number;
  total_money_made?: number;
}

const BanPlayerModal = ({
  player,
  onSuccess,
}: {
  player: PlayerDetails;
  onSuccess: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { token } = useAuth();
  const isBanned = player.status === "banned";

  const handle = () => {
    startTransition(async () => {
      try {
        const endpoint = isBanned
          ? `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/unban-player/`
          : `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/ban-player/`;
        const res = await axios.post(
          endpoint,
          { user_id: player.player_id },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(
          res.data.message ||
            (isBanned ? "Player unbanned" : "Player banned") + " successfully",
        );
        setOpen(false);
        onSuccess();
      } catch (e: any) {
        toast.error(
          e.response?.data?.message ||
            `Failed to ${isBanned ? "unban" : "ban"} player`,
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isBanned ? "outline" : "destructive"}
          className={
            isBanned
              ? "border-green-500/50 text-green-600 hover:bg-green-50 hover:text-green-700"
              : ""
          }
        >
          {isBanned ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-2" /> Unban
            </>
          ) : (
            <>
              <Ban className="h-4 w-4 mr-2" /> Ban
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <div className="text-center py-2">
          <div
            className={`h-14 w-14 mx-auto mb-3 rounded-full flex items-center justify-center ${isBanned ? "bg-green-100" : "bg-red-100"}`}
          >
            {isBanned ? (
              <ShieldCheck className="h-7 w-7 text-green-600" />
            ) : (
              <Ban className="h-7 w-7 text-red-600" />
            )}
          </div>
          <DialogTitle className="text-xl">
            {isBanned ? "Unban" : "Ban"} Player
          </DialogTitle>
          <DialogDescription className="mt-1">
            Are you sure you want to {isBanned ? "unban" : "ban"}{" "}
            <b>{player.name}</b>?{" "}
            {isBanned
              ? "They will regain full platform access immediately."
              : "They will lose access to the platform."}
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
              className={`flex-1 ${isBanned ? "bg-green-600 hover:bg-green-700" : ""}`}
              variant={isBanned ? "default" : "destructive"}
              onClick={handle}
              disabled={pending}
            >
              {pending ? (
                <Loader text={isBanned ? "Unbanning..." : "Banning..."} />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Initials avatar
const Avatar = ({ name }: { name: string }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold shrink-0">
      {initials || "?"}
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <p className="text-muted-foreground text-sm py-6">
    No {label} data available yet.
  </p>
);

// Mock performance history months — replace with real data when endpoint available
const buildPerformanceData = (player: PlayerDetails) => [
  {
    month: "Overall",
    Kills: player.total_kills,
    Wins: player.total_wins,
    KDR: player.kdr,
    "Avg. Damage": player.avg_damage,
    "Headshot %": 0,
  },
];

type Props = { params: Promise<{ id: string }> };

const Page = ({ params }: Props) => {
  const { id } = use(params);
  const { token } = useAuth();
  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlayer = async () => {
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player/get-player-details/`,
        { player_id: id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPlayer(res.data);
    } catch {
      toast.error("Failed to load player details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayer();
  }, [id]);

  if (loading) return <FullLoader />;
  if (!player)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Player not found.
      </div>
    );

  const performanceData = buildPerformanceData(player);

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <PageHeader back title={`${player.name}`} />
        <BanPlayerModal player={player} onSuccess={fetchPlayer} />
      </div>

      {/* Profile card */}
      <div className="rounded-lg border bg-card p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar name={player.name} />
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <p className="text-muted-foreground text-sm">@{player.name}</p>
            {player.role && (
              <Badge variant="secondary" className="mt-1 capitalize">
                {player.role}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <ScrollArea>
            <TabsList className="w-full mb-4">
              {[
                "overview",
                "statistics",
                "recent-matches",
                "events-played",
                "team-history",
                "performance-history",
                "profile-changes",
              ].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="capitalize text-xs"
                >
                  {tab.replace(/-/g, " ")}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
              <div>
                <p className="text-xs text-muted-foreground">Email Address</p>
                <p className="text-sm mt-0.5">{player.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="text-sm mt-0.5">{player.phone ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Discord Username
                </p>
                <p className="text-sm mt-0.5">
                  {player.discord_username ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Current Location
                </p>
                <p className="text-sm mt-0.5">{player.location ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">UID</p>
                <p className="text-sm mt-0.5">{player.uid ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team</p>
                <p className="text-sm mt-0.5">{player.team ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm mt-0.5 capitalize">
                  {player.in_game_role ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Country</p>
                <p className="text-sm mt-0.5">{player.country ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Kills</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.total_kills)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Total Tournaments
                </p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(
                    (player.tournaments_wins ?? 0) +
                      (player.tournament_booyah ?? 0),
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Scrims</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(
                    (player.scrims_wins ?? 0) + (player.scrim_booyah ?? 0),
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Total Money Made
                </p>
                <p className="text-2xl font-bold mt-0.5">
                  {player.total_money_made
                    ? `$${formatMoneyInput(player.total_money_made)}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total MVPs</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.total_mvps)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Wins</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.total_wins)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p
                  className={`text-sm font-semibold mt-0.5 ${player.status === "banned" ? "text-destructive" : "text-green-500"}`}
                >
                  {player.status
                    ? player.status.charAt(0).toUpperCase() +
                      player.status.slice(1)
                    : "Active"}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Statistics */}
          <TabsContent value="statistics">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
              <div>
                <p className="text-xs text-muted-foreground">KDR</p>
                <p className="text-2xl font-bold mt-0.5">
                  {player.kdr.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg. Damage</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.avg_damage)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Headshot %</p>
                <p className="text-2xl font-bold mt-0.5">—</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold mt-0.5">
                  {player.win_rate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Tournament Kills
                </p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.tournaments_kills)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scrim Kills</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.scrims_kills)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tournament Wins</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.tournaments_wins)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scrim Wins</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.scrims_wins)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Tournament Booyahs
                </p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.tournament_booyah)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scrim Booyahs</p>
                <p className="text-2xl font-bold mt-0.5">
                  {formatMoneyInput(player.scrim_booyah)}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Recent Matches */}
          <TabsContent value="recent-matches">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Kills</TableHead>
                  <TableHead>KDR</TableHead>
                  <TableHead>Damage</TableHead>
                  <TableHead>MVPs</TableHead>
                  <TableHead>Placement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No recent matches available yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          {/* Events Played */}
          <TabsContent value="events-played">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Placement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground py-8"
                  >
                    No events played data available yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          {/* Team History */}
          <TabsContent value="team-history">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Role Changes</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {player.team ? (
                  <TableRow>
                    <TableCell className="font-medium">{player.team}</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>Present</TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-8"
                    >
                      No team history available yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Performance History */}
          <TabsContent value="performance-history">
            {player.total_kills === 0 &&
            player.total_wins === 0 &&
            player.kdr === 0 ? (
              <EmptyState label="performance history" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Kills" stroke="#6366f1" dot />
                  <Line type="monotone" dataKey="Wins" stroke="#22c55e" dot />
                  <Line type="monotone" dataKey="KDR" stroke="#eab308" dot />
                  <Line
                    type="monotone"
                    dataKey="Avg. Damage"
                    stroke="#ef4444"
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </TabsContent>

          {/* Profile Changes */}
          <TabsContent value="profile-changes">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Field Changed</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No profile changes recorded yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Page;
