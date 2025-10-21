"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminLayout from "@/components/AdminLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageUploader } from "@/components/ImageUploader"
import { ArrowLeft, X } from "lucide-react"
import { SearchableTeamDropdown } from "@/components/SearchableTeamDropdown"

// Mock function to fetch tournament leaderboards
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
                  { id: "player4", name: "Player4", totalKills: 0, totalMvps: 0 },
                  { id: "player5", name: "Player5", totalKills: 0, totalMvps: 0 },
                  { id: "player6", name: "Player6", totalKills: 0, totalMvps: 0 },
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

// Function to calculate points based on placement
const calculatePlacementPoints = (placement: number) => {
  if (placement === 1) return 12 // Booyah
  if (placement >= 2 && placement <= 12) return 13 - placement
  return 0
}

// Function to calculate total points for a map
const calculateMapPoints = (placement: number, kills: number) => {
  return calculatePlacementPoints(placement) + kills
}

export default function EditTournamentLeaderboardsPage() {
  const params = useParams()
  const router = useRouter()
  const [tournament, setTournament] = useState(null)
  const [selectedStage, setSelectedStage] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [selectedMap, setSelectedMap] = useState("overall")
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    const loadTournament = async () => {
      const data = await fetchTournamentLeaderboards(params.id)
      setTournament(data)
      if (data.stages.length > 0) {
        setSelectedStage(data.stages[0].name)
        if (data.stages[0].groups.length > 0) {
          setSelectedGroup(data.stages[0].groups[0].name)
          setLeaderboard(data.stages[0].groups[0].leaderboard)
        }
      }
    }
    loadTournament()
  }, [params.id])

  const handleLeaderboardChange = (index: number, field: string, value: string | number) => {
    const updatedLeaderboard = [...leaderboard]
    updatedLeaderboard[index] = { ...updatedLeaderboard[index], [field]: value }

    if (field === "overallPosition") {
      // Sort the leaderboard based on the new overall positions
      updatedLeaderboard.sort((a, b) => a.overallPosition - b.overallPosition)
    }

    setLeaderboard(updatedLeaderboard)
  }

  const handleMapResultChange = (teamIndex: number, map: string, field: string, value: number) => {
    const updatedLeaderboard = [...leaderboard]
    const team = updatedLeaderboard[teamIndex]
    team.mapResults[map][field] = value

    // Recalculate points for this map
    if (field === "placement" || field === "kills") {
      team.mapResults[map].placementPoints = calculatePlacementPoints(team.mapResults[map].placement)
      team.mapResults[map].mapPoints = calculateMapPoints(team.mapResults[map].placement, team.mapResults[map].kills)
    }

    // Recalculate total kills, total placement points, and total points
    team.totalKills = Object.values(team.mapResults).reduce((sum, mapResult) => sum + mapResult.kills, 0)
    team.totalPlacementPoints = Object.values(team.mapResults).reduce(
      (sum, mapResult) => sum + mapResult.placementPoints,
      0,
    )
    team.totalPoints = Object.values(team.mapResults).reduce((sum, mapResult) => sum + mapResult.mapPoints, 0)

    setLeaderboard(updatedLeaderboard)
  }

  const handlePlayerChange = (
    teamIndex: number,
    playerIndex: number,
    field: string,
    value: number,
    map: string | null = null,
  ) => {
    const updatedLeaderboard = [...leaderboard]
    const team = updatedLeaderboard[teamIndex]

    if (map) {
      if (!team.mapResults[map].players) {
        team.mapResults[map].players = [...team.players.map((p) => ({ ...p, kills: 0, mvps: 0 }))]
      }
      if (playerIndex === team.players.length) {
        // This is the bot player
        if (!team.mapResults[map].bot) {
          team.mapResults[map].bot = { id: "bot", name: "Bot", kills: 0, mvps: 0 }
        }
        team.mapResults[map].bot[field] = value
      } else {
        team.mapResults[map].players[playerIndex][field] = value
      }
      // Recalculate total kills for the map
      team.mapResults[map].kills =
        team.mapResults[map].players.reduce((sum, player) => sum + player.kills, 0) +
        (team.mapResults[map].bot?.kills || 0)
      team.mapResults[map].mapPoints = calculateMapPoints(team.mapResults[map].placement, team.mapResults[map].kills)
    } else {
      // Overall stats (calculated from map results)
      if (playerIndex === team.players.length) {
        if (!team.bot) {
          team.bot = { id: "bot", name: "Bot", totalKills: 0, totalMvps: 0 }
        }
        team.bot[field] = value
      } else {
        team.players[playerIndex][field] = value
      }
    }

    // Recalculate overall stats
    team.totalKills = Object.values(team.mapResults).reduce((sum, mapResult) => sum + mapResult.kills, 0)
    team.totalPlacementPoints = Object.values(team.mapResults).reduce(
      (sum, mapResult) => sum + mapResult.placementPoints,
      0,
    )
    team.totalPoints = Object.values(team.mapResults).reduce((sum, mapResult) => sum + mapResult.mapPoints, 0)
    team.players.forEach((player, index) => {
      player.totalKills = Object.values(team.mapResults).reduce(
        (sum, mapResult) => sum + (mapResult.players?.[index]?.kills || 0),
        0,
      )
      player.totalMvps = Object.values(team.mapResults).reduce(
        (sum, mapResult) => sum + (mapResult.players?.[index]?.mvps || 0),
        0,
      )
    })
    if (team.bot) {
      team.bot.totalKills = Object.values(team.mapResults).reduce(
        (sum, mapResult) => sum + (mapResult.bot?.kills || 0),
        0,
      )
      team.bot.totalMvps = Object.values(team.mapResults).reduce(
        (sum, mapResult) => sum + (mapResult.bot?.mvps || 0),
        0,
      )
    }

    setLeaderboard(updatedLeaderboard)
  }

  const handleImageUpload = (imageUrl: string) => {
    // In a real app, you would process the image here and update the leaderboard
    console.log("Image uploaded:", imageUrl)
  }

  const handleSave = () => {
    // In a real app, you would save the changes to the backend here
    console.log("Saving leaderboard:", leaderboard)
    router.push(`/admin/events/${params.id}/leaderboards`)
  }

  if (!tournament) {
    return <AdminLayout>Loading...</AdminLayout>
  }

  const currentStage = tournament.stages.find((stage) => stage.name === selectedStage)
  const currentGroup = currentStage?.groups.find((group) => group.name === selectedGroup)
  const maps = currentGroup?.maps || []

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Edit {tournament.name} Leaderboards</h1>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stage</label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {tournament.stages.map((stage) => (
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
            <label className="block text-sm font-medium text-gray-700">Map</label>
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
                  <TableHead>Players</TableHead>
                  <TableHead>Placement Points</TableHead>
                  <TableHead>{selectedMap === "overall" ? "Total Points" : "Map Points"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((team, index) => (
                  <TableRow key={team.teamId}>
                    <TableCell>
                      <Input
                        type="number"
                        value={team.overallPosition}
                        onChange={(e) => handleLeaderboardChange(index, "overallPosition", e.target.value)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <SearchableTeamDropdown
                        value={team.teamId}
                        onChange={(value) => handleLeaderboardChange(index, "teamId", value)}
                      />
                    </TableCell>
                    <TableCell>
                      {selectedMap === "overall" ? (
                        team.totalKills
                      ) : (
                        <Input
                          type="number"
                          value={team.mapResults[selectedMap].kills}
                          onChange={(e) => handleMapResultChange(index, selectedMap, "kills", Number(e.target.value))}
                          className="w-20"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Kills</TableHead>
                            <TableHead>MVPs</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {team.players.map((player, playerIndex) => (
                            <TableRow key={player.id}>
                              <TableCell>{player.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={
                                    selectedMap === "overall"
                                      ? player.totalKills
                                      : team.mapResults[selectedMap]?.players?.[playerIndex]?.kills || 0
                                  }
                                  onChange={(e) =>
                                    handlePlayerChange(
                                      index,
                                      playerIndex,
                                      "kills",
                                      Number(e.target.value),
                                      selectedMap === "overall" ? null : selectedMap,
                                    )
                                  }
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={
                                    selectedMap === "overall"
                                      ? player.totalMvps
                                      : team.mapResults[selectedMap]?.players?.[playerIndex]?.mvps || 0
                                  }
                                  onChange={(e) =>
                                    handlePlayerChange(
                                      index,
                                      playerIndex,
                                      "mvps",
                                      Number(e.target.value),
                                      selectedMap === "overall" ? null : selectedMap,
                                    )
                                  }
                                  className="w-20"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell>Bot</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={
                                  selectedMap === "overall"
                                    ? team.bot?.totalKills || 0
                                    : team.mapResults[selectedMap]?.bot?.kills || 0
                                }
                                onChange={(e) =>
                                  handlePlayerChange(
                                    index,
                                    team.players.length,
                                    "kills",
                                    Number(e.target.value),
                                    selectedMap === "overall" ? null : selectedMap,
                                  )
                                }
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={
                                  selectedMap === "overall"
                                    ? team.bot?.totalMvps || 0
                                    : team.mapResults[selectedMap]?.bot?.mvps || 0
                                }
                                onChange={(e) =>
                                  handlePlayerChange(
                                    index,
                                    team.players.length,
                                    "mvps",
                                    Number(e.target.value),
                                    selectedMap === "overall" ? null : selectedMap,
                                  )
                                }
                                className="w-20"
                              />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableCell>
                    <TableCell>
                      {selectedMap === "overall"
                        ? team.totalPlacementPoints
                        : team.mapResults[selectedMap].placementPoints}
                    </TableCell>
                    <TableCell>
                      {selectedMap === "overall" ? team.totalPoints : team.mapResults[selectedMap].mapPoints}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {selectedMap !== "overall" && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Upload Result Images for {selectedMap}</h3>
                <p className="text-sm text-gray-500 mb-2">You can upload up to 6 images for this map.</p>
                <ImageUploader onImageUpload={handleImageUpload} />
              </div>
            )}

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div>
                <Button variant="outline" onClick={() => router.back()} className="mr-2">
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
