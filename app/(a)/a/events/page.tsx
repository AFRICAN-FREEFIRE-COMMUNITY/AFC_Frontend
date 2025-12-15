// "use client";
// import { FullLoader } from "@/components/Loader";
// import { PageHeader } from "@/components/PageHeader";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { env } from "@/lib/env";
// import { formatDate, formatMoneyInput, formattedWord } from "@/lib/utils";
// import {
//   IconCalendar,
//   IconClock,
//   IconSwords,
//   IconTrendingUp,
//   IconTrophy,
//   IconUsers,
// } from "@tabler/icons-react";
// import axios from "axios";
// import { CheckCircle2Icon, TrendingUp } from "lucide-react";
// import Link from "next/link";
// import React, { useEffect, useState, useTransition } from "react";
// import { toast } from "sonner";

// interface EventProp {
//   event_id: string;
//   number_of_participants: number;
//   event_name: string;
//   event_date: string;
//   event_status: string;
//   competition_type: string;
// }

// const page = () => {
//   const [totalEvents, setTotalEvents] = useState<number>(0);
//   const [totalTournaments, setTotalTournaments] = useState<number>(0);
//   const [totalScrims, setTotalScrims] = useState<number>(0);
//   const [totalUpcomingEvents, setTotalUpcomingEvents] = useState<number>(0);
//   const [totalOngoingEvents, setTotalOngoingEvents] = useState<number>(0);
//   const [totalCompletedEvents, setTotalCompletedEvents] = useState<number>(0);
//   const [totalAvgParticipants, setTotalAvgParticipants] = useState<number>(0);
//   const [totalPopularEventFormat, setTotalPopularEventFormat] =
//     useState<string>("");

//   const [searchQuery, setSearchQuery] = useState("");

//   const [pending, startTransition] = useTransition();
//   const [events, setEvents] = useState<EventProp[]>([]);

//   const fetchEvents = () => {
//     startTransition(async () => {
//       try {
//         const events = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`
//         );
//         const tournaments = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-total-tournaments-count/`
//         );
//         const scrims = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-total-scrims-count/`
//         );
//         const upcomingEvents = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-upcoming-events-count/`
//         );
//         const ongoingEvents = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-ongoing-events-count/`
//         );
//         const completedEvents = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-completed-events-count/`
//         );
//         const avgParticipants = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-average-participants-per-event/`
//         );

//         if (events.statusText === "OK") {
//           setEvents(events.data.events);
//           setTotalEvents(events.data.events.length);
//           setTotalTournaments(tournaments.data.total_tournaments);
//           setTotalScrims(scrims.data.total_scrims);
//           setTotalUpcomingEvents(upcomingEvents.data.upcoming_events);
//           setTotalOngoingEvents(ongoingEvents.data.ongoing_events);
//           setTotalCompletedEvents(completedEvents.data.completed_events);
//           setTotalAvgParticipants(avgParticipants.data.average_participants);
//         } else {
//           toast.error("Oops! An error occurred");
//         }
//       } catch (error: any) {
//         toast.error(error?.response?.data.message);
//       }
//     });
//   };

//   useEffect(() => {
//     fetchEvents();
//   }, []);

//   if (pending) return <FullLoader />;

//   return (
//     <div>
//       <PageHeader back title={"Events Management"} />
//       <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Total Events</CardTitle>
//             <IconCalendar className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formatMoneyInput(totalEvents)}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Tournaments & Scrims
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Total Tournaments
//             </CardTitle>
//             <IconTrophy className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formatMoneyInput(totalTournaments)}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Registered tournaments
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Total Scrims</CardTitle>
//             <IconSwords className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formatMoneyInput(totalScrims)}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Registered scrims
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Upcoming Events
//             </CardTitle>
//             <IconClock className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formatMoneyInput(totalUpcomingEvents)}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Events in planning or open for registration
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Ongoing Events
//             </CardTitle>
//             <IconTrendingUp className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formatMoneyInput(totalOngoingEvents)}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Currently active events
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Completed Events
//             </CardTitle>
//             <CheckCircle2Icon className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formatMoneyInput(totalCompletedEvents)}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Events that have concluded
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Avg. Participants
//             </CardTitle>
//             <IconUsers className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formatMoneyInput(totalAvgParticipants)}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Per event
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//         <Card className="hover:shadow-lg transition-shadow gap-1">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Most Popular Format
//             </CardTitle>
//             <IconTrophy className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">
//               {formattedWord[totalPopularEventFormat]}
//             </div>
//             <div className="flex items-center gap-2 mt-2">
//               <div className="flex items-center gap-1 text-xs text-muted-foreground">
//                 Based on event count
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//       <div className="mt-4 flex items-center justify-start gap-2">
//         <Input
//           type="search"
//           placeholder="Search events..."
//           value={searchQuery}
//           onChange={(e) => setSearchQuery(e.target.value)}
//           className="bg-background/50 backdrop-blur-sm block"
//         />
//         <Button asChild>
//           <Link href={"/a/events/create"}>Create new event</Link>
//         </Button>
//       </div>
//       <Card className="mt-4">
//         <CardHeader>
//           <CardTitle>Events & Scrims List</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <Table>
//             <TableHeader>
//               <TableRow>
//                 <TableHead>Name</TableHead>
//                 <TableHead>Type</TableHead>
//                 <TableHead>Date</TableHead>
//                 <TableHead>Status</TableHead>
//                 <TableHead>Participants</TableHead>
//                 <TableHead></TableHead>
//               </TableRow>
//             </TableHeader>
//             <TableBody>
//               {events?.map((event) => (
//                 <TableRow key={event.event_id}>
//                   <TableCell className="font-medium">
//                     {event.event_name}
//                   </TableCell>
//                   <TableCell className="capitalize">
//                     {event.competition_type}
//                   </TableCell>
//                   <TableCell>{formatDate(event.event_date)}</TableCell>
//                   <TableCell className="capitalize">
//                     {event.event_status}
//                   </TableCell>
//                   <TableCell>{event.number_of_participants}</TableCell>
//                   <TableCell>
//                     <div className="flex items-center gap-2 justify-center">
//                       <Button asChild variant={"outline"} size="md">
//                         <Link href={`/a/events/${event.event_id}`}>View</Link>
//                       </Button>
//                       <Button asChild variant={"outline"} size="md">
//                         <Link href={`/a/events/${event.event_id}/edit`}>
//                           Edit
//                         </Link>
//                       </Button>
//                     </div>
//                   </TableCell>
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default page;

