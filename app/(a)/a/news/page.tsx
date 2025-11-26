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
import { FullLoader } from "@/components/Loader";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

const page = () => {
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
      <PageHeader title="News & Announcements Management" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
        <div className="flex w-full md:w-auto flex-col md:flex-row items-start md:items-center gap-2">
          <Input
            placeholder="Search news..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:w-40">
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
            <SelectTrigger className="w-full md:w-40">
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
        <Button className="w-full md:w-auto" asChild>
          <Link href="/a/news/create">Create New</Link>
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
                      <TableCell>{newsDetails.author || "Unknown"}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/a/news/${newsDetails.news_id}`}>
                              View
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/a/news/${newsDetails.news_id}/edit`}>
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
          </>
        </CardContent>
      </Card>
    </div>
  );
};

export default page;
