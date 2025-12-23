"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconTrophy,
  IconUser,
  IconFilter,
  IconCalendar,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { Label } from "@/components/ui/label";

const page = () => {
  // States for filters
  const [activeTab, setActiveTab] = useState("qualifiers");

  return (
    <div className="min-h-screen space-y-8">
      <PageHeader
        title="Leaderboards"
        description={"Track tournament rankings and player performance"}
      />
      {/* <Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Input placeholder="Search type..." />
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="tournament">Tournament</SelectItem>
              <SelectItem value="scrim">Scrim</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Name</Label>
          <Input placeholder="Search name..." />
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
              <SelectItem value="all">All Events</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Prizepool</Label>
          <Input placeholder="Search prizepool..." />
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
              <SelectItem value="all">All Ranges</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      </Card> */}
      <Input placeholder="Search event name..." />

      {/* --- Rankings Section (Ref: image_74b56e.png) --- */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-4 gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Summer Showdown (Tournament)</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
              <span className="flex items-center gap-1">
                <IconCalendar size={14} /> Date: 2023-07-15
              </span>
              <span>Prizepool: $10000</span>
              <span className="text-primary font-medium">Stage: Finals</span>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full md:w-auto"
          >
            <TabsList>
              <TabsTrigger value="qualifiers">Qualifiers</TabsTrigger>
              <TabsTrigger value="finals">Finals</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Team Rankings Table */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-zinc-200">
            <IconTrophy size={18} className="text-yellow-500" />
            Team Rankings
          </h3>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-900/50">
                <TableRow className="border-zinc-800">
                  <TableHead className="w-20">Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Kills</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <RankingRow rank={1} team="Team Alpha" kills={45} points={95} />
                <RankingRow
                  rank={2}
                  team="Omega Squad"
                  kills={38}
                  points={88}
                />
                <RankingRow
                  rank={3}
                  team="Phoenix Rising"
                  kills={36}
                  points={86}
                />
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Top Players Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-zinc-200">
            <IconUser size={18} className="text-blue-500" />
            Top Players
          </h3>
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-900/50">
                <TableRow className="border-zinc-800">
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Kills</TableHead>
                  <TableHead className="text-right">MVPs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <PlayerRow
                  player="FireKing"
                  team="Team Alpha"
                  kills={18}
                  mvps={2}
                />
                <PlayerRow
                  player="ShadowSniper"
                  team="Omega Squad"
                  kills={15}
                  mvps={1}
                />
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-components for cleaner code
const RankingRow = ({ rank, team, kills, points }: any) => (
  <TableRow className="border-zinc-900 hover:bg-zinc-900/40 transition-colors">
    <TableCell className="font-mono text-zinc-500">{rank}</TableCell>
    <TableCell className="font-bold text-white">{team}</TableCell>
    <TableCell>{kills}</TableCell>
    <TableCell className="text-right font-bold text-primary">
      {points}
    </TableCell>
  </TableRow>
);

const PlayerRow = ({ player, team, kills, mvps }: any) => (
  <TableRow className="border-zinc-900 hover:bg-zinc-900/40 transition-colors">
    <TableCell className="font-bold text-white">{player}</TableCell>
    <TableCell className="text-zinc-400">{team}</TableCell>
    <TableCell>{kills}</TableCell>
    <TableCell className="text-right font-mono text-blue-400">{mvps}</TableCell>
  </TableRow>
);

export default page;
