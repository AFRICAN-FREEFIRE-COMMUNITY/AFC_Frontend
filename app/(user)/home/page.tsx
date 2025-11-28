"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Users, Calendar, BarChart2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { HomeBoxes } from "../_components/HomeBoxes";
import { LatestNews } from "../_components/LatestNews";
import { useState } from "react";
import { ComingSoon } from "@/components/ComingSoon";

const teamRankings = [
  { rank: 1, team: "VENT ESPORTS", points: 52, tournamentWins: 2, kills: 446 },
  {
    rank: 2,
    team: "XTREME JUNIORS",
    points: 43,
    tournamentWins: 2,
    kills: 142,
  },
  { rank: 3, team: "OUTLAW NOOBZ", points: 31, tournamentWins: 1, kills: 126 },
  { rank: 4, team: "JUST TRY", points: 30, tournamentWins: 1, kills: 254 },
  { rank: 5, team: "ZENX", points: 30, tournamentWins: 1, kills: 298 },
  { rank: 6, team: "WHYFAM", points: 29, tournamentWins: 1, kills: 186 },
  { rank: 7, team: "NEXT ESP", points: 29, tournamentWins: 1, kills: 163 },
  { rank: 8, team: "NEM JOGOU", points: 21, tournamentWins: 1, kills: 100 },
  { rank: 9, team: "OS JACK'S", points: 21, tournamentWins: 1, kills: 63 },
  { rank: 10, team: "BROTHERHOOD", points: 21, tournamentWins: 1, kills: 78 },
];

// Hard-coded tier data from Second Quarter Tiers
const tierData = [
  { team: "JUST TRY", tier: "Tier 1", points: 94, april: 53, may: 41, june: 0 },
  {
    team: "XTREME JUNIORS",
    tier: "Tier 2",
    points: 69,
    april: 0,
    may: 43,
    june: 26,
  },
  {
    team: "ITEL ESPORTS",
    tier: "Tier 2",
    points: 61,
    april: 7,
    may: 23,
    june: 31,
  },
  {
    team: "OUTLAWS NOOBZ",
    tier: "Tier 2",
    points: 53,
    april: 7,
    may: 43,
    june: 3,
  },
  {
    team: "VENT ESPORTS",
    tier: "Tier 3",
    points: 50,
    april: 14,
    may: 3,
    june: 33,
  },
  {
    team: "FEARLESS N SONS",
    tier: "Tier 3",
    points: 49,
    april: 0,
    may: 43,
    june: 6,
  },
  {
    team: "BROTHERS SA",
    tier: "Tier 3",
    points: 47,
    april: 0,
    may: 41,
    june: 6,
  },
  {
    team: "ALLSTARSNAIJA",
    tier: "Tier 3",
    points: 42,
    april: 6,
    may: 3,
    june: 33,
  },
  {
    team: "VALOR ESPORTS",
    tier: "Tier 3",
    points: 41,
    april: 3,
    may: 3,
    june: 35,
  },
  { team: "NEXT ESP", tier: "Tier 3", points: 38, april: 3, may: 3, june: 32 },
];
// Mock data for shop items
const shopItems = [
  {
    id: 1,
    name: "Golden Dragon AK",
    price: 1000,
    image: "/placeholder.svg?height=100&width=100",
  },
  {
    id: 2,
    name: "Ninja Outfit",
    price: 800,
    image: "/placeholder.svg?height=100&width=100",
  },
  {
    id: 3,
    name: "Legendary Emote: Victory Dance",
    price: 500,
    image: "/placeholder.svg?height=100&width=100",
  },
];

export default function HomePage() {
  return (
    <div>
      <PageHeader
        title="Welcome to AFC"
        description="Your hub for African Freefire community stats and events"
      />

      <HomeBoxes />

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <LatestNews />

        <Card className="relative overflow-hidden">
          <ComingSoon />
          <CardHeader>
            <CardTitle>Featured Shop Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {shopItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center space-x-4 border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    width={50}
                    height={50}
                    className="rounded"
                  />
                  <div className="flex-grow">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.price} Diamonds
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/shop/${item.id}`}>
                      View <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-4 w-full">
              <Link href="/shop">Visit Shop</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rankings and Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="rankings" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="rankings">Current Rankings</TabsTrigger>
              <TabsTrigger value="tiers">Quarterly Tiers</TabsTrigger>
            </TabsList>

            <TabsContent value="rankings">
              <p className="text-sm text-muted-foreground mb-4">
                Team rankings based on overall performance metrics
              </p>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Wins</TableHead>
                      <TableHead>Kills</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamRankings.map((team) => (
                      <TableRow key={team.team}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {team.rank <= 3 && (
                              <Trophy
                                className={`h-4 w-4 ${
                                  team.rank === 1
                                    ? "text-yellow-500"
                                    : team.rank === 2
                                    ? "text-gray-400"
                                    : "text-amber-600"
                                }`}
                              />
                            )}
                            <span className="font-medium">{team.rank}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {team.team}
                        </TableCell>
                        <TableCell>{team.points}</TableCell>
                        <TableCell>{team.tournamentWins}</TableCell>
                        <TableCell>{team.kills}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="tiers">
              <p className="text-sm text-muted-foreground mb-4">
                Second quarter tier standings (April - June)
              </p>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Apr</TableHead>
                      <TableHead>May</TableHead>
                      <TableHead>Jun</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tierData.map((team) => (
                      <TableRow key={team.team}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              team.tier === "Tier 1"
                                ? "border-green-500 text-green-600 dark:text-green-400"
                                : team.tier === "Tier 2"
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-orange-500 text-orange-600 dark:text-orange-400"
                            }
                          >
                            {team.tier}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {team.team}
                        </TableCell>
                        <TableCell className="font-medium">
                          {team.points}
                        </TableCell>
                        <TableCell>{team.april}</TableCell>
                        <TableCell>{team.may}</TableCell>
                        <TableCell>{team.june}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
