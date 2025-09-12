"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useNews } from "@/hooks/useAdminApi";
import { FullLoader } from "@/components/Loader";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export const AllNews = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Build filters object
  const filters = {
    ...(searchTerm && { search: searchTerm }),
    ...(filterCategory !== "all" && { category: filterCategory }),
    ...(filterStatus !== "all" && { status: filterStatus }),
  };

  //   const {
  //     data: newsItems,
  //     loading,
  //     error,
  //     pagination,
  //     updateParams,
  //     changePage,
  //   } = useNews(filters);

  // Update filters when search/filter values change
  //   useEffect(() => {
  //     updateParams(filters);
  //   }, [searchTerm, filterCategory, filterStatus]);

  const getStatusBadgeVariant = (status: string = "") => {
    switch (status.toLowerCase()) {
      case "published":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  const [pending, startTransition] = useTransition();
  const [news, setNews] = useState<any>();

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`
        );

        if (res.statusText === "OK") {
          setNews(res.data.news);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data.message);
      }
    });
  }, []);

  if (pending) return <FullLoader />;

  return (
    <div>
      {" "}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search news..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="tournament-updates">Tournaments</SelectItem>
              <SelectItem value="teams">Teams</SelectItem>
              <SelectItem value="rankings">Rankings</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/admin/news/create">Create New Announcement</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>News & Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {news && news.length > 0 ? (
                  news.map((newsDetails: any) => (
                    <TableRow key={newsDetails.news_id}>
                      <TableCell className="font-medium">
                        {newsDetails.news_title}
                      </TableCell>
                      <TableCell className="capitalize">
                        {newsDetails.category}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(
                            newsDetails.status || "published"
                          )}
                        >
                          {newsDetails.status || "Published"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(
                          newsDetails.published_at || newsDetails.created_at
                        )}
                      </TableCell>
                      <TableCell>
                        {newsDetails.author?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/news/${newsDetails.news_id}`}>
                              View
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/admin/news/${newsDetails.news_id}/edit`}
                            >
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
                      className="text-center py-8 text-muted-foreground"
                    >
                      No news articles found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {/* {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total
                  )}{" "}
                  of {pagination.total} articles
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )} */}
          </>
        </CardContent>
      </Card>
    </div>
  );
};
