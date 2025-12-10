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

type Params = Promise<{
  id: string;
}>;

const page = ({ params }: { params: Params }) => {
  const { id } = use(params);
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [newsDetails, setNewsDetails] = useState<any>();

  useEffect(() => {
    if (!id) return; // Don't run if id is not available yet

    startTransition(async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
          { news_id: decodedId }
        );
        setNewsDetails(res.data.news);
      } catch (error: any) {
        toast.error(error.response.data.message);
      }
    });
  }, [id]);

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
                </div>
              </>
            }
            title={`${newsDetails.news_title} Details`}
            back
          />{" "}
          <div className="flex w-full md:w-auto items-center gap-2">
            <Button className="flex-1 md:flex-auto" asChild>
              <Link href={`/a/news/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
            <DeleteNewsModal
              newsId={id}
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
            width={800}
            height={400}
            className="w-full h-auto rounded-md mb-6"
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
        </div>
      </div>
    );
};
export default page;
