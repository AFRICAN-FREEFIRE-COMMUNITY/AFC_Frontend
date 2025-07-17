"use client"

import { useState, useMemo } from "react"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

// Mock data for tournaments and scrims
const leaderboardData = [
  {
    id: 1,
    type: "Tournament",
    name: "Summer Showdown",
    prizepool: 10000,
    date: "2023-07-15",
    stage: "Finals",
    teams: [
      { name: "Team Alpha", rank: 1, kills: 45, points: 95 },
      { name: "Omega Squad", rank: 2, kills: 38, points: 88 },
      { name: "Phoenix Rising", rank: 3, kills: 36, points: 86 },
    ],
    players: [
      { name: "FireKing", team: "Team Alpha", kills: 18, mvps: 2 },
      { name: "ShadowSniper", team: "Omega Squad", kills: 15, mvps: 1 },
      { name: "BlazeMaster", team: "Phoenix Rising", kills: 14, mvps: 1 },
    ],
  },
  {
    id: 2,
    type: "Scrim",
    name: "Weekly Practice Match",
    prizepool: 0,
    date: "2023-07-10",
    stage: "N/A",
    teams: [
      { name: "Team Alpha", rank: 2, kills: 32, points: 72 },
      { name: "Delta Force", rank: 1, kills: 35, points: 75 },
      { name: "Gamma Wolves", rank: 3, kills: 28, points: 68 },
    ],
    players: [
      { name: "FireKing", team: "Team Alpha", kills: 12, mvps: 1 },
      { name: "ThunderBolt", team: "Delta Force", kills: 14, mvps: 1 },
      { name: "NinjaWarrior", team: "Gamma Wolves", kills: 11, mvps: 0 },
    ],
  },
  // Add more mock data here...
]

// Mock data for filter options
const filterOptions = {
  type: ["All", "Tournament", "Scrim"],
  name: ["Summer Showdown", "Weekly Practice Match", "Fall Classic", "Spring Invitational"],
  prizepool: ["All", "0-1000", "1001-5000", "5001-10000", "10001+"],
  date: ["All", "Last Week", "Last Month", "Last 3 Months", "Last 6 Months", "Last Year"],
  stage: ["All", "Qualifiers", "Quarter-Finals", "Semi-Finals", "Finals", "N/A"],
}

export default function LeaderboardsPage() {
  const [filters, setFilters] = useState({
    type: "All",
    name: "All",
    prizepool: "All",
    date: "All",
    stage: "All",
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const filteredData = useMemo(() => {
    return leaderboardData.filter((event) => {
      return (
        (filters.type === "All" || event.type === filters.type) &&
        (filters.name === "All" || event.name === filters.name) &&
        (filters.prizepool === "All" || isPrizepoolInRange(event.prizepool, filters.prizepool)) &&
        (filters.date === "All" || isDateInRange(event.date, filters.date)) &&
        (filters.stage === "All" || event.stage === filters.stage)
      )
    })
  }, [filters])

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Leaderboards</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(filterOptions).map(([key, options]) => (
                <div key={key}>
                  <Label htmlFor={key} className="mb-2 block">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Label>
                  <Select
                    value={filters[key as keyof typeof filters]}
                    onValueChange={(value) => handleFilterChange(key, value)}
                  >
                    <SelectTrigger id={key}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-72">
                        {options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {filteredData.map((event) => (
          <Card key={event.id} className="mb-8">
            <CardHeader>
              <CardTitle>
                {event.name} ({event.type})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Date: {event.date} | Prizepool: ${event.prizepool} | Stage: {event.stage}
              </p>
              <h3 className="text-xl font-semibold mb-2">Team Rankings</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Kills</TableHead>
                    <TableHead>Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {event.teams.map((team) => (
                    <TableRow key={team.name}>
                      <TableCell>{team.rank}</TableCell>
                      <TableCell>{team.name}</TableCell>
                      <TableCell>{team.kills}</TableCell>
                      <TableCell>{team.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <h3 className="text-xl font-semibold mb-2 mt-6">Top Players</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Kills</TableHead>
                    <TableHead>MVPs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {event.players.map((player) => (
                    <TableRow key={player.name}>
                      <TableCell>{player.name}</TableCell>
                      <TableCell>{player.team}</TableCell>
                      <TableCell>{player.kills}</TableCell>
                      <TableCell>{player.mvps}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  )
}

// Helper functions for filtering
function isPrizepoolInRange(prizepool: number, range: string): boolean {
  if (range === "All") return true
  const [min, max] = range.split("-").map(Number)
  return prizepool >= min && (max ? prizepool <= max : true)
}

function isDateInRange(date: string, range: string): boolean {
  if (range === "All") return true
  const eventDate = new Date(date)
  const now = new Date()
  const ranges = {
    "Last Week": 7,
    "Last Month": 30,
    "Last 3 Months": 90,
    "Last 6 Months": 180,
    "Last Year": 365,
  }
  const days = ranges[range as keyof typeof ranges]
  const cutoffDate = new Date(now.setDate(now.getDate() - days))
  return eventDate >= cutoffDate
}
