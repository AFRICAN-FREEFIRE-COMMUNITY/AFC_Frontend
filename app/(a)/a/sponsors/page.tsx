"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ITEMS_PER_PAGE } from "@/constants";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import axios from "axios";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface SponsorAccount {
  sponsor_id: number;
  full_name: string;
  in_game_name: string;
  events: { event_id: number; event_name: string }[];
}

export default function SponsorsAdminPage() {
  const { token, loading: authLoading } = useAuth();
  const [sponsors, setSponsors] = useState<SponsorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchSponsors = useCallback(async () => {
    try {
      // TODO: replace with actual endpoint once available
      // const res = await axios.get(
      //   `${env.NEXT_PUBLIC_BACKEND_API_URL}/sponsors/get-all-sponsors/`,
      //   { headers: { Authorization: `Bearer ${token}` } },
      // );
      // setSponsors(res.data.sponsors ?? []);
      setSponsors([]);
    } catch {
      toast.error("Failed to load sponsors.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setLoading(false);
      return;
    }
    fetchSponsors();
  }, [authLoading, token, fetchSponsors]);

  const filtered = useMemo(() => {
    setPage(1);
    const q = search.toLowerCase().trim();
    if (!q) return sponsors;
    return sponsors.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.in_game_name.toLowerCase().includes(q),
    );
  }, [sponsors, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  if (loading) return <FullLoader />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start:md:items-center justify-between gap-1">
        <PageHeader
          title="Sponsors"
          description={`${sponsors.length} sponsor account${sponsors.length !== 1 ? "s" : ""}`}
        />
        <Button asChild className="w-full md:w-auto">
          <Link href="/a/sponsors/create">
            <IconPlus />
            Create Sponsor Account
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or IGN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
          >
            <IconX className="size-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {sponsors.length === 0
              ? "No sponsor accounts yet. Create one to get started."
              : "No sponsors match your search."}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>In-Game Name</TableHead>
                    <TableHead>Assigned Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((s) => (
                    <TableRow key={s.sponsor_id}>
                      <TableCell className="font-medium">
                        {s.full_name}
                      </TableCell>
                      <TableCell>{s.in_game_name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {s.events.length === 0 ? (
                            <span className="text-muted-foreground text-xs">
                              None
                            </span>
                          ) : (
                            s.events.map((e) => (
                              <span
                                key={e.event_id}
                                className="bg-muted text-xs px-2 py-0.5 rounded-full"
                              >
                                {e.event_name}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of{" "}
                  {filtered.length}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={
                          page === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - page) <= 1,
                      )
                      .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                          acc.push("ellipsis");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={page === p}
                              onClick={() => setPage(p as number)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        aria-disabled={page === totalPages}
                        className={
                          page === totalPages
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
      )}
    </div>
  );
}
