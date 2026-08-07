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
// Renders the article's created_at in the VIEWER's own timezone + language
// (replaces formatDate(), which built the string in the machine's local clock).
import { LocalTime } from "@/components/LocalTime";
import axios from "axios";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
// Live refresh (owner 2026-07-02): site-wide heartbeat - re-pulls the two latest
// articles so the home teaser stays current without a manual reload.
import { useLiveTick } from "@/hooks/useLiveTick";

export const LatestNews = () => {
  // Strings for the home-page "Latest News" teaser (namespace == messages/en/home.json).
  const t = useTranslations("home");
  const [pending, startTransition] = useTransition();
  const [news, setNews] = useState<any>();
  // Live refresh (owner 2026-07-02): shared tick re-runs the load below.
  const tick = useLiveTick();

  const categories = [
    { value: "all", label: t("latestNews.categories.all") },
    { value: "general", label: t("latestNews.categories.general") },
    { value: "tournament", label: t("latestNews.categories.tournament") },
    { value: "education", label: t("latestNews.categories.education") },
    { value: "bans", label: t("latestNews.categories.bans") },
  ];

  const getCategoryLabel = (category: string) => {
    return categories.find((c) => c.value === category)?.label || category;
  };

  useEffect(() => {
    // Live refresh (owner 2026-07-02): tick > 0 = a background re-pull. It runs
    // OUTSIDE the transition so the <Loader/> (gated on `pending`) never flashes,
    // and errors stay silent instead of re-toasting every tick.
    const background = tick > 0;
    const load = async () => {
      try {
        const res = await axios(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-all-news/`,
        );

        if (res.statusText === "OK") {
          setNews(res.data.news.splice(0, 2));
        } else if (!background) {
          toast.error(t("latestNews.toast.error"));
        }
      } catch (error: any) {
        if (!background) toast.error(error?.response?.data.message);
      }
    };
    if (background) {
      load();
    } else {
      startTransition(load);
    }
  }, [tick]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("latestNews.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {pending && <Loader text={t("latestNews.loading")} />}
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
                    {/* No `capitalize`: getCategoryLabel already returns a fully-cased translated
                        phrase, and CSS capitalize would title-case every word of it (French
                        "Mises à jour éducatives" -> "Mises À Jour Éducatives"). */}
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryLabel(newsDetails.category)}
                    </Badge>
                  </div>
                </Link>
                <CardContent className="pb-6">
                  <Link
                    href={`/news/${newsDetails.slug}`}
                    className="font-medium hover:text-primary hover:underline line-clamp-2"
                  >
                    {newsDetails.news_title}
                  </Link>
                  <p className="text-sm mt-2 text-muted-foreground mb-1 line-clamp-2 break-words overflow-hidden">
                    {truncateText(extractTiptapText(newsDetails.content), 400)}
                  </p>
                  <LocalTime
                    value={newsDetails.created_at}
                    mode="date"
                    className="text-xs text-muted-foreground"
                  />
                </CardContent>
              </Card>
            ))}
        </ul>
        <Button asChild className="mt-4 w-full">
          <Link href="/news">{t("latestNews.viewAll")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