"use client";
import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/lib/env";
import { formatDate, formatMoneyInput, formattedWord } from "@/lib/utils";
import {
  IconCalendar,
  IconClock,
  IconSwords,
  IconTrendingUp,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import axios from "axios";
import { CheckCircle2Icon } from "lucide-react"; // Removed unused 'TrendingUp'
import Link from "next/link";
import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

interface EventProp {
  event_id: string;
  number_of_participants: number;
  event_name: string;
  event_date: string;
  event_status: string;
  competition_type: string;
}

const page = () => {
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [totalTournaments, setTotalTournaments] = useState<number>(0);
  const [totalScrims, setTotalScrims] = useState<number>(0);
  const [totalUpcomingEvents, setTotalUpcomingEvents] = useState<number>(0);
  const [totalOngoingEvents, setTotalOngoingEvents] = useState<number>(0);
  const [totalCompletedEvents, setTotalCompletedEvents] = useState<number>(0);
  const [totalAvgParticipants, setTotalAvgParticipants] = useState<number>(0);
  // Note: Assuming totalPopularEventFormat is set elsewhere, kept for context
  const [totalPopularEventFormat, setTotalPopularEventFormat] =
    useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");

  const [pending, startTransition] = useTransition();
  const [events, setEvents] = useState<EventProp[]>([]);

  const fetchEvents = () => {
    startTransition(async () => {
      try {
        const eventsResponse = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`
        );
        const tournaments = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-total-tournaments-count/`
        );
        const scrims = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-total-scrims-count/`
        );
        const upcomingEvents = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-upcoming-events-count/`
        );
        const ongoingEvents = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-ongoing-events-count/`
        );
        const completedEvents = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-completed-events-count/`
        );
        const avgParticipants = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-average-participants-per-event/`
        );

        if (eventsResponse.statusText === "OK") {
          setEvents(eventsResponse.data.events);
          setTotalEvents(eventsResponse.data.events.length);
          setTotalTournaments(tournaments.data.total_tournaments);
          setTotalScrims(scrims.data.total_scrims);
          setTotalUpcomingEvents(upcomingEvents.data.upcoming_events);
          setTotalOngoingEvents(ongoingEvents.data.ongoing_events);
          setTotalCompletedEvents(completedEvents.data.completed_events);
          setTotalAvgParticipants(avgParticipants.data.average_participants);
          // Note: Logic for setting totalPopularEventFormat is missing, but state is kept.
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
    <div>
      <PageHeader back title={"Events Management"} />
      <div className="grid gap-2 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
        {/* ... (Your Card components remain here) ... */}
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <IconCalendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalEvents)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Tournaments & Scrims
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Tournaments
            </CardTitle>
            <IconTrophy className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalTournaments)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Registered tournaments
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scrims</CardTitle>
            <IconSwords className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalScrims)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Registered scrims
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Events
            </CardTitle>
            <IconClock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalUpcomingEvents)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Events in planning or open for registration
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ongoing Events
            </CardTitle>
            <IconTrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalOngoingEvents)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Currently active events
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Events
            </CardTitle>
            <CheckCircle2Icon className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalCompletedEvents)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Events that have concluded
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Participants
            </CardTitle>
            <IconUsers className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoneyInput(totalAvgParticipants)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Per event
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Most Popular Format
            </CardTitle>
            <IconTrophy className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {/* Fallback text if formattedWord is not defined for the value */}
              {formattedWord[totalPopularEventFormat] ||
                (totalPopularEventFormat ? totalPopularEventFormat : "N/A")}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Based on event count
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 flex items-center justify-start gap-2">
        <Input
          type="search"
          placeholder="Search events by name, type, or status..."
          value={searchQuery}
          // The onChange handler already updates the searchQuery state, triggering a re-render
          // where the filtering logic is executed. This is correct.
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-background/50 backdrop-blur-sm block"
        />
        <Button asChild>
          <Link href={"/a/events/create"}>Create new event</Link>
        </Button>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Events & Scrims List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Participants</TableHead>
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
                    <TableCell className="capitalize">
                      {event.competition_type}
                    </TableCell>
                    <TableCell>{formatDate(event.event_date)}</TableCell>
                    <TableCell className="capitalize">
                      {event.event_status}
                    </TableCell>
                    <TableCell>
                      {formatMoneyInput(event.number_of_participants)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <Button asChild variant={"outline"} size="md">
                          <Link href={`/a/events/${event.event_id}`}>View</Link>
                        </Button>
                        <Button asChild variant={"outline"} size="md">
                          <Link href={`/a/events/${event.event_id}/edit`}>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default page;
