"use client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import {
  IconCalendar,
  IconClock,
  IconPlus,
  IconTrendingUp,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import Link from "next/link";
import React, { useEffect, useState, useTransition } from "react";
import { EventProp } from "../events/page";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const page = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState<EventProp[]>([]);

  const [pending, startTransition] = useTransition();

  const fetchEvents = () => {
    startTransition(async () => {
      try {
        const eventsResponse = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`
        );
        if (eventsResponse.statusText === "OK") {
          setEvents(eventsResponse.data.events);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        // More robust error handling for API calls
        toast.error(
          error?.response?.data?.message || "Failed to fetch event data."
        );
      }
    });
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // --- Search Filtering Logic ---
  const filteredEvents = events.filter((event) => {
    const lowerCaseQuery = searchQuery.toLowerCase();

    // Check if the search query is found in the event name or competition type
    return (
      event.event_name.toLowerCase().includes(lowerCaseQuery) ||
      event.competition_type.toLowerCase().includes(lowerCaseQuery) ||
      event.event_status.toLowerCase().includes(lowerCaseQuery)
    );
  });
  // ------------------------------

  if (pending) return <FullLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader back title="Leaderboards Management" />
        <Button asChild>
          <Link href={"/a/leaderboards/create"}>
            <IconPlus />
            Create Leaderboard
          </Link>
        </Button>
      </div>
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Leaderboards
            </CardTitle>
            <IconTrophy className="size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyInput(7)}</div>
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
            <div className="text-2xl font-bold">{formatMoneyInput(7)}</div>
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
            <div className="text-2xl font-bold">{formatMoneyInput(7)}</div>
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
            <div className="text-2xl font-bold">{formatMoneyInput(7)}</div>
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
            <div className="text-2xl font-bold">{formatMoneyInput(7)}</div>
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
            <div className="text-2xl font-bold">{formatMoneyInput(7)}</div>
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
            <Button>Search</Button>
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
              {/* Use the filteredEvents list here */}
              {filteredEvents?.length > 0 ? (
                filteredEvents.map((event) => (
                  <TableRow key={event.event_id}>
                    <TableCell className="font-medium">
                      {event.event_name}
                    </TableCell>
                    <TableCell>{formatDate(event.event_date)}</TableCell>
                    <TableCell className="capitalize">
                      {event.competition_type}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <Button asChild variant={"outline"} size="md">
                          <Link href={`/a/leaderboards/create`}>
                            Create leaderboard
                          </Link>
                        </Button>
                        <Button asChild variant={"outline"} size="md">
                          <Link href={`/a/leaderboards/${event.event_id}`}>
                            View leaderboard
                          </Link>
                        </Button>
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>All Leaderboards</CardTitle>
        </CardHeader>
        <CardContent></CardContent>
      </Card>
    </div>
  );
};

export default page;
