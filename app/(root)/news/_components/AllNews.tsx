"use client";

import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { env } from "@/lib/env";
import axios from "axios";
import { useEffect, useState, useTransition } from "react";
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

  const { user, token } = useAuth();
  const userRole = user?.role;

  //   const [userRole, setUserRole] = useState("moderator"); // This should come from an auth context in a real app
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "general-news", label: "General News" },
    { value: "tournament-updates", label: "Tournament Updates" },
    { value: "banned-updates", label: "Banned Player/Team Updates" },
  ];

  // const filteredNews =
  //   selectedCategory === "all"
  //     ? newsItems
  //     : newsItems.filter((item) => item.category === selectedCategory);

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

  if (pending) return <FullLoader />;

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">News & Updates</h1>
        {userRole === "moderator" ||
          (userRole === "admin" && (
            <Button asChild>
              <Link href="/admin/news/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Post
              </Link>
            </Button>
          ))}
      </div>

      <div className="mb-4">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {news &&
          news?.map((newsDetails: any) => (
            <Card
              key={newsDetails.news_id}
              className="overflow-hidden h-full flex flex-col"
            >
              <div className="relative h-40">
                <Image
                  src={newsDetails.images_url || "/sample-img.png"}
                  alt={newsDetails.news_title}
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {getCategoryLabel(newsDetails.category)}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3 flex-grow flex flex-col">
                <h2 className="text-lg font-bold mb-1 line-clamp-2">
                  {newsDetails.news_title}
                </h2>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mb-2">
                  <Avatar className="h-4 w-4 mr-1">
                    <AvatarImage
                      src={newsDetails.author.avatar}
                      alt={newsDetails.author}
                    />
                    <AvatarFallback>{newsDetails.author[0]}</AvatarFallback>
                  </Avatar>
                  <span>{newsDetails.author}</span>
                  <span>•</span>
                  <span>{formatDate(newsDetails.created_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2 break-words overflow-hidden">
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
    </div>
  );
};
