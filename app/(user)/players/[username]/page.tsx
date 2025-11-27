"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
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
import { BackButton } from "@/components/BackButton";
import { formatDate, formatWord } from "@/lib/utils";

export default function page() {
  const params = useParams();
  const rawUsername = params.username as string;
  // Decode URL-encoded username (e.g., "VT%20SUPREME" -> "VT SUPREME")
  const username = rawUsername ? decodeURIComponent(rawUsername) : "";

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

  if (pending) return <FullLoader />;

  if (playerData)
    return (
      <div>
        <BackButton />
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <Avatar className="w-24 h-24 border-4 border-primary">
                <AvatarImage
                  src={
                    playerData?.profile_picture || playerData?.esports_picture
                  }
                  className="object-cover"
                  alt={playerData?.username}
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
                      {formatWord(playerData.in_game_role)}
                    </Badge>
                  )}
                  {playerData.management_role && (
                    <Badge className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {formatWord(playerData.management_role)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* Country */}
              <Card>
                <CardContent>
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
                <CardContent>
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
                  <CardContent>
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
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Current Team
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-start gap-4 md:justify-between">
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
                          {formatWord(playerData.management_role)} •{" "}
                          {formatWord(playerData.in_game_role)}
                        </p>
                      </div>
                    </div>
                    <Button className="w-full md:w-auto" asChild>
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
    );
}
