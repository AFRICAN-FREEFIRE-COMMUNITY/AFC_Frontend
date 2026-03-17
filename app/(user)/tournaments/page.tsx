"use client";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { DEFAULT_IMAGE, ITEMS_PER_PAGE } from "@/constants";

// --- Types ---
interface Event {
  event_id: number;
  event_name: string;
  event_date: string;
  event_status: "upcoming" | "ongoing" | "completed";
  competition_type: "tournament" | "scrim";
  event_banner: string;
  slug: string;
  prizepool: string;
  number_of_participants: number;
  total_registered_competitors: number;
}

type StatusFilter = "all" | "upcoming" | "ongoing" | "completed";
type DateSort = "newest" | "oldest";
type MonthFilter = "all" | string; // "YYYY-MM"

// --- Event Card ---
const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const formattedDate = formatDate(event.event_date);

  const statusColors: Record<string, string> = {
    upcoming: "text-blue-500",
    ongoing: "text-green-500",
    completed: "text-muted-foreground",
  };

  return (
    <Card
      className="overflow-hidden h-full bg-transparent gap-0 p-0"
      key={event.event_id}
    >
      <Link href={`/tournaments/${event.slug}`}>
        <Image
          src={event.event_banner || DEFAULT_IMAGE}
          alt={event.event_name}
          width={1000}
          height={1000}
          className="object-cover size-full aspect-video"
        />
      </Link>

      <CardContent className="py-4 space-y-2">
        <CardTitle className="hover:text-primary hover:underline">
          <Link href={`/tournaments/${event.slug}`}>{event.event_name}</Link>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Date: {formattedDate}</p>
        <p
          className={`text-sm font-medium ${statusColors[event.event_status] ?? "text-muted-foreground"}`}
        >
          {event.event_status.charAt(0).toUpperCase() +
            event.event_status.slice(1)}
        </p>
        <Button className="w-full" variant={"outline"} asChild>
          <Link href={`/tournaments/${event.slug}`}>View Details</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

// --- Paginated Event List ---
const EventList: React.FC<{ events: Event[]; searchQuery: string }> = ({
  events,
  searchQuery,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, events]);

  const filtered = useMemo(() => {
    if (!searchQuery) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.event_name.toLowerCase().includes(query) ||
        e.event_date.includes(query) ||
        e.event_status.toLowerCase().includes(query),
    );
  }, [events, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <>
      <div className="grid grid-cols-1 mt-4 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {paginated.length > 0 ? (
          paginated.map((event) => (
            <EventCard key={event.event_id} event={event} />
          ))
        ) : (
          <p className="text-center text-muted-foreground col-span-full py-8">
            {searchQuery
              ? `No events match "${searchQuery}"`
              : "No events available."}
          </p>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="hidden md:block text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of{" "}
            {filtered.length}
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
    </>
  );
};

// --- Main Component ---
const EventsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("all");
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setEvents(data.events || []);
    } catch {
      setError(
        "Failed to load events. Please check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Derive sorted unique month options from all events
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const months: { value: string; label: string }[] = [];
    [...events]
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .forEach((e) => {
        const ym = e.event_date.slice(0, 7); // "YYYY-MM"
        if (!seen.has(ym)) {
          seen.add(ym);
          const [year, month] = ym.split("-");
          const label = new Date(
            Number(year),
            Number(month) - 1,
          ).toLocaleString("default", { month: "long", year: "numeric" });
          months.push({ value: ym, label });
        }
      });
    return months;
  }, [events]);

  // Apply filters + sort before splitting by competition type
  const filteredEvents = useMemo(() => {
    let result = events;

    if (statusFilter !== "all") {
      result = result.filter((e) => e.event_status === statusFilter);
    }

    if (monthFilter !== "all") {
      result = result.filter((e) => e.event_date.startsWith(monthFilter));
    }

    result = [...result].sort((a, b) => {
      const diff =
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      return dateSort === "newest" ? -diff : diff;
    });

    return result;
  }, [events, statusFilter, monthFilter, dateSort]);

  const tournaments = useMemo(
    () => filteredEvents.filter((e) => e.competition_type === "tournament"),
    [filteredEvents],
  );
  const scrims = useMemo(
    () => filteredEvents.filter((e) => e.competition_type === "scrim"),
    [filteredEvents],
  );

  const statusCounts = useMemo(() => {
    const counts = {
      all: events.length,
      upcoming: 0,
      ongoing: 0,
      completed: 0,
    };
    for (const e of events) {
      if (e.event_status in counts) counts[e.event_status]++;
    }
    return counts;
  }, [events]);

  if (isLoading) return <FullLoader />;

  return (
    <div>
      <PageHeader title="Tournaments & Scrims" />

      {/* Search */}
      <div className="flex w-full mb-3 items-center justify-center gap-2 flex-col md:flex-row">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by title, date (YYYY-MM-DD), or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background/50 backdrop-blur-sm pl-10"
          />
        </div>
        <div className="flex w-full md:w-auto items-center gap-2 justify-center">
          <Select
            value={monthFilter}
            onValueChange={(v) => setMonthFilter(v as MonthFilter)}
          >
            <SelectTrigger className="w-full md:w-44 text-xs">
              <SelectValue placeholder="All Dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date sort */}
          <Select
            value={dateSort}
            onValueChange={(v) => setDateSort(v as DateSort)}
          >
            <SelectTrigger className="w-full md:w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Status filter buttons */}
        <div className="flex flex-wrap gap-1">
          {(["all", "upcoming", "ongoing", "completed"] as StatusFilter[]).map(
            (s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
                className="capitalize text-xs"
              >
                {s === "all" ? "All" : s}
                <span className="ml-1 text-xs opacity-70">
                  ({s === "all" ? statusCounts.all : statusCounts[s]})
                </span>
              </Button>
            ),
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-4">
          {error}
        </div>
      )}

      {!error && (
        <Tabs defaultValue="tournaments">
          <TabsList className="w-full">
            <TabsTrigger value="tournaments">
              Tournaments ({tournaments.length})
            </TabsTrigger>
            <TabsTrigger value="scrims">Scrims ({scrims.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="tournaments">
            <EventList events={tournaments} searchQuery={searchQuery} />
          </TabsContent>
          <TabsContent value="scrims">
            <EventList events={scrims} searchQuery={searchQuery} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default EventsPage;
