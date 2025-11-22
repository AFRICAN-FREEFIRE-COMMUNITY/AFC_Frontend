"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function RankingsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("July");
  const [selectedYear, setSelectedYear] = useState<string>("2023");
  const [selectedEntityType, setSelectedEntityType] = useState<
    "players" | "teams"
  >("players");

  // Mock data for rankings and tiers
  const playerRankings = [
    { rank: 1, name: "FireKing", team: "Team Alpha", points: 500 },
    { rank: 2, name: "ShadowSniper", team: "Omega Squad", points: 480 },
    { rank: 3, name: "BlazeMaster", team: "Phoenix Rising", points: 460 },
    { rank: 4, name: "ThunderBolt", team: "Gamma Force", points: 440 },
    { rank: 5, name: "NinjaWarrior", team: "Delta Strikers", points: 420 },
  ];

  const teamRankings = [
    { rank: 1, name: "Team Alpha", points: 1000 },
    { rank: 2, name: "Omega Squad", points: 950 },
    { rank: 3, name: "Phoenix Rising", points: 900 },
    { rank: 4, name: "Gamma Force", points: 850 },
    { rank: 5, name: "Delta Strikers", points: 800 },
  ];

  const teamTiers = [
    { name: "Team Alpha", tier: 1 },
    { name: "Omega Squad", tier: 1 },
    { name: "Phoenix Rising", tier: 2 },
    { name: "Gamma Force", tier: 2 },
    { name: "Delta Strikers", tier: 3 },
  ];

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const years = ["2023", "2022", "2021"];

  const playerRankingCriteria = [
    {
      name: "Tournament Kills",
      description:
        "Points based on the number of kills in official tournaments",
      calculation:
        "Points are awarded based on kill ranges. For example: 0-100 kills: 1 point, 101-300 kills: 3 points, 301-500 kills: 5 points, etc.",
    },
    {
      name: "MVPs",
      description: "5 points for each MVP award",
      calculation: "Total MVPs * 5",
    },
    {
      name: "Finals Appearances",
      description: "3 points for each finals appearance",
      calculation: "Total Finals Appearances * 3",
    },
    {
      name: "Team Wins",
      description: "20 points for each team win",
      calculation: "Total Team Wins * 20",
    },
    {
      name: "Scrim Kills",
      description: "Points based on the number of kills in scrims",
      calculation:
        "Similar to Tournament Kills, but with lower point values. For example: 0-100 kills: 0.5 points, 101-300 kills: 1.5 points, etc.",
    },
    {
      name: "Scrim Wins",
      description: "0.5 points for each scrim win",
      calculation: "Total Scrim Wins * 0.5",
    },
  ];

  const teamRankingCriteria = [
    {
      name: "Tournament Wins",
      description: "20 points for each tournament win",
      calculation: "Total Tournament Wins * 20",
    },
    {
      name: "Money Earned",
      description: "Points based on total prize money earned",
      calculation:
        "Points are awarded based on money ranges. For example: $0-$100,000: 5 points, $101,000-$300,000: 10 points, $301,000-$500,000: 15 points, etc.",
    },
    {
      name: "Tournament Kills",
      description: "Points based on total team kills in tournaments",
      calculation:
        "Similar to individual Tournament Kills, but for the entire team. Points are awarded based on kill ranges.",
    },
    {
      name: "Placements",
      description: "Points based on tournament placements",
      calculation:
        "1st place: 0.5 points, 2nd place: 0.4 points, 3rd place: 0.3 points, 4th-6th place: 0.2 points, 7th-12th place: 0.1 points",
    },
    {
      name: "Finals Appearances",
      description: "5 points for each finals appearance",
      calculation: "Total Finals Appearances * 5",
    },
    {
      name: "Social Media Metrics",
      description: "Points based on social media following and engagement",
      calculation:
        "Points are awarded based on follower counts and engagement rates across various platforms (Instagram, TikTok, etc.)",
    },
    {
      name: "Scrim Performance",
      description: "Points based on scrim wins, kills, and placements",
      calculation:
        "Scrim wins: 0.5 points each, Scrim kills and placements: Similar to tournament calculations but with lower point values",
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Rankings and Tiers</h1>

        <div className="flex items-center space-x-4 mb-6">
          <Select
            value={selectedEntityType}
            onValueChange={(value: "players" | "teams") =>
              setSelectedEntityType(value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="players">Players</SelectItem>
              <SelectItem value="teams">Teams</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Top Players/Teams Showcase */}
        {selectedEntityType === "players" && (
          <div className="grid grid-cols-3 gap-6 mb-8">
            <Card className="col-start-2">
              <CardHeader>
                <CardTitle className="text-center">
                  Top Player of the Month
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <h3 className="text-2xl font-bold mb-2">FireKing</h3>
                <p className="text-muted-foreground">Team Alpha</p>
                <p className="text-xl font-semibold mt-2">500 Points</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="rankings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rankings">Rankings</TabsTrigger>
            {selectedEntityType === "teams" && (
              <TabsTrigger value="tiers">Tiers</TabsTrigger>
            )}
            <TabsTrigger value="criteria">Criteria</TabsTrigger>
          </TabsList>

          <TabsContent value="rankings">
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedEntityType === "players"
                    ? "Player Rankings"
                    : "Team Rankings"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Name</TableHead>
                        {selectedEntityType === "players" && (
                          <TableHead>Team</TableHead>
                        )}
                        <TableHead>Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedEntityType === "players"
                        ? playerRankings
                        : teamRankings
                      ).map((entity) => (
                        <TableRow key={entity.rank}>
                          <TableCell>{entity.rank}</TableCell>
                          <TableCell>{entity.name}</TableCell>
                          {selectedEntityType === "players" && (
                            <TableCell>{(entity as any).team}</TableCell>
                          )}
                          <TableCell>{entity.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {selectedEntityType === "teams" && (
            <TabsContent value="tiers">
              <Card>
                <CardHeader>
                  <CardTitle>Team Tiers</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team</TableHead>
                          <TableHead>Tier</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamTiers.map((team, index) => (
                          <TableRow key={index}>
                            <TableCell>{team.name}</TableCell>
                            <TableCell>{team.tier}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="criteria">
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedEntityType === "players"
                    ? "Player Ranking Criteria"
                    : "Team Ranking and Tiering Criteria"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {selectedEntityType === "players" ? (
                    <AccordionItem value="player-criteria">
                      <AccordionTrigger>
                        Player Ranking Criteria
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-6 space-y-2">
                          {playerRankingCriteria.map((criterion, index) => (
                            <li key={index}>
                              <span>
                                {criterion.name}: {criterion.description}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ) : (
                    <>
                      <AccordionItem value="team-ranking-criteria">
                        <AccordionTrigger>
                          Team Ranking Criteria
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="list-disc pl-6 space-y-2">
                            {teamRankingCriteria.map((criterion, index) => (
                              <li key={index}>
                                <span>
                                  {criterion.name}: {criterion.description}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="team-tier-criteria">
                        <AccordionTrigger>Team Tier Criteria</AccordionTrigger>
                        <AccordionContent>
                          <p>
                            Teams are assigned to tiers based on their total
                            ranking points:
                          </p>
                          <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>
                              <strong>Tier 1:</strong> 70 points or more
                            </li>
                            <li>
                              <strong>Tier 2:</strong> 50-69 points
                            </li>
                            <li>
                              <strong>Tier 3:</strong> Below 50 points
                            </li>
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </>
                  )}
                </Accordion>
                <div className="mt-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">See Detailed Criteria</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          Detailed Ranking and Tiering Criteria
                        </DialogTitle>
                        <DialogDescription>
                          This document provides a comprehensive explanation of
                          how players and teams are ranked and tiered in the AFC
                          system.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="mt-4 space-y-6">
                        <section>
                          <h3 className="text-lg font-semibold mb-2">
                            Player Ranking Criteria
                          </h3>
                          {playerRankingCriteria.map((criterion, index) => (
                            <div key={index} className="mb-4">
                              <h4 className="font-medium">{criterion.name}</h4>
                              <p>{criterion.description}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Calculation: {criterion.calculation}
                              </p>
                            </div>
                          ))}
                        </section>
                        <section>
                          <h3 className="text-lg font-semibold mb-2">
                            Team Ranking Criteria
                          </h3>
                          {teamRankingCriteria.map((criterion, index) => (
                            <div key={index} className="mb-4">
                              <h4 className="font-medium">{criterion.name}</h4>
                              <p>{criterion.description}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Calculation: {criterion.calculation}
                              </p>
                            </div>
                          ))}
                        </section>
                        <section>
                          <h3 className="text-lg font-semibold mb-2">
                            Team Tier Criteria
                          </h3>
                          <p>
                            Teams are assigned to tiers based on their total
                            ranking points:
                          </p>
                          <ul className="list-disc pl-6 space-y-2 mt-2">
                            <li>
                              <strong>Tier 1:</strong> 70 points or more
                            </li>
                            <li>
                              <strong>Tier 2:</strong> 50-69 points
                            </li>
                            <li>
                              <strong>Tier 3:</strong> Below 50 points
                            </li>
                          </ul>
                        </section>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
