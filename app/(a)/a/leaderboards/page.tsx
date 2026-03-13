"use client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import {
  IconCalendar,
  IconClock,
  IconEye,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrendingUp,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import Link from "next/link";
import React, { useEffect, useState, useTransition } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EventProp } from "../events/page";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ITEMS_PER_PAGE } from "@/constants";
import { DownloadLeaderboardButton } from "./_components/DownloadLeaderboardButton";

interface LeaderboardProps {
  leaderboard_id: number;
  leaderboard_name: string;
  event: {
    event_id: number;
    event_name: string;
  };
  stage: {
    stage_id: number;
    stage_name: string;
  };
  group: {
    group_id: number;
    group_name: string;
  };
  creator: {
    user_id: number;
    username: string;
  };
  placement_points: any;
  kill_point: number;
  file_type: string;
  leaderboard_method: string;
  created_at: Date;
}

const page = () => {
  const { token } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLeaderboardQuery, setSearchLeaderboardQuery] = useState("");
  const [eventsPage, setEventsPage] = useState(1);
  const [events, setEvents] = useState<EventProp[]>([]);
  const [leaderboards, setLeaderboards] = useState<LeaderboardProps[]>([]);

  const [pending, startTransition] = useTransition();

  const fetchEvents = () => {
    startTransition(async () => {
      try {
        const eventsResponse = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
        );
        const leaderboardResponse = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboards/`,
        );
        if (
          eventsResponse.statusText === "OK" ||
          leaderboardResponse.statusText === "OK"
        ) {
          setEvents(eventsResponse.data.events);
          setLeaderboards(leaderboardResponse.data.leaderboards);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to fetch event data.",
        );
      }
    });
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    setEventsPage(1);
  }, [searchQuery]);

  const filteredEvents = events.filter((event) => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    return (
      event.event_name.toLowerCase().includes(lowerCaseQuery) ||
      event.competition_type.toLowerCase().includes(lowerCaseQuery) ||
      event.event_status.toLowerCase().includes(lowerCaseQuery)
    );
  });

  const filteredLeaderboards = leaderboards.filter((leaderboard) => {
    const lowerCaseQuery = searchLeaderboardQuery.toLowerCase();
    return (
      leaderboard.leaderboard_name.toLowerCase().includes(lowerCaseQuery) ||
      leaderboard.event.event_name.toLowerCase().includes(lowerCaseQuery) ||
      leaderboard.group.group_name.toLowerCase().includes(lowerCaseQuery)
    );
  });

  const eventsTotalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (eventsPage - 1) * ITEMS_PER_PAGE,
    eventsPage * ITEMS_PER_PAGE,
  );

  if (pending) return <FullLoader />;

  return (
    <div className="space-y-4">
      <PageHeader back title="Leaderboards Management" />
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Leaderboards
            </CardTitle>
            <IconTrophy className="size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(leaderboards.length)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Overall count
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tournament Leaderboards
            </CardTitle>
            <IconTrendingUp className="size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyInput(0)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                From tournaments
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Scrim Leaderboards
            </CardTitle>
            <IconTrendingUp className="size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyInput(0)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                From scrims
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Teams per Leaderboard
            </CardTitle>
            <IconUsers className="size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyInput(0)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Average participants
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Created This Month
            </CardTitle>
            <IconCalendar className="size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyInput(0)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                New leaderboards
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Most Recent Update
            </CardTitle>
            <IconClock className="size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyInput(0)}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Last leaderboard activity
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Search Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-start gap-2">
            <Input
              type="search"
              placeholder="Search events by name, type, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background/50 backdrop-blur-sm block"
            />
            <Button className="w-9 h-9 md:h-12 md:w-auto">
              <IconSearch />
              <span className="hidden md:inline-block">Search</span>
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEvents?.length > 0 ? (
                paginatedEvents.map((event) => (
                  <TableRow key={event.event_id}>
                    <TableCell className="font-medium">
                      {event.event_name}
                    </TableCell>
                    <TableCell>{formatDate(event.event_date)}</TableCell>
                    <TableCell className="capitalize">
                      {event.competition_type}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center flex-wrap">
                        {/* Pass event_id as a query param so BasicInfoStep can auto-select it */}
                        <Button
                          className="hidden"
                          asChild
                          variant={"outline"}
                          size="sm"
                        >
                          <Link
                            href={`/a/leaderboards/create?event_id=${event.event_id}`}
                          >
                            <IconPlus />
                            Create
                          </Link>
                        </Button>
                        <Button asChild variant={"outline"} size="sm">
                          <Link href={`/a/leaderboards/${event.event_id}`}>
                            <IconEye />
                            View
                          </Link>
                        </Button>
                        <Button asChild variant={"outline"} size="sm">
                          <Link href={`/a/leaderboards/${event.event_id}/edit`}>
                            <IconPencil />
                            Edit
                          </Link>
                        </Button>
                        {/* <DownloadLeaderboardButton
                          leaderboardName={event.event_name}
                          fetchData={async () => {
                            const res = await fetch(
                              `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-leaderboard-details-for-event/`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                },
                                body: JSON.stringify({
                                  event_id: String(event.event_id),
                                }),
                              },
                            );
                            const data = await res.json();

                            // Aggregate team rows from first stage/group overall leaderboard
                            const firstGroup = data.stages?.[0]?.groups?.[0];
                            const teamRows =
                              firstGroup?.overall_leaderboard ?? [];

                            // Aggregate player rows across ALL stages and groups
                            const playerMap = new Map<number, any>();
                            for (const stage of data.stages ?? []) {
                              for (const group of stage.groups ?? []) {
                                for (const match of group.matches ?? []) {
                                  for (const teamStat of match.stats ?? []) {
                                    for (const player of teamStat.players ?? []) {
                                      const existing = playerMap.get(
                                        player.player_id,
                                      );
                                      if (existing) {
                                        existing.total_kills += player.kills;
                                        existing.total_damage += player.damage;
                                        existing.total_assists += player.assists;
                                      } else {
                                        playerMap.set(player.player_id, {
                                          player_id: player.player_id,
                                          username: player.username,
                                          team_name: teamStat.team_name ?? "—",
                                          total_kills: player.kills,
                                          total_damage: player.damage,
                                          total_assists: player.assists,
                                        });
                                      }
                                    }
                                  }
                                }
                              }
                            }
                            const playerRows = [...playerMap.values()].sort(
                              (a, b) => b.total_kills - a.total_kills,
                            );
                            return { teamRows, playerRows };
                          }}
                        /> */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {searchQuery.length > 0
                      ? "No events match your search query."
                      : "No events available."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {eventsTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="hidden md:block text-sm text-muted-foreground">
                Showing {(eventsPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(eventsPage * ITEMS_PER_PAGE, filteredEvents.length)}{" "}
                of {filteredEvents.length}
              </p>
              <Pagination className="w-full md:w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                      className={
                        eventsPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: eventsTotalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === eventsTotalPages ||
                        Math.abs(page - eventsPage) <= 1,
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
                            isActive={eventsPage === page}
                            onClick={() => setEventsPage(page)}
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
                        setEventsPage((p) => Math.min(eventsTotalPages, p + 1))
                      }
                      className={
                        eventsPage === eventsTotalPages
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
