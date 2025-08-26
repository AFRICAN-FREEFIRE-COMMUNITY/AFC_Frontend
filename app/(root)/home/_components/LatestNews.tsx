"use client";
import { Loader } from "@/components/Loader";
import {
  extractTiptapText,
  RenderDescription,
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

const newsItems = [
  {
    id: 1,
    title: "New Tournament Series Announced",
    excerpt:
      "AFC is proud to announce the launch of the 'African Freefire Masters' tournament series, starting next month.",
    date: "2023-07-01",
  },
  {
    id: 2,
    title: "Team Rankings Updated",
    excerpt:
      "The latest team rankings have been released. Check out the Leaderboards to see where your team stands!",
    date: "2023-06-28",
  },
  {
    id: 3,
    title: "Shop Update: New Skins Available",
    excerpt:
      "Exciting new character and weapon skins are now available in the shop. Limited time offer!",
    date: "2023-06-25",
  },
];

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
          setNews(res.data.news);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        console.log(error);
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
                  className="font-semibold hover:text-primary hover:underline"
                >
                  {newsDetails.news_title}
                </Link>
                <p className="text-sm text-muted-foreground mb-1 line-clamp-2 break-words overflow-hidden">
                  {truncateText(extractTiptapText(newsDetails.content), 150)}
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
