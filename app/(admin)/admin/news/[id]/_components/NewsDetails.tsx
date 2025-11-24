"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FullLoader } from "@/components/Loader";
import { toast } from "sonner";
import axios from "axios";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { extractTiptapText } from "@/components/text-editor/RenderDescription";

export const NewsDetails = ({ id }: { id: string }) => {
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

  if (pending) return <FullLoader text="details" />;

  if (newsDetails)
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" onClick={() => router.push("/admin/news")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div>
            <Button asChild className="mr-2">
              <Link href={`/admin/news/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{newsDetails.news_title}</CardTitle>
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
          </CardHeader>
          <CardContent>
            <Image
              src={newsDetails.images_url || "/sample-img.png"}
              alt={newsDetails.nes_title}
              width={800}
              height={400}
              className="w-full h-auto rounded-md mb-6"
            />
            {extractTiptapText(newsDetails.content)}
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
          </CardContent>
        </Card>
      </div>
    );
};
