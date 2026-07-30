"use client";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FullLoader } from "@/components/Loader";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
// LocalTime: renders the stored UTC created_at in the VIEWER's own timezone +
// language (components/LocalTime.tsx). Replaces formatDate(), which rendered in
// the server's clock with a hardcoded English ordinal format.
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { RenderDescription } from "@/components/text-editor/RenderDescription";
import { ChevronRight, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
// TournamentTierBadge: shared gold/green/blue tier badge (components/TournamentTierBadge.tsx),
// the same one tournaments/page.tsx uses, so the tier accent here matches the rest of the site.
import { TournamentTierBadge } from "@/components/TournamentTierBadge";
import { notFound } from "next/navigation";
import { DEFAULT_IMAGE } from "@/constants";
import { Separator } from "@/components/ui/separator";
import { IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/AuthModal";
// useTranslations: next-intl hook. Localizes the static chrome on the article
// detail (title suffix, register CTA, "was this helpful", vote toasts) from the
// "news" namespace (messages/en/news.json). The article body (RenderDescription)
// is backend-supplied and arrives already translated, so it is not touched here.
import { useTranslations } from "next-intl";

export function NewsClient({
  params,
  initialData,
}: {
  params: Promise<{ slug: string }>;
  initialData?: any;
}) {
  // Localized static chrome for the article detail page ("news" namespace).
  const t = useTranslations("news");
  const { token } = useAuth();
  const { slug } = use(params);

  const { openAuthModal } = useAuthModal();

  const requireAuth = (action: () => void) => {
    if (!token) {
      openAuthModal({ defaultTab: "login", onSuccess: action });
      return;
    }
    action();
  };

  const [loading, setLoading] = useState(!initialData);
  const [newsDetails, setNewsDetails] = useState<any>(initialData);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    // We always want to fetch fresh counts even if we have initialData
    const fetchNewsAndCounts = async () => {
      try {
        let currentNews = newsDetails;

        // 1. Fetch details if not provided via initialData
        if (!initialData) {
          const res = await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
            { slug },
          );
          currentNews = res.data.news;
        }

        // 2. Fetch fresh Like/Dislike counts
        const targetId = currentNews.id || currentNews.news_id;

        const countRes = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-likes-dislikes-count/`,
          { news_id: targetId, session_token: token },
        );

        setNewsDetails({
          ...currentNews,
          likes_count: countRes.data.likes,
          dislikes_count: countRes.data.dislikes,
          is_liked_by_user: countRes.data.is_liked_by_user,
          is_disliked_by_user: countRes.data.is_disliked_by_user,
        });
      } catch (error: any) {
        console.error("Fetch Error:", error);
        toast.error(t("toast.syncFailed"));
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchNewsAndCounts();
  }, [slug, initialData, token]);

  const handleVote = async (actionType: "like" | "dislike") => {
    if (!token) {
      return toast.error(t("toast.loginToVote"));
    }
    if (isActionLoading) return;

    const isLiked = newsDetails.is_liked_by_user;
    const isDisliked = newsDetails.is_disliked_by_user;
    const targetId = newsDetails.id || newsDetails.news_id;

    let endpoint = "";
    if (actionType === "like") {
      endpoint = isLiked ? "unlike-news" : "like-news";
    } else {
      endpoint = isDisliked ? "undislike-news" : "dislike-news";
    }

    setIsActionLoading(true);

    try {
      // 1. Perform Action
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/${endpoint}/`,
        { news_id: targetId },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // 2. Fetch Fresh Counts
      const countRes = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-likes-dislikes-count/`,
        { news_id: targetId, session_token: token },
      );

      // 3. Update State
      setNewsDetails((prev: any) => ({
        ...prev,
        likes_count: countRes.data.likes,
        dislikes_count: countRes.data.dislikes,
        is_liked_by_user: countRes.data.is_liked_by_user,
        is_disliked_by_user: countRes.data.is_disliked_by_user,
      }));
    } catch (error: any) {
    } finally {
      setIsActionLoading(false);
    }
  };

  if (loading) return <FullLoader />;
  if (!newsDetails) notFound();

  return (
    <div>
      <PageHeader
        description={
          <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
            <LocalTime value={newsDetails.created_at} mode="date" />
            <span>•</span>
            <Badge variant="secondary" className="capitalize">
              {newsDetails.category}
            </Badge>
            <div className="flex items-center gap-3 border-l pl-3 ml-1 border-muted-foreground/20">
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <IconThumbUp size={16} stroke={2.5} />
                <span>{newsDetails.likes_count || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <IconThumbDown size={16} stroke={2.5} />
                <span>{newsDetails.dislikes_count || 0}</span>
              </div>
            </div>
          </div>
        }
        title={t("detail.titleSuffix", { title: newsDetails.news_title })}
        back
      />

      <div className="space-y-6">
        <Image
          src={newsDetails.images_url || DEFAULT_IMAGE}
          alt={newsDetails.news_title}
          width={800}
          height={400}
          className="aspect-video w-full object-cover rounded-md"
        />

        {/* ── Related events (owner 2026-07-15: "on the user facing end they should be able to
            see related events") ──────────────────────────────────────────────────────────────
            Reads newsDetails.related_events, the M2M list get-news-detail now returns
            (afc_auth/views.py get_news_detail -> [{event_id, event_name, slug, tournament_tier,
            end_date}]). Each card deep-links to the public event page at /tournaments/<slug>
            (the same route tournaments/[slug] uses). TournamentTierBadge + LocalTime are the
            shared components the rest of the site uses, so the tier accent + date format match.
            Rendered only when the article actually has related events; nothing else on this page
            changes. */}
        {Array.isArray(newsDetails.related_events) &&
          newsDetails.related_events.length > 0 && (
            <section className="bg-card rounded-md border p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t("relatedEvents.heading")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {newsDetails.related_events.map((ev: any) => (
                  <Link
                    key={ev.event_id}
                    href={`/tournaments/${ev.slug}`}
                    aria-label={t("relatedEvents.viewEvent", {
                      name: ev.event_name,
                    })}
                    className="group flex items-center justify-between gap-3 rounded-md border bg-background p-3 transition-colors hover:border-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {ev.event_name}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <TournamentTierBadge tier={ev.tournament_tier} />
                        {ev.end_date && (
                          <LocalTime value={ev.end_date} mode="date" />
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          )}

        <RenderDescription json={newsDetails?.content} />

        {newsDetails.category === "tournament" &&
          newsDetails.registrationLink && (
            <Button asChild>
              <a
                href={newsDetails.registrationLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("detail.registerForTournament")}{" "}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}

        <Separator />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-2">
          <p className="text-muted-foreground text-sm font-medium">
            {t("detail.wasThisHelpful")}
          </p>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={newsDetails.is_liked_by_user ? "default" : "secondary"}
              onClick={() => requireAuth(() => handleVote("like"))}
              disabled={isActionLoading}
              className={cn("gap-2 transition-all active:scale-95")}
            >
              <IconThumbUp
                size={18}
                className={
                  newsDetails.is_liked_by_user ? "fill-primary-foreground" : ""
                }
              />
              <span className="font-bold">{newsDetails.likes_count ?? 0}</span>
            </Button>

            <Button
              size="sm"
              variant={
                newsDetails.is_disliked_by_user ? "default" : "secondary"
              }
              onClick={() => requireAuth(() => handleVote("dislike"))}
              disabled={isActionLoading}
              className="gap-2 transition-all active:scale-95"
            >
              <IconThumbDown
                size={18}
                className={
                  newsDetails.is_disliked_by_user
                    ? "fill-primary-foreground"
                    : ""
                }
              />
              <span className="font-bold">
                {newsDetails.dislikes_count ?? 0}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
