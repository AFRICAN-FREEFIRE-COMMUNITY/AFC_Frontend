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
import { quarterlyTiers, teamRankings } from "@/constants";

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
      <div className="grid gap-2 md:grid-cols-2 mb-4">
        <div>
          <LatestNews />
        </div>

        <div>
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
              <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
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
                Third quarter tier standings (July - September)
              </p>
              <div className="overflow-x-auto rounded-md border max-h-96 overflow-y-auto">
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
                    {quarterlyTiers.map((team) => (
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
                        <TableCell>{team.july}</TableCell>
                        <TableCell>{team.august}</TableCell>
                        <TableCell>{team.september}</TableCell>
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
