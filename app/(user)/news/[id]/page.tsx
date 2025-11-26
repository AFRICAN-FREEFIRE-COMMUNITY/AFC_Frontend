"use client";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { FullLoader } from "@/components/Loader";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { RenderDescription } from "@/components/text-editor/RenderDescription";
import { ExternalLink } from "lucide-react";

type Params = Promise<{
  id: string;
}>;

export default function Page({ params }: { params: Params }) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [newsDetails, setNewsDetails] = useState<any>(null);

  useEffect(() => {
    if (!id) return;

    const fetchNews = async () => {
      try {
        const decodedId = decodeURIComponent(id);
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/get-news-detail/`,
          { news_id: decodedId }
        );
        setNewsDetails(res.data.news);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Failed to load news");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [id]);

  if (loading) return <FullLoader text="details" />;

  if (!newsDetails) {
    return (
      <div className="">
        <BackButton />
        <p className="text-center text-muted-foreground">News not found</p>
      </div>
    );
  }

  return (
    <div className="">
        <BackButton />
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{newsDetails.news_title}</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={newsDetails.author}
                  alt={newsDetails.author}
                />
                <AvatarFallback>{newsDetails.author[0]}</AvatarFallback>
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
              alt={newsDetails.news_title}
              width={800}
              height={400}
              className="w-full h-auto rounded-md mb-6"
            />
            {/* <div
              className="prose max-w-none mb-6"
              dangerouslySetInnerHTML={{ __html: newsDetails.content }}
            /> */}
            {/* {extractTiptapText(newsDetails.content)} */}
            <RenderDescription json={newsDetails?.content} />
            {newsDetails.category === "tournament" && (
              <Card className="my-6">
                <CardHeader>
                  <CardTitle>Tournament Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="font-semibold">Tournament Name</dt>
                      <dd>{newsDetails.tournamentName}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Format</dt>
                      <dd>{newsDetails.format}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Prize Pool</dt>
                      <dd>{newsDetails.prizePool}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Location</dt>
                      <dd>{newsDetails.location}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            )}
            {newsDetails.category === "tournament" &&
              newsDetails.registrationLink && (
                <Button asChild className="mt-4">
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
          </CardContent>
        </Card>
      </div>
    );
}
