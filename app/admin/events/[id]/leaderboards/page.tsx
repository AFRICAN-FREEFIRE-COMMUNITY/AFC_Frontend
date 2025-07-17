"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Updated mock function to fetch tournament leaderboards with more detailed data
const fetchTournamentLeaderboards = async (id) => {
  // In a real app, this would be an API call
  return {
    id,
    name: "Summer Showdown",
    format: "Battle Royale",
    stages: [
      {
        name: "Qualifiers",
        groups: [
          {
            name: "Group A",
            maps: [
              {
                name: "Bermuda",
                teamStats: [
                  {
                    team: "Team Alpha",
                    totalKills: 25,
                    placementPoints: 50,
                    totalPoints: 75,
                    players: [
                      { name: "Player1", kills: 10, mvps: 1 },
                      { name: "Player2", kills: 8, mvps: 0 },
                      { name: "Player3", kills: 7, mvps: 1 },
                    ],
                  },
                  {
                    team: "Team Beta",
                    totalKills: 20,
                    placementPoints: 45,
                    totalPoints: 65,
                    players: [
                      { name: "Player4", kills: 9, mvps: 1 },
                      { name: "Player5", kills: 6, mvps: 0 },
                      { name: "Player6", kills: 5, mvps: 0 },
                    ],
                  },
                  // ... more teams
                ],
              },
              {
                name: "Kalahari",
                teamStats: [
                  // ... similar structure to Bermuda
                ],
              },
              // ... more maps (up to 12)
            ],
          },
          {
            name: "Group B",
            maps: [
              // ... similar structure to Group A
            ],
          },
        ],
      },
      {
        name: "Finals",
        groups: [
          {
            name: "Final Standings",
            maps: [
              // ... similar structure to Qualifiers
            ],
          },
        ],
      },
    ],
  }
}

export default function TournamentLeaderboardsPage() {
  const params = useParams()
  const [tournament, setTournament] = useState(null)
  const [selectedStage, setSelectedStage] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [selectedMap, setSelectedMap] = useState("")
  const [selectedPlayers, setSelectedPlayers] = useState({})

  useEffect(() => {
    const loadTournament = async () => {
      const data = await fetchTournamentLeaderboards(params.id)
      setTournament(data)
      if (data.stages.length > 0) {
        setSelectedStage(data.stages[0].name)
        if (data.stages[0].groups.length > 0) {
          setSelectedGroup(data.stages[0].groups[0].name)
          if (data.stages[0].groups[0].maps.length > 0) {
            setSelectedMap(data.stages[0].groups[0].maps[0].name)
          }
        }
      }
    }
    loadTournament()
  }, [params.id])

  if (!tournament) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  const currentStage = tournament.stages.find((stage) => stage.name === selectedStage)
  const currentGroup = currentStage?.groups.find((group) => group.name === selectedGroup)
  const currentMap = currentGroup?.maps.find((map) => map.name === selectedMap)

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">{tournament.name} Leaderboards</h1>

        <Tabs value={selectedStage} onValueChange={setSelectedStage}>
          <TabsList>
            {tournament.stages.map((stage) => (
              <TabsTrigger key={stage.name} value={stage.name}>
                {stage.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tournament.stages.map((stage) => (
            <TabsContent key={stage.name} value={stage.name}>
              <Card>
                <CardHeader>
                  <CardTitle>{stage.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-4 mb-4">
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {stage.groups.map((group) => (
                          <SelectItem key={group.name} value={group.name}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedMap} onValueChange={setSelectedMap}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select map" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentGroup?.maps.map((map) => (
                          <SelectItem key={map.name} value={map.name}>
                            {map.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {currentMap && (
                    <>
                      <h3 className="text-xl font-semibold mb-4">Team Statistics</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Team</TableHead>
                            <TableHead>Total Kills</TableHead>
                            <TableHead>Placement Points</TableHead>
                            <TableHead>Total Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentMap.teamStats.map((team) => (
                            <TableRow key={team.team}>
                              <TableCell>{team.team}</TableCell>
                              <TableCell>{team.totalKills}</TableCell>
                              <TableCell>{team.placementPoints}</TableCell>
                              <TableCell>{team.totalPoints}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <h3 className="text-xl font-semibold my-4">Player Statistics</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Team</TableHead>
                            <TableHead>Player</TableHead>
                            <TableHead>Kills</TableHead>
                            <TableHead>MVPs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentMap.teamStats.map((team) => (
                            <TableRow key={team.team}>
                              <TableCell>{team.team}</TableCell>
                              <TableCell>
                                <Select
                                  defaultValue="all"
                                  onValueChange={(value) => {
                                    setSelectedPlayers((prev) => ({ ...prev, [team.team]: value }))
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select player" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Players</SelectItem>
                                    {team.players.map((player) => (
                                      <SelectItem key={player.name} value={player.name}>
                                        {player.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {selectedPlayers[team.team] === "all"
                                  ? team.players.reduce((total, player) => total + player.kills, 0)
                                  : team.players.find((p) => p.name === selectedPlayers[team.team])?.kills || 0}
                              </TableCell>
                              <TableCell>
                                {selectedPlayers[team.team] === "all"
                                  ? team.players.reduce((total, player) => total + player.mvps, 0)
                                  : team.players.find((p) => p.name === selectedPlayers[team.team])?.mvps || 0}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-8">
          <Button asChild>
            <Link href={`/admin/tournaments/${tournament.id}/leaderboards/edit`}>Edit Leaderboards</Link>
          </Button>
        </div>
      </div>
    </AdminLayout>
  )
}
