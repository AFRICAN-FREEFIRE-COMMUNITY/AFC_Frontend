"use client";

import { FullLoader } from "@/components/Loader";
import { PageHeader } from "@/components/PageHeader";
import {
  extractTiptapText,
  truncateText,
} from "@/components/text-editor/RenderDescription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_IMAGE } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { IconCalendar, IconCirclePlus } from "@tabler/icons-react";
import axios from "axios";
import { ExternalLink, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

const page = () => {
  const [pending, startTransition] = useTransition();
  const [news, setNews] = useState<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const { user } = useAuth();
  const userRole = user?.role;

  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "general", label: "General News" },
    { value: "tournament", label: "Tournament Updates" },
    { value: "bans", label: "Banned Player/Team Updates" },
  ];

  // Filter and search news
  const filteredNews = useMemo(() => {
    if (!news) return [];

    let filtered = news;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (item: any) => item.category === selectedCategory,
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
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter((item: any) => {
        const itemDate = new Date(item.created_at);
        return itemDate.toDateString() === filterDate.toDateString();
      });
    }

    return filtered;
  }, [news, selectedCategory, searchQuery, dateFilter]);

  const getCategoryLabel = (category: string) => {
    return categories.find((c) => c.value === category)?.label || category;
  };

  useEffect(() => {
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
  }, []);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setSelectedCategory("all");
  };

  if (pending) return <FullLoader />;

  return (
    <div>
      <div className="flex flex-col md:flex-row items-start justify-start md:justify-between md:items-center mb-6">
        <PageHeader title="News & Updates" />
        {(userRole === "moderator" || userRole === "admin") && (
          <Button className="w-full md:w-auto" asChild>
            <Link href="/a/news/create">
              <IconCirclePlus className="mr-2 h-4 w-4" />
              Create New Post
            </Link>
          </Button>
        )}
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
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full ">
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
        </div>
      </div>

      {/* Results */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No articles found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || dateFilter || selectedCategory !== "all"
                ? "Try adjusting your search terms or filters"
                : "No articles available at the moment"}
            </p>
            {(searchQuery || dateFilter || selectedCategory !== "all") && (
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredNews.map((newsDetails: any) => (
            <Card
              key={newsDetails.news_id}
              className="overflow-hidden h-full bg-transparent gap-0 p-0 flex flex-col hover:shadow-lg transition-shadow"
            >
              <Link href={`/news/${newsDetails.slug}`} className="relative">
                <Image
                  src={newsDetails.images_url || DEFAULT_IMAGE}
                  alt={newsDetails.news_title}
                  width={1000}
                  height={1000}
                  className="object-cover size-full aspect-video"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {getCategoryLabel(newsDetails.category)}
                  </Badge>
                </div>
              </Link>
              <CardContent className="flex-grow py-4 flex flex-col">
                <Link
                  href={`/news/${newsDetails.slug}`}
                  className="text-lg font-medium mb-2 line-clamp-2 hover:underline hover:text-primary"
                >
                  {newsDetails.news_title}
                </Link>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-3">
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={newsDetails.author.avatar}
                      alt={newsDetails.author}
                    />
                    <AvatarFallback className="text-xs">
                      {newsDetails.author[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span>{newsDetails.author}</span>
                  <span>•</span>
                  <span>{formatDate(newsDetails.created_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3 break-words overflow-hidden flex-grow">
                  {truncateText(extractTiptapText(newsDetails.content), 150)}
                </p>
                <div className="mt-auto flex space-x-2">
                  <Button className="w-full" asChild>
                    <Link href={`/news/${newsDetails.slug}`}>Read More</Link>
                  </Button>
                  {newsDetails.category === "tournament" &&
                    newsDetails.registrationLink && (
                      <Button size="sm" asChild variant="outline">
                        <a
                          href={newsDetails.registrationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Register <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
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
