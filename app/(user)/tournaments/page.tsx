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
import { Search } from "lucide-react";

// --- Types & Constants ---
// Define the structure of an event
interface Event {
  event_id: number;
  event_name: string;
  event_date: string; // The original date string from API
  event_status: "upcoming" | "past";
  event_type: "tournament" | "scrim"; // Inferred for UI grouping
  details_url: string; // This field is unused but kept for reference
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

// Component to render a single event card
const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  // We use formatDate from "@/lib/utils" which is imported.
  const formattedDate = formatDate(event.event_date);

  return (
    <Card className="gap-0" key={event.event_id}>
      <CardHeader>
        <CardTitle>{event.event_name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">Date: {formattedDate}</p>

        <p className="text-sm text-muted-foreground">
          Status:
          {event.event_status.charAt(0).toUpperCase() +
            event.event_status.slice(1)}
        </p>

        <Button className="w-full" variant={"outline"} asChild>
          {/* Link assumes the correct structure for EditEventPage: /a/events?id=... or a path */}
          <Link href={`/a/events?id=${event.event_id}`}>View Tournament</Link>
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
  const [error, setError] = useState<string | null>(null); // Memoized function for data fetching and processing

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-tournaments-and-scrims/`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: EventsResponse = await response.json();

      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError(
        "Failed to load events. Please check the API endpoint and try again."
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
      // Check event name
      const nameMatch = event.event_name.toLowerCase().includes(query); // Check event date (using the raw string for simplicity in filtering)
      const dateMatch = event.event_date.includes(query); // Check event status (for searching 'upcoming' or 'past')
      const statusMatch = event.event_status.toLowerCase().includes(query);

      return nameMatch || dateMatch || statusMatch;
    });
  }, [events, searchQuery]); // --- END NEW LOGIC ---
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
        <div className="grid grid-cols-1 mt-4 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredEvents.length > 0 ? (
            // Map over the filtered list
            filteredEvents.map((event) => (
              <EventCard key={event.event_id} event={event} />
            ))
          ) : (
            // Show no results message
            <p className="text-center text-muted-foreground col-span-full py-8">
              No events match your search query: {searchQuery}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EventsPage;
