"use client";
import { Loader } from "@/components/Loader";
import {
  extractTiptapText,
  truncateText,
} from "@/components/text-editor/RenderDescription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_IMAGE } from "@/constants";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export const LatestNews = () => {
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

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`,
        );

        if (res.statusText === "OK") {
          setNews(res.data.news.splice(0, 2));
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        toast.error(error?.response?.data.message);
      }
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest News & Updates</CardTitle>
      </CardHeader>
      <CardContent>
        {pending && <Loader text="Loading news..." />}
        <ul className="space-y-4">
          {!pending &&
            news &&
            news?.map((newsDetails: any) => (
              <Card key={newsDetails.news_id} className="p-0 overflow-hidden">
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
                <CardContent className="pb-6">
                  <Link
                    href={`/news/${newsDetails.slug}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {newsDetails.news_title}
                  </Link>
                  <p className="text-sm mt-2 text-muted-foreground mb-1 line-clamp-4 break-words overflow-hidden">
                    {truncateText(extractTiptapText(newsDetails.content), 400)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(newsDetails.created_at)}
                  </span>
                </CardContent>
              </Card>
            ))}
        </ul>
        <Button asChild className="mt-4 w-full">
          <Link href="/news">View All News</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
