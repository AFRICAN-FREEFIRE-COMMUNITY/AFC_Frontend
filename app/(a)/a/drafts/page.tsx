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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { IconCalendarEvent, IconUser } from "@tabler/icons-react";
import axios from "axios";
import { Search } from "lucide-react";
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
import { toast } from "sonner";
import { DeleteEventModal } from "../events/_components/DeleteEventModal";
import { ITEMS_PER_PAGE } from "@/constants";

interface DraftedEvent {
  event_id: number;
  event_slug: string;
  event_name: string;
  participant_type: string;
  created_at: string;
}

const DraftedEventsTable = ({
  drafts,
  searchQuery,
  onDeleted,
  emptyMessage,
}: {
  drafts: DraftedEvent[];
  searchQuery: string;
  onDeleted: () => void;
  emptyMessage: string;
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = drafts.filter((d) =>
    d.event_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, drafts]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event Name</TableHead>
            <TableHead>Participant Type</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginated.length > 0 ? (
            paginated.map((draft) => (
              <TableRow key={draft.event_id}>
                <TableCell className="font-medium">
                  {draft.event_name}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {draft.participant_type}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(draft.created_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 justify-end">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/a/events/${draft.event_slug}/edit`}>
                        Continue editing
                      </Link>
                    </Button>
                    <DeleteEventModal
                      eventId={draft.event_id}
                      eventName={draft.event_name}
                      onSuccess={onDeleted}
                      isIcon
                      size="sm"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                {searchQuery.length > 0
                  ? "No drafts match your search."
                  : emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
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

const page = () => {
  const { token } = useAuth();

  const [allDrafts, setAllDrafts] = useState<DraftedEvent[]>([]);
  const [myDrafts, setMyDrafts] = useState<DraftedEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [pendingAll, startAllTransition] = useTransition();
  const [pendingMy, startMyTransition] = useTransition();

  const fetchAllDrafts = () => {
    startAllTransition(async () => {
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-drafted-events/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setAllDrafts(res.data.drafted_events || []);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to fetch all drafts.",
        );
      }
    });
  };

  const fetchMyDrafts = () => {
    startMyTransition(async () => {
      try {
        const res = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-my-drafted-events/`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setMyDrafts(res.data.drafted_events || []);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to fetch my drafts.",
        );
      }
    });
  };

  useEffect(() => {
    fetchAllDrafts();
    fetchMyDrafts();
  }, []);

  const handleDeleted = () => {
    fetchAllDrafts();
    fetchMyDrafts();
  };

  if (pendingAll && pendingMy) return <FullLoader />;

  return (
    <div>
      <PageHeader back title="Drafts" />

      <div className="mt-4 grid gap-2 grid-cols-1 sm:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">All Drafts</CardTitle>
            <IconCalendarEvent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allDrafts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total drafted events across all admins
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow gap-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Drafts</CardTitle>
            <IconUser className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myDrafts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Drafted events created by you
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search drafts by event name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/50 backdrop-blur-sm"
        />
      </div>

      <Tabs defaultValue="all" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="all">
            All Drafts
            {allDrafts.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {allDrafts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mine">
            My Drafts
            {myDrafts.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {myDrafts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Drafted Events</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingAll ? (
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : (
                <DraftedEventsTable
                  drafts={allDrafts}
                  searchQuery={searchQuery}
                  onDeleted={handleDeleted}
                  emptyMessage="No drafted events found."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mine">
          <Card>
            <CardHeader>
              <CardTitle>My Drafted Events</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingMy ? (
                <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : (
                <DraftedEventsTable
                  drafts={myDrafts}
                  searchQuery={searchQuery}
                  onDeleted={handleDeleted}
                  emptyMessage="You have no drafted events."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default page;
