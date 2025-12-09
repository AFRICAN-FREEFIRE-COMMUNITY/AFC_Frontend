"use client";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import React, { useState, useEffect, useMemo, useCallback } from "react";

// --- Types & Constants ---
// Define the structure of an event
interface Event {
  event_id: number;
  event_name: string;
  event_date: string;
  event_status: "upcoming" | "past";
  event_type: "tournament" | "scrim"; // Inferred for UI grouping
  details_url: string;
}

// Define the structure of the new API response
interface EventsResponse {
  events: {
    event_id: number;
    event_name: string;
    event_date: string;
    event_status: "upcoming" | "past";
  }[];
}

type TabValue = "all" | "upcoming" | "past";
// Updated API Endpoint - No Pagination
const API_URL = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-tournaments-and-scrims/`;

// Component to render a single event card
const EventCard: React.FC<{ event: Event }> = ({ event }) => (
  <Card className="gap-0" key={event.event_id}>
    <CardHeader>
      <CardTitle>{event.event_name}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Date: {formatDate(event.event_date)}
      </p>
      <p className="text-sm text-muted-foreground">
        Status:{" "}
        {event.event_status.charAt(0).toUpperCase() +
          event.event_status.slice(1)}
      </p>
      <Button className="w-full" variant={"outline"} asChild>
        <Link href={event.details_url}>View Tournament</Link>
      </Button>
    </CardContent>
  </Card>
);

// --- Main Component ---
const EventsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized function for data fetching and processing
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // No need to build query parameters for limit/offset
    const endpoint = API_URL;

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: EventsResponse = await response.json();

      console.log(response);

      // Process the fetched events to infer 'event_type' for UI grouping
      const processedEvents: Event[] = data.events.map((event) => {
        // Simple heuristic: check if name contains "Scrim" to distinguish from "Tournament"
        const isScrim = event.event_name.toLowerCase().includes("scrim");
        return {
          ...event,
          event_type: isScrim ? "scrim" : "tournament",
          details_url: `/tournaments/${event.event_id}`,
        };
      });

      // Sort events by date, upcoming first
      processedEvents.sort(
        (a, b) =>
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );

      setEvents(processedEvents);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError(
        "Failed to load events. Please check the API endpoint and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependencies are empty since we're fetching ALL data once

  // --- Effects for Data Loading ---
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // --- Derived State (Filtering and Memoization) ---
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // 1. Filter by Tab (Upcoming/Past)
    if (activeTab !== "all") {
      filtered = filtered.filter((event) => event.event_status === activeTab);
    }

    // 2. Filter by Search Query
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.event_name.toLowerCase().includes(lowerCaseQuery) ||
          event.event_date.includes(lowerCaseQuery)
      );
    }

    return filtered;
  }, [events, activeTab, searchQuery]);

  // Separate the filtered events into Tournaments and Scrims for the grid layout
  const tournaments = useMemo(
    () => filteredEvents.filter((event) => event.event_type === "tournament"),
    [filteredEvents]
  );

  const scrims = useMemo(
    () => filteredEvents.filter((event) => event.event_type === "scrim"),
    [filteredEvents]
  );

  if (isLoading) return <FullLoader />;
  return (
    <div>
      <PageHeader title="Tournaments & Scrims" />
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="space-y-4"
      >
        <ScrollArea>
          <TabsList className="w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value={activeTab} className="space-y-4">
          <Input
            type="search"
            placeholder="Search events by title or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background/50 backdrop-blur-sm"
          />
          {error && (
            <p className="text-center p-8 text-red-500">Error: {error}</p>
          )}

          {/* Events Grid */}
          {!isLoading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tournaments Column */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Tournaments ({tournaments.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tournaments.length > 0 ? (
                      tournaments.map((event) => (
                        <EventCard key={event.event_id} event={event} />
                      ))
                    ) : (
                      <p className="text-muted-foreground">
                        No tournaments found.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Scrims Column */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Scrims ({scrims.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {scrims.length > 0 ? (
                      scrims.map((event) => (
                        <EventCard key={event.event_id} event={event} />
                      ))
                    ) : (
                      <p className="text-muted-foreground">No scrims found.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          {!isLoading && !error && filteredEvents.length === 0 && (
            <div className="text-center p-8 border rounded-lg">
              <p className="text-lg font-semibold">No results found.</p>
              <p className="text-muted-foreground">
                Try adjusting your search or switching the active tab.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EventsPage;
