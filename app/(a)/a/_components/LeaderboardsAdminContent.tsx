"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LeaderboardsAdminContent
// ----------------------------------------------------------------------------
// The Leaderboards admin surface, extracted VERBATIM from the old standalone
// app/(a)/a/leaderboards/page.tsx so it can render as the "Leaderboards" tab of
// the combined Events & Leaderboards page (owner request 2026-06-09: merge the
// two admin pages into one tabbed page). Behaviour is unchanged: same stat cards
// + event-search table (GET /events/get-all-events/ and /events/get-all-leaderboards/)
// with the per-event View/Edit leaderboard actions.
//
// RENDERED BY: app/(a)/a/events/page.tsx (the combined page, Leaderboards tab).
// The leaderboard detail/create/edit routes under /a/leaderboards/* are separate
// pages and are unaffected. EventProp is imported from EventsAdminContent (the
// Events tab body that now owns that shared type).
// ─────────────────────────────────────────────────────────────────────────────

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
import { EventProp } from "./EventsAdminContent";
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
import { ITEMS_PER_PAGE } from "@/constants";
import { matchesSearch } from "@/lib/search";
import { InfoTip } from "@/components/ui/info-tip";
// Standalone (event-less) leaderboards section — the shared list + "Create standalone" button.
// Additive: it sits below the existing event-leaderboard table and does not touch that UI.
import { StandaloneLeaderboardList } from "../leaderboards/standalone/_components/StandaloneLeaderboardList";

interface LeaderboardProps {
  leaderboard_id: number;
  leaderboard_name: string;
  event: {
    event_id: number;
    event_name: string;
    // competition_type ("tournament" / "scrims") is returned by
    // GET /events/get-all-leaderboards/ (backend get_all_leaderboards). It is used below
    // to split the total into the "Tournament Leaderboards" vs "Scrim Leaderboards" cards.
    competition_type?: string;
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

export const LeaderboardsAdminContent = () => {
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

  // Event search: route through the shared matchesSearch helper so the box is
  // punctuation/space/accent-insensitive and folds stylized "fancy font" names
  // (matches the rest of the site). Single call over all three fields (name,
  // competition_type, status) replaces the old OR-chain of .toLowerCase().includes().
  const filteredEvents = events.filter((event) =>
    matchesSearch(
      [event.event_name, event.competition_type, event.event_status],
      searchQuery,
    ),
  );

  // Leaderboard search: same shared matcher, across leaderboard name + parent
  // event name + group name, so the search behaves like every other list page.
  const filteredLeaderboards = leaderboards.filter((leaderboard) =>
    matchesSearch(
      [
        leaderboard.leaderboard_name,
        leaderboard.event.event_name,
        leaderboard.group.group_name,
      ],
      searchLeaderboardQuery,
    ),
  );

  // ── Breakdown of leaderboards by parent event's competition_type ──
  // Each leaderboard row from GET /events/get-all-leaderboards/ carries its event's
  // competition_type ("tournament" / "scrims"). We match "scrim" with startsWith so the
  // count is correct whether the data was saved as "scrim" or "scrims" (the model choice
  // is "scrims" but other backend filters use "scrim"). Drives the two stat cards below.
  const tournamentLeaderboardsCount = leaderboards.filter((lb) =>
    lb.event?.competition_type?.toLowerCase().startsWith("tournament"),
  ).length;
  const scrimLeaderboardsCount = leaderboards.filter((lb) =>
    lb.event?.competition_type?.toLowerCase().startsWith("scrim"),
  ).length;

  const eventsTotalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (eventsPage - 1) * ITEMS_PER_PAGE,
    eventsPage * ITEMS_PER_PAGE,
  );

  if (pending) return <FullLoader />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        title={
          <span className="inline-flex items-center">
            Leaderboards Management
            <InfoTip id="leaderboards._page" className="ml-1.5" />
          </span>
        }
      />
      {/* data-tour anchor: events page tour, Leaderboards tab "leaderboard totals" step
          (admin-tour-steps.ts → ADMIN_TOUR_STEPS.events, lazy step after the tab switch). */}
      <div
        data-tour="leaderboards-stats"
        className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4"
      >
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
            <div className="text-2xl font-bold">
              {formatMoneyInput(tournamentLeaderboardsCount)}
            </div>
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
            <div className="text-2xl font-bold">
              {formatMoneyInput(scrimLeaderboardsCount)}
            </div>
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
          {/* data-tour anchor: events page tour, Leaderboards tab "pick an event to score" step. */}
          <div
            data-tour="leaderboards-search"
            className="flex items-center justify-start gap-2"
          >
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
          {/* data-tour anchor: events page tour, Leaderboards tab "view or edit a leaderboard" step. */}
          <Table data-tour="leaderboards-table">
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
                Showing {(eventsPage - 1) * ITEMS_PER_PAGE + 1}-
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

      {/* ── Standalone (event-less) leaderboards ──────────────────────────────
          A separate section from the event leaderboards above. Lists the standalone
          leaderboards this admin can manage and links into the create wizard. The
          admin caller is unscoped (no organizationId), so it shows everything the
          backend lets the admin see (afc_leaderboard list view). */}
      <StandaloneLeaderboardList />
      {/* The AFC-native leaderboard DESIGN LIBRARY lives on the "Designs" tab of this page
          (DesignsAdminContent), not in this Leaderboards tab. Here you only pick a design when
          exporting a leaderboard (the "Export graphic" button on the standalone view page). */}
    </div>
  );
};
