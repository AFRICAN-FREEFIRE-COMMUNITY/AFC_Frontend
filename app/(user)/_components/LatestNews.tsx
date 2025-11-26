"use client";
import { Loader } from "@/components/Loader";
import {
  extractTiptapText,
  truncateText,
} from "@/components/text-editor/RenderDescription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import axios from "axios";
import Link from "next/link";
import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export const LatestNews = () => {
  const [pending, startTransition] = useTransition();
  const [news, setNews] = useState<any>();

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`
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
              <li
                key={newsDetails.news_id}
                className="border-b pb-4 last:border-b-0 last:pb-0"
              >
                <Link
                  href={`/news/${newsDetails.news_id}`}
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
              </li>
            ))}
        </ul>
        <Button asChild className="mt-4 w-full">
          <Link href="/news">View All News</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
