"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { FullLoader } from "@/components/Loader";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DeleteNewsModal } from "./_components/DeleteNewsModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  extractTiptapText,
  truncateText,
} from "@/components/text-editor/RenderDescription";
import {
  IconCalendar,
  IconCirclePlus,
  IconEye,
  IconPencil,
  IconShare,
} from "@tabler/icons-react";
import { DEFAULT_IMAGE } from "@/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const page = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [pending, startTransition] = useTransition();
  const [news, setNews] = useState<any>();

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "general", label: "General News" },
    { value: "tournament", label: "Tournament Updates" },
    { value: "bans", label: "Banned Player/Team Updates" },
  ];

  const getCategoryLabel = (category: string) => {
    return categories.find((c) => c.value === category)?.label || category;
  };

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

  const filteredNews = useMemo(() => {
    if (!news) return [];

    let filtered = news;

    // Filter by category
    if (filterCategory !== "all") {
      filtered = filtered.filter(
        (item: any) => item.category === filterCategory,
      );
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(
        (item: any) =>
          (item.status || "published").toLowerCase() ===
          filterStatus.toLowerCase(),
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const title = item.news_title?.toLowerCase() || "";
        const content = extractTiptapText(item.content)?.toLowerCase() || "";
        const author = item.author?.toLowerCase() || "";

        return (
          title.includes(query) ||
          content.includes(query) ||
          author.includes(query)
        );
      });
    }

    // Filter by date
    if (dateFilter) {
      const filterDateObj = new Date(dateFilter);
      filtered = filtered.filter((item: any) => {
        const itemDate = new Date(item.created_at);
        return itemDate.toDateString() === filterDateObj.toDateString();
      });
    }

    return filtered;
  }, [news, filterCategory, filterStatus, searchQuery, dateFilter]);

  const fetchNews = () => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`,
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
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setFilterCategory("all");
    setFilterStatus("all");
  };

  const handleCopyLink = async (slug: string) => {
    try {
      const url = `${env.NEXT_PUBLIC_URL}/news/${slug}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  if (pending) return <FullLoader />;

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start justify-start md:justify-between md:items-center mb-6">
        <PageHeader title="News Management" />
        <Button className="w-full md:w-auto" asChild>
          <Link href="/a/news/create">
            <IconCirclePlus className="mr-2 h-4 w-4" />
            Create New
          </Link>
        </Button>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search news by title, content, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/50 backdrop-blur-sm"
            />
          </div>
          <div className="flex-shrink-0">
            <div className="relative">
              <IconCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 w-full md:w-auto bg-background/50 backdrop-blur-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[150px]">
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

          <div className="flex items-center gap-4 flex-wrap">
            {/* Active Filters */}
            {(searchQuery ||
              dateFilter ||
              filterCategory !== "all" ||
              filterStatus !== "all") && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs">
                    Search: "{searchQuery}"
                  </Badge>
                )}
                {dateFilter && (
                  <Badge variant="secondary" className="text-xs">
                    Date: {new Date(dateFilter).toLocaleDateString()}
                  </Badge>
                )}
                {filterCategory !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryLabel(filterCategory)}
                  </Badge>
                )}
                {filterStatus !== "all" && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {filterStatus}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 text-xs"
                >
                  Clear all
                </Button>
              </div>
            )}

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredNews.length} of {news?.length || 0} articles
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No articles found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ||
              dateFilter ||
              filterCategory !== "all" ||
              filterStatus !== "all"
                ? "Try adjusting your search terms or filters"
                : "No articles available at the moment"}
            </p>
            {(searchQuery ||
              dateFilter ||
              filterCategory !== "all" ||
              filterStatus !== "all") && (
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
          {filteredNews.map((newsDetails: any) => (
            <Card
              key={newsDetails.news_id}
              className="overflow-hidden h-full bg-transparent gap-0 p-0 flex flex-col hover:shadow-lg transition-shadow"
            >
              <Link href={`/a/news/${newsDetails.slug}`} className="relative">
                <Image
                  src={newsDetails.images_url || DEFAULT_IMAGE}
                  alt={newsDetails.news_title}
                  width={1000}
                  height={1000}
                  className="object-cover aspect-video size-full"
                />
                <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-3">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {getCategoryLabel(newsDetails.category)}
                  </Badge>
                  <Badge
                    variant={getStatusBadgeVariant(
                      newsDetails.status || "published",
                    )}
                    className="text-xs capitalize"
                  >
                    {newsDetails.status || "Published"}
                  </Badge>
                </div>
              </Link>
              <CardContent className="flex-grow py-4 flex flex-col">
                <Link
                  href={`/a/news/${newsDetails.slug}`}
                  className="text-base font-medium mb-2 line-clamp-2 hover:underline hover:text-primary"
                >
                  {newsDetails.news_title}
                </Link>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-3">
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={newsDetails.author?.avatar}
                      alt={newsDetails.author}
                    />
                    <AvatarFallback className="text-xs">
                      {newsDetails.author?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span>{newsDetails.author || "Unknown"}</span>
                  <span>•</span>
                  <span>
                    {formatDate(
                      newsDetails.published_at || newsDetails.created_at,
                    )}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3 break-words overflow-hidden flex-grow">
                  {truncateText(extractTiptapText(newsDetails.content), 150)}
                </p>
                <div className="mt-auto flex space-x-2">
                  <Button className="flex-auto" variant="outline" asChild>
                    <Link href={`/a/news/${newsDetails.slug}`}>
                      <IconEye />
                      View
                    </Link>
                  </Button>
                  <Button className="flex-auto" variant="outline" asChild>
                    <Link href={`/a/news/${newsDetails.slug}/edit`}>
                      <IconPencil />
                      Edit
                    </Link>
                  </Button>

                  <DeleteNewsModal
                    isIcon={true}
                    newsId={newsDetails.news_id}
                    newsTitle={newsDetails.news_title}
                    onSuccess={fetchNews}
                  />

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="icon"
                          variant="secondary"
                          onClick={() => handleCopyLink(newsDetails.slug)}
                        >
                          <IconShare />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy link</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default page;
