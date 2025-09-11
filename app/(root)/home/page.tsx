"use client";

import { useState } from "react";
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
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Trophy, Users, Calendar, BarChart2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { HomeBoxes } from "./_components/HomeBoxes";
import { LatestNews } from "./_components/LatestNews";

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
  const [activeTab, setActiveTab] = useState("rankings");

  return (
    <Layout>
      <div className="container mx-auto px-4">
        <PageHeader
          title="Welcome to AFC DATABASE"
          description="Your hub for African Freefire community stats and events"
        />

        <HomeBoxes />

        <div className="grid gap-8 md:grid-cols-2 mb-8">
          <LatestNews />

          <Card className="relative overflow-hidden">
            {/* Blur Overlay */}
            <div className="absolute inset-0 backdrop-blur-sm bg-background/50 z-10 flex items-center justify-center">
              <span className="text-sm font-medium text-muted-foreground">
                Coming Soon
              </span>
            </div>
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
        <Card className="rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Rankings and Tiers</h2>
          </div>
          <div className="p-6">
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg mb-6">
              <button
                onClick={() => setActiveTab("rankings")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "rankings" ? "bg-background" : "text-white"
                }`}
              >
                Current Rankings
              </button>
              <button
                onClick={() => setActiveTab("tiers")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "tiers" ? "bg-background" : "text-white"
                }`}
              >
                Quarterly Tiers
              </button>
            </div>

            {/* Rankings Tab */}
            {activeTab === "rankings" && (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-white">
                    Team rankings based on overall performance metrics
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-white font-medium">
                        <th className="text-left py-3 px-4">Rank</th>
                        <th className="text-left py-3 px-4">Team</th>
                        <th className="text-left py-3 px-4">Overall Points</th>
                        <th className="text-left py-3 px-4">Tournament Wins</th>
                        <th className="text-left py-3 px-4">Total Kills</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamRankings.map((team) => (
                        <tr
                          key={team.team}
                          className="border-b border-muted hover:bg-muted"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              {team.rank <= 3 && (
                                <Trophy
                                  className={`h-4 w-4 mr-2 ${
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
                          </td>
                          <td className="py-3 px-4 font-medium text-white">
                            {team.team}
                          </td>
                          <td className="py-3 px-4">{team.points}</td>
                          <td className="py-3 px-4">{team.tournamentWins}</td>
                          <td className="py-3 px-4">{team.kills}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tiers Tab */}
            {activeTab === "tiers" && (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-white">
                    Second quarter tier standings (April - June)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-muted font-medium text-white">
                        <th className="text-left py-3 px-4">Tier</th>
                        <th className="text-left py-3 px-4">Team</th>
                        <th className="text-left py-3 px-4">Total Points</th>
                        <th className="text-left py-3 px-4">Apr</th>
                        <th className="text-left py-3 px-4">May</th>
                        <th className="text-left py-3 px-4">Jun</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierData.map((team, index) => (
                        <tr
                          key={team.team}
                          className="border-b border-muted hover:bg-muted"
                        >
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                team.tier === "Tier 1"
                                  ? "bg-green-100 text-green-800"
                                  : team.tier === "Tier 2"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {team.tier}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-white">
                            {team.team}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {team.points}
                          </td>
                          <td className="py-3 px-4">{team.april}</td>
                          <td className="py-3 px-4">{team.may}</td>
                          <td className="py-3 px-4">{team.june}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
