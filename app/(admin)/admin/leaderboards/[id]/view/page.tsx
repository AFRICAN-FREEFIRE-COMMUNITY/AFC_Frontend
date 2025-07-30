"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Edit } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LeaderboardData {
  id: string
  name: string
  format: string
  stages: {
    name: string
    groups: {
      name: string
      maps: string[]
      leaderboard: {
        teamId: string
        teamName: string
        overallPosition: number
        totalKills: number
        totalPoints: number
        totalPlacementPoints: number
        players: { id: string; name: string; totalKills: number; totalMvps: number }[]
        bot: { id: string; name: string; totalKills: number; totalMvps: number }
        mapResults: {
          [map: string]: {
            placement: number
            kills: number
            placementPoints: number
            mapPoints: number
            players: any[] // Define the structure for players if needed
            bot: any // Define the structure for bot if needed
          }
        }
      }[]
    }[]
  }[]
}

const fetchLeaderboardData = async (id: string): Promise<LeaderboardData> => {
  // In a real app, this would be an API call
  await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate API delay

  // Replace this with your actual leaderboard data structure
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
            maps: ["Bermuda", "Kalahari", "Purgatory"],
            leaderboard: [
              {
                teamId: "team-alpha",
                teamName: "Team Alpha",
                overallPosition: 1,
                totalKills: 50,
                totalPoints: 100,
                totalPlacementPoints: 33,
                players: [
                  { id: "player1", name: "Player1", totalKills: 20, totalMvps: 2 },
                  { id: "player2", name: "Player2", totalKills: 15, totalMvps: 1 },
                  { id: "player3", name: "Player3", totalKills: 15, totalMvps: 1 },
                  // ... more players
                ],
                bot: { id: "bot", name: "Bot", totalKills: 0, totalMvps: 0 },
                mapResults: {
                  Bermuda: { placement: 1, kills: 20, placementPoints: 12, mapPoints: 32, players: [], bot: null },
                  Kalahari: { placement: 2, kills: 15, placementPoints: 11, mapPoints: 26, players: [], bot: null },
                  Purgatory: { placement: 3, kills: 15, placementPoints: 10, mapPoints: 25, players: [], bot: null },
                },
              },
              // ... more teams
            ],
          },
          // ... more groups
        ],
      },
      // ... more stages
    ],
  }
}

export default function ViewLeaderboardPage() {
  const params = useParams()
  const router = useRouter()
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null)
  const [selectedStage, setSelectedStage] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [selectedMap, setSelectedMap] = useState("overall")

  useEffect(() => {
    const loadLeaderboard = async () => {
      const data = await fetchLeaderboardData(params.id as string)
      setLeaderboardData(data)
      setSelectedStage(data.stages[0].name)
      setSelectedGroup(data.stages[0].groups[0].name)
    }
    loadLeaderboard()
  }, [params.id])

  if (!leaderboardData) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  const currentStage = leaderboardData.stages.find((stage) => stage.name === selectedStage)
  const currentGroup = currentStage?.groups.find((group) => group.name === selectedGroup)
  const maps = currentGroup?.maps || []
  const leaderboard = currentGroup?.leaderboard || []

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" onClick={() => router.push("/admin/leaderboards")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leaderboards
          </Button>
          <Button asChild>
            <Link href={`/admin/leaderboards/${params.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit Leaderboard
            </Link>
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-8">{leaderboardData.name} Leaderboard</h1>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stage</label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {leaderboardData.stages.map((stage) => (
                  <SelectItem key={stage.name} value={stage.name}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Group</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {currentStage?.groups.map((group) => (
                  <SelectItem key={group.name} value={group.name}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Map (Optional)</label>
            <Select value={selectedMap} onValueChange={setSelectedMap}>
              <SelectTrigger>
                <SelectValue placeholder="Select map" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall</SelectItem>
                {maps.map((map) => (
                  <SelectItem key={map} value={map}>
                    {map}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedStage} - {selectedGroup} - {selectedMap === "overall" ? "Overall" : selectedMap} Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Overall Position</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Kills</TableHead>
                  {leaderboardData.format === "Battle Royale" && <TableHead>Placement Points</TableHead>}
                  <TableHead>Total Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((team) => (
                  <TableRow key={team.teamId}>
                    <TableCell>{team.overallPosition}</TableCell>
                    <TableCell>{team.teamName}</TableCell>
                    <TableCell>
                      {selectedMap === "overall" ? team.totalKills : team.mapResults[selectedMap].kills}
                    </TableCell>
                    {leaderboardData.format === "Battle Royale" && (
                      <TableCell>
                        {selectedMap === "overall"
                          ? team.totalPlacementPoints
                          : team.mapResults[selectedMap].placementPoints}
                      </TableCell>
                    )}
                    <TableCell>
                      {selectedMap === "overall" ? team.totalPoints : team.mapResults[selectedMap].mapPoints}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
