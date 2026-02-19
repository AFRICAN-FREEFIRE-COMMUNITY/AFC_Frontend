"use client";

import { useState, useEffect, useTransition, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Edit } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FullLoader } from "@/components/Loader";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { RenderDescription } from "@/components/text-editor/RenderDescription";
import { DeleteNewsModal } from "../_components/DeleteNewsModal";
import { PageHeader } from "@/components/PageHeader";
import { DEFAULT_IMAGE } from "@/constants";
import { ShareButton } from "@/components/ShareButton";
import { useAuth } from "@/contexts/AuthContext";
import { IconThumbDown, IconThumbUp } from "@tabler/icons-react";

type Params = Promise<{
  slug: string;
}>;

const page = ({ params }: { params: Params }) => {
  const { slug } = use(params);
  const router = useRouter();

  const { token } = useAuth();

  const [pending, startTransition] = useTransition();
  const [newsDetails, setNewsDetails] = useState<any>();

  console.log(newsDetails);

  useEffect(() => {
    if (!slug) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        let currentNews = newsDetails;
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
          { slug },
        );
        currentNews = res.data.news;

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
        toast.error(error.response.data.message);
      }
    });
  }, [slug]);

  if (pending) return <FullLoader />;

  if (newsDetails)
    return (
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
          <PageHeader
            description={
              <>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={newsDetails.author.picture}
                      alt={newsDetails.author}
                    />
                    <AvatarFallback>{newsDetails.author}</AvatarFallback>
                  </Avatar>
                  <span>{newsDetails.author}</span>
                  <span>•</span>
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
              </>
            }
            title={`${newsDetails.news_title} Details`}
            back
          />{" "}
          <div className="flex w-full md:w-auto items-center gap-2">
            <Button className="flex-1 md:flex-auto" asChild>
              <Link href={`/a/news/${slug}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
            <DeleteNewsModal
              newsId={newsDetails.news_id}
              newsTitle={newsDetails.news_title}
              redirectTo="/a/news"
              showLabel
            />
          </div>
        </div>

        <div>
          <Image
            src={newsDetails.images_url || DEFAULT_IMAGE}
            alt={newsDetails.nes_title}
            width={1000}
            height={1000}
            className="aspect-auto size-full object-cover rounded-md mb-6"
          />
          <RenderDescription json={newsDetails?.content} />
          {newsDetails.event && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold">Related Event</h3>
              <Link
                href={`/admin/events/${newsDetails.eventId}`}
                className="text-primary hover:underline"
              >
                {newsDetails.event}
              </Link>
            </div>
          )}
          <ShareButton
            name={newsDetails.title}
            url={`${env.NEXT_PUBLIC_URL}/news/${slug}`}
            text="Share news"
          />
        </div>
      </div>
    );
};
export default page;
