"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { toast } from "sonner";
import { FullLoader } from "@/components/Loader";
import {
  CalendarDays,
  Mail,
  MapPin,
  Shield,
  Swords,
  Users,
} from "lucide-react";

export default function PlayerProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [playerData, setPlayerData] = useState<any>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!username) return;

    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-player-details/`,
          { player_ign: username }
        );
        setPlayerData(response.data.player);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to load player details"
        );
      }
    });
  }, [username]);

  if (pending)
    return (
      <Layout>
        <FullLoader text="player profile..." />
      </Layout>
    );
  if (!playerData)
    return (
      <Layout>
        <div className="text-center py-8">Player not found</div>
      </Layout>
    );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatRole = (role: string) => {
    if (!role) return "Member";
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const router = useRouter();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="outline"
          className="mb-2"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <Avatar className="w-24 h-24 border-4 border-primary">
                <AvatarImage
                  src={playerData.profile_picture || playerData.esports_picture}
                  alt={playerData.username}
                />
                <AvatarFallback className="text-2xl">
                  {playerData.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-3xl mb-1">
                  {playerData.username}
                </CardTitle>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {playerData.email}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {playerData.in_game_role && (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Swords className="h-3 w-3" />
                      {formatRole(playerData.in_game_role)}
                    </Badge>
                  )}
                  {playerData.management_role && (
                    <Badge className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {formatRole(playerData.management_role)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Country */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Country</p>
                      <p className="font-semibold text-lg">
                        {playerData.country}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* UID */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">UID</p>
                      <p className="font-semibold text-lg">{playerData.uid}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Join Date */}
              {playerData.join_date && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <CalendarDays className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Joined Team
                        </p>
                        <p className="font-semibold text-lg">
                          {formatDate(playerData.join_date)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Team Information */}
            {playerData.team_name && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Current Team
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage
                          src={playerData.team_logo}
                          alt={playerData.team_name}
                        />
                        <AvatarFallback>
                          {playerData.team_name?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-lg">
                          {playerData.team_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatRole(playerData.management_role)} •{" "}
                          {formatRole(playerData.in_game_role)}
                        </p>
                      </div>
                    </div>
                    <Button asChild>
                      <Link href={`/teams/${playerData.team_name}`}>
                        View Team
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
