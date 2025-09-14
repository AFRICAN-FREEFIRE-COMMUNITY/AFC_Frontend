// Updated AllNews component with search functionality
"use client";

import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, Search, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import { env } from "@/lib/env";
import axios from "axios";
import { useEffect, useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import { FullLoader } from "@/components/Loader";
import {
  extractTiptapText,
  RenderDescription,
  truncateText,
} from "@/components/text-editor/RenderDescription";

export const AllNews = () => {
  const [pending, startTransition] = useTransition();
  const [news, setNews] = useState<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const { user, token } = useAuth();
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
        (item: any) => item.category === selectedCategory
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

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setSelectedCategory("all");
  };

  if (pending) return <FullLoader />;

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">News & Updates</h1>
        {(userRole === "moderator" || userRole === "admin") && (
          <Button asChild>
            <Link href="/admin/news/create">
              <PlusCircle className="mr-2 h-4 w-4" />
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
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
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
            <SelectTrigger className="w-[200px]">
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

          <div className="flex items-center gap-4">
            {/* Active Filters */}
            {(searchQuery || dateFilter || selectedCategory !== "all") && (
              <div className="flex items-center gap-2">
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
                {selectedCategory !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryLabel(selectedCategory)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNews.map((newsDetails: any) => (
            <Card
              key={newsDetails.news_id}
              className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow"
            >
              <div className="relative h-48">
                <Image
                  src={newsDetails.images_url || "/sample-img.png"}
                  alt={newsDetails.news_title}
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {getCategoryLabel(newsDetails.category)}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4 flex-grow flex flex-col">
                <h2 className="text-lg font-bold mb-2 line-clamp-2">
                  {newsDetails.news_title}
                </h2>
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
                  <Button size="sm" asChild>
                    <Link href={`/news/${newsDetails.news_id}`}>Read More</Link>
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
