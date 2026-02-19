"use client";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Search } from "lucide-react";
import Image from "next/image";
import { DEFAULT_IMAGE, ITEMS_PER_PAGE } from "@/constants";

// --- Types & Constants ---
// Define the structure of an event
interface Event {
  event_id: number;
  event_name: string;
  event_date: string; // The original date string from API
  event_status: "upcoming" | "past";
  event_type: "tournament" | "scrim"; // Inferred for UI grouping
  details_url: string; // This field is unused but kept for reference
  event_banner: string;
  slug: string;
  prizepool: string;
}

// Define the structure of the new API response
interface EventsResponse {
  events: {
    event_id: number;
    event_name: string;
    slug: string;
    event_date: string;
    event_status: "upcoming" | "past";
    event_banner: string;
    prizepool: string;
  }[];
}

// Component to render a single event card
const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  // We use formatDate from "@/lib/utils" which is imported.
  const formattedDate = formatDate(event.event_date);

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

        <p className="text-sm text-muted-foreground">
          Status:{" "}
          {event.event_status.charAt(0).toUpperCase() +
            event.event_status.slice(1)}
        </p>

        <Button className="w-full" variant={"outline"} asChild>
          <Link href={`/tournaments/${event.slug}`}>View Tournament</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

// --- Main Component ---
const EventsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setEvents(data.events || []);
    } catch (err) {
      setError(
        "Failed to load events. Please check the API endpoint and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]); // --- NEW: Filtered Events Logic using useMemo ---

  const filteredEvents = useMemo(() => {
    if (!searchQuery) {
      return events;
    }

    const query = searchQuery.toLowerCase();

    return events.filter((event) => {
      const nameMatch = event.event_name.toLowerCase().includes(query);
      const dateMatch = event.event_date.includes(query);
      const statusMatch = event.event_status.toLowerCase().includes(query);
      return nameMatch || dateMatch || statusMatch;
    });
  }, [events, searchQuery]);

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (isLoading) return <FullLoader />;

  return (
    <div>
      <PageHeader title="Tournaments & Scrims" />
      <div className="relative mb-4">
        {/* Added Search icon for visual cue */}
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          type="search"
          placeholder="Search events by title, date (YYYY-MM-DD), or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-background/50 backdrop-blur-sm pl-10"
        />
      </div>
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          {error}
        </div>
      )}
      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 mt-4 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {paginatedEvents.length > 0 ? (
              paginatedEvents.map((event) => (
                <EventCard key={event.event_id} event={event} />
              ))
            ) : (
              <p className="text-center text-muted-foreground col-span-full py-8">
                {searchQuery
                  ? `No events match your search query: ${searchQuery}`
                  : "No events available."}
              </p>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="hidden md:block text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)}{" "}
                of {filteredEvents.length}
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
      )}
    </div>
  );
};

export default EventsPage;
