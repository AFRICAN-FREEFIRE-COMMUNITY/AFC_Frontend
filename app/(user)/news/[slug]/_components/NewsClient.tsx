"use client";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FullLoader } from "@/components/Loader";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { RenderDescription } from "@/components/text-editor/RenderDescription";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { notFound } from "next/navigation";
import { DEFAULT_IMAGE } from "@/constants";
import { Separator } from "@/components/ui/separator";
import { IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/AuthModal";

export function NewsClient({
  params,
  initialData,
}: {
  params: Promise<{ slug: string }>;
  initialData?: any;
}) {
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
        toast.error("Failed to sync news data");
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchNewsAndCounts();
  }, [slug, initialData, token]);

  console.log(newsDetails.is_disliked_by_user);

  const handleVote = async (actionType: "like" | "dislike") => {
    if (!token) {
      return toast.error("Please login to vote");
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
            <span>{formatDate(newsDetails.created_at)}</span>
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
        title={`${newsDetails.news_title} Details`}
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

        <RenderDescription json={newsDetails?.content} />

        {newsDetails.category === "tournament" &&
          newsDetails.registrationLink && (
            <Button asChild>
              <a
                href={newsDetails.registrationLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Register for Tournament{" "}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}

        <Separator />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-2">
          <p className="text-muted-foreground text-sm font-medium">
            Was this helpful?
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
